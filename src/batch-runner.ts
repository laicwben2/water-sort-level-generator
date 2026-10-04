import { readFile, writeFile, rename, mkdir, access, statfs } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { appendCatalogIndex, loadCatalogIndex, type CatalogIndex } from './catalog-index';
import { fileHash, recoverPair, verifyPair, writeExclusive } from './artifact-store';
import { validateLocalShard, validateRange, type LocalShard } from './shard';
import { isDeepStrictEqual } from 'node:util';
export interface BatchOptions {
    directory: string;
    baseline?: string;
    startIndex?: number;
    endIndex?: number;
    batchSize?: number;
    dryRun?: boolean;
    resume?: boolean;
    status?: boolean;
    publish?: boolean;
    publishRetry?: boolean;
}
interface Plan {
    formatVersion: 'local-batch-plan-v1';
    baseline: string;
    baselineSHA256: string;
    baselineDigest: string;
    startIndex: number;
    endIndex: number;
    batchSize: number;
    namespace: CatalogIndex['namespace'];
    branch: string;
    sourceTree: string;
    lockfile: string;
    publish: boolean;
}
interface Job {
    start: number;
    end: number;
    file: string;
    index: string;
    stage: 'generated' | 'validated' | 'indexed' | 'committed' | 'pushed';
    commit?: string;
}
interface State {
    completed: number;
    index?: string;
    current?: Job;
    planCommit?: string;
    planPushed?: boolean;
    timings: Array<{
        stage: string;
        elapsedMs: number;
    }>;
}
const cliDirectory = fileURLToPath(new URL('./cli/', import.meta.url));
const exists = async (p: string) => { try {
    await access(p);
    return true;
}
catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT')
        return false;
    throw e;
} };
const name = (index: number) => String(index).padStart(6, '0');
export async function runBatches(options: BatchOptions): Promise<State | {
    plan: Plan;
    dryRun: true;
}> {
    const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
    const root = git(['rev-parse', '--show-toplevel']), dir = resolve(options.directory), planPath = join(dir, 'plan.json'), statePath = join(dir, '.batch-state.json');
    if (dir === root || !dir.startsWith(root + sep))
        throw new Error('Batch directory must be a subdirectory of the repository');
    const portable = (p: string) => relative(root, p).split(sep).join('/');
    let plan: Plan, state: State = { completed: 0, timings: [] };
    if (await exists(planPath)) {
        if (!options.resume && !options.status && !options.publishRetry)
            throw new Error('Plan exists; use --resume=true or --status=true');
        plan = JSON.parse(await readFile(planPath, 'utf8'));
        if (plan.formatVersion !== 'local-batch-plan-v1')
            throw new Error('Unsupported batch plan');
        if (options.baseline && portable(resolve(options.baseline)) !== plan.baseline || options.startIndex !== undefined && options.startIndex !== plan.startIndex || options.endIndex !== undefined && options.endIndex !== plan.endIndex || options.batchSize !== undefined && options.batchSize !== plan.batchSize || options.publish !== undefined && options.publish !== plan.publish)
            throw new Error('Resume plan options mismatch');
        if (await exists(statePath))
            state = JSON.parse(await readFile(statePath, 'utf8'));
        else {
            // Reconstruct from immutable committed snapshots in a fresh checkout.
            for (let start = plan.startIndex; start <= plan.endIndex; start += plan.batchSize) {
                const end = Math.min(plan.endIndex, start + plan.batchSize - 1), p = join(dir, `index-through-${name(end)}.json`);
                if (!await exists(p))
                    break;
                state.index = p;
                state.completed++;
            }
        }
    }
    else {
        if (!options.baseline || options.startIndex === undefined || options.endIndex === undefined)
            throw new Error('New plan requires --baseline, --start-index and --end-index');
        validateRange(options.startIndex, options.endIndex);
        const size = options.batchSize ?? 100;
        if (!Number.isSafeInteger(size) || size < 1)
            throw new Error('Invalid batch size');
        const baselinePath = resolve(options.baseline), s: unknown = JSON.parse(await readFile(baselinePath, 'utf8'));
        validateLocalShard(s);
        if (s.endIndex >= options.startIndex)
            throw new Error('Requested range overlaps baseline');
        plan = { formatVersion: 'local-batch-plan-v1', baseline: portable(baselinePath), baselineSHA256: await fileHash(baselinePath), baselineDigest: s.digest, startIndex: options.startIndex, endIndex: options.endIndex, batchSize: size, namespace: { config: s.config, reproducibility: s.reproducibility }, branch: git(['branch', '--show-current']), sourceTree: git(['rev-parse', 'HEAD:src']), lockfile: git(['rev-parse', 'HEAD:package-lock.json']), publish: options.publish ?? false };
    }
    if (!plan.branch || git(['branch', '--show-current']) !== plan.branch || git(['rev-parse', 'HEAD:src']) !== plan.sourceTree || git(['rev-parse', 'HEAD:package-lock.json']) !== plan.lockfile)
        throw new Error('Branch/source tree/lockfile changed since plan');
    const assertSource = () => {
        if (git(['branch', '--show-current']) !== plan.branch || git(['rev-parse', 'HEAD:src']) !== plan.sourceTree || git(['rev-parse', 'HEAD:package-lock.json']) !== plan.lockfile || git(['diff', 'HEAD', '--', 'src', 'package-lock.json']))
            throw new Error('Source changed during batch plan');
    };
    const batchCount = Math.ceil((plan.endIndex - plan.startIndex + 1) / plan.batchSize);
    if (!Number.isSafeInteger(state.completed) || state.completed < 0 || state.completed > batchCount || !Array.isArray(state.timings))
        throw new Error('Corrupt batch state');
    if (state.index && !resolve(state.index).startsWith(dir + sep))
        throw new Error('Batch state index outside directory');
    if (state.current) {
        const start = plan.startIndex + state.completed * plan.batchSize, end = Math.min(plan.endIndex, start + plan.batchSize - 1);
        if (state.current.start !== start || state.current.end !== end || state.current.file !== join(dir, `shard-${name(start)}-${name(end)}.json`) || state.current.index !== join(dir, `index-through-${name(end)}.json`))
            throw new Error('Batch state range/path mismatch');
    }
    const baselinePath = resolve(root, plan.baseline);
    if (await fileHash(baselinePath) !== plan.baselineSHA256)
        throw new Error('Baseline bytes changed');
    const disk = await statfs(root);
    console.log(JSON.stringify({ mode: 'candidate range', range: [plan.startIndex, plan.endIndex], batchSize: plan.batchSize, baseline: plan.baseline, publish: plan.publish, freeDiskBytes: Number(disk.bavail) * Number(disk.bsize), node: process.version, nextIndex: plan.startIndex + state.completed * plan.batchSize }));
    if (options.dryRun)
        return { plan, dryRun: true };
    if (options.status) {
        console.log(JSON.stringify(state));
        return state;
    }
    const dirty = git(['status', '--porcelain']).split('\n').filter(Boolean);
    if (dirty.some(line => !line.slice(3).startsWith(portable(dir) + '/')))
        throw new Error('Unrelated working tree changes; commit/stash them before a batch run');
    assertSource();
    if (plan.publish) {
        try {
            git(['check-ignore', portable(join(dir, 'plan.json'))]);
            throw new Error('Cannot publish an ignored directory');
        }
        catch (e) {
            if ((e as {
                status?: number;
            }).status !== 1)
                throw e;
        }
    }
    await mkdir(dir, { recursive: true });
    async function save() { const temp = `${statePath}.${randomUUID()}.tmp`; try {
        await writeFile(temp, JSON.stringify(state, null, 2) + '\n', { flag: 'wx' });
        await rename(temp, statePath);
    }
    finally {
        if (await exists(temp))
            await import('node:fs/promises').then(fs => fs.unlink(temp));
    } }
    function timed<T>(stage: string, fn: () => T): T { const t = performance.now(); try {
        return fn();
    }
    finally {
        state.timings.push({ stage, elapsedMs: performance.now() - t });
    } }
    const commit = () => {
        const [user, email] = git(['show', '-s', '--format=%an%n%ae', 'HEAD']).split('\n');
        timed('git-add', () => git(['add', '--', portable(dir)]));
        timed('git-commit', () => git(['-c', `user.name=${user}`, '-c', `user.email=${email}`, 'commit', '-m', `data: local batch ${state.current?.start ?? 'plan'}-${state.current?.end ?? 'plan'}`]));
        return git(['rev-parse', 'HEAD']);
    };
    const publish = (sha: string) => {
        if (git(['rev-parse', 'HEAD']) !== sha)
            throw new Error('Local HEAD changed; will not publish unrelated commits');
        const remote = timed('git-fetch', () => { const result = git(['ls-remote', 'origin', `refs/heads/${plan.branch}`]); if (result) {
            git(['fetch', 'origin', plan.branch]);
            return result.split(/\s+/)[0];
        } return undefined; });
        if (remote === sha)
            return;
        if (remote)
            git(['merge-base', '--is-ancestor', remote, sha]); // fail on remote divergence; never force-push
        timed('git-push', () => git(['push', 'origin', `HEAD:refs/heads/${plan.branch}`]));
    };
    if (!await exists(planPath)) {
        await writeExclusive(planPath, plan);
        await save();
    }
    if (plan.publish && !state.planPushed) {
        if (!state.planCommit)
            state.planCommit = git(['ls-files', '--', portable(planPath)]) && !git(['diff', 'HEAD', '--', portable(planPath)]) ? git(['rev-parse', 'HEAD']) : commit();
        await save();
        try {
            publish(state.planCommit);
        }
        finally {
            await save();
        }
        ;
        state.planPushed = true;
        await save();
        if (options.publishRetry && !state.current)
            return state;
    }
    let index: CatalogIndex;
    if (state.index)
        index = await loadCatalogIndex(state.index);
    else {
        const s: unknown = JSON.parse(await readFile(baselinePath, 'utf8'));
        validateLocalShard(s);
        index = appendCatalogIndex(undefined, relative(dir, baselinePath).split(sep).join('/'), plan.baselineSHA256, s);
    }
    if (!isDeepStrictEqual(index.namespace, plan.namespace))
        throw new Error('State index namespace mismatch');
    const expectedEnd = state.completed ? Math.min(plan.endIndex, plan.startIndex + state.completed * plan.batchSize - 1) : undefined;
    if (expectedEnd !== undefined && index.ranges.at(-1)?.endIndex !== expectedEnd)
        throw new Error('State index progress mismatch');
    const publishCurrent = async () => {
        const job = state.current!;
        if (job.stage === 'indexed') {
            // A crash after commit but before journal update is recoverable from the tree.
            const tracked = git(['ls-files', '--', portable(job.index)]);
            const unchanged = !git(['diff', 'HEAD', '--', portable(dir)]);
            job.commit = tracked && unchanged ? git(['rev-parse', 'HEAD']) : commit();
            job.stage = 'committed';
            await save();
        }
        if (job.stage === 'committed') {
            try {
                publish(job.commit!);
            }
            finally {
                await save();
            }
            ;
            job.stage = 'pushed';
            await save();
        }
    };
    if (options.publishRetry) {
        if (!plan.publish || !state.current || !['indexed', 'committed', 'pushed'].includes(state.current.stage))
            throw new Error('No committed/indexed publication to retry');
        await publishCurrent();
        return state;
    }
    if (state.current && ['indexed', 'committed', 'pushed'].includes(state.current.stage)) {
        if (plan.publish)
            await publishCurrent();
        state.completed++;
        state.index = state.current.index;
        delete state.current;
        await save();
        index = await loadCatalogIndex(state.index);
    }
    for (let start = plan.startIndex + state.completed * plan.batchSize; start <= plan.endIndex; start += plan.batchSize) {
        assertSource();
        const end = Math.min(plan.endIndex, start + plan.batchSize - 1), output = join(dir, `shard-${name(start)}-${name(end)}.json`), indexPath = join(dir, `index-through-${name(end)}.json`);
        if (await exists(`${output}.pending.json`))
            await recoverPair(output);
        if (!await exists(output)) {
            const c = plan.namespace.config, m = c.mistakeAnalysis;
            const args = [`--seed=${plan.namespace.reproducibility.batchSeed}`, `--start-index=${start}`, `--end-index=${end}`, `--output=${output}`, `--colors=${c.colors.join(',')}`, `--capacity=${c.capacity}`, `--max-empty=${c.maxEmptyTubes}`, `--max-depth=${c.maxDepth}`, `--max-states=${c.maxVisitedStates}`, `--analysis-max-states=${m.maxVisitedStatesPerAlternative}`, `--analysis-max-depth=${m.maxDepthPerAlternative}`, `--analysis-max-steps=${m.maxAnalyzedSteps}`, `--analysis-max-alternatives=${m.maxAlternativesPerStep}`, `--severe-penalty=${m.severeRecoveryThreshold}`];
            timed('generate-process', () => execFileSync(process.execPath, ['--import', 'tsx', join(cliDirectory, 'generate.ts'), ...args], { stdio: 'inherit', env: { ...process.env, WATER_SORT_SUPERVISED: undefined } }));
        }
        await verifyPair(output);
        state.current = { start, end, file: output, index: indexPath, stage: 'generated' };
        await save();
        const shard: unknown = JSON.parse(await readFile(output, 'utf8'));
        validateLocalShard(shard);
        if (shard.startIndex !== start || shard.endIndex !== end || shard.candidatesProcessed !== end - start + 1 || !isDeepStrictEqual({ config: shard.config, reproducibility: shard.reproducibility }, plan.namespace))
            throw new Error('Generated range/namespace mismatch');
        state.current.stage = 'validated';
        await save();
        index = appendCatalogIndex(index, relative(dir, output).split(sep).join('/'), await fileHash(output), shard);
        if (await exists(indexPath)) {
            if (!isDeepStrictEqual(await loadCatalogIndex(indexPath), index))
                throw new Error('Existing index mismatch');
        }
        else
            await writeExclusive(indexPath, index);
        await writeFile(join(dir, 'README.md'), `# Local batch handoff\n\nLatest index: [${name(end)}](index-through-${name(end)}.json). Candidates=${index.candidatesProcessed}; unique puzzles=${index.summary.accepted}; duplicates=${index.summary.duplicate}; rejected=${index.summary.qualityRejected}; UNKNOWN=${index.summary.unknown}.\n\nUse index:catalog --input to verify all referenced shards, and --materialize to export full v1. Each shard includes a complete publication marker. Candidate quota is distinct from unique accepted quota.\n`);
        state.current.stage = 'indexed';
        await save();
        if (plan.publish)
            await publishCurrent();
        state.completed++;
        state.index = indexPath;
        delete state.current;
        await save();
        console.log(JSON.stringify({ completedBatches: state.completed, throughIndex: end, uniquePuzzles: index.summary.accepted, published: plan.publish }));
    }
    return state;
}

import { execFileSync } from 'node:child_process'
import { hostname, release } from 'node:os'
import { mkdir, writeFile, link, unlink, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { DEFAULT_LOCAL_CONFIG, generateLocalShard, serialize, validateLocalShard, validateConfig, type LocalConfig } from '../shard'
import { stringArg } from './args'

export function requireLocalRuntime(): void {
  if (process.version !== 'v24.19.0') throw new Error('Local workflow requires exact Node 24.19.0')
  if (!process.env.npm_config_user_agent?.startsWith('npm/11.17.0 ')) throw new Error('Run through exact npm 11.17.0')
}
export function safeIntArg(name: string, fallback?: number): number {
  const raw = stringArg(name)
  if (raw === undefined && fallback !== undefined) return fallback
  if (raw === undefined || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error(`--${name} must be a non-negative safe integer`)
  return Number(raw)
}
export function localConfigArgs(): LocalConfig {
  const rawColors = stringArg('colors')
  const colors = rawColors === undefined ? [...DEFAULT_LOCAL_CONFIG.colors] : rawColors.split(',').map(raw => {
    if (!/^\d+$/.test(raw)) throw new Error('--colors must contain integer type counts')
    return Number(raw)
  })
  const config: LocalConfig = {
    colors, capacity: safeIntArg('capacity', 4), maxEmptyTubes: safeIntArg('max-empty', 5),
    maxDepth: safeIntArg('max-depth', 100), maxVisitedStates: safeIntArg('max-states', 100_000),
    mistakeAnalysis: {
      maxVisitedStatesPerAlternative: safeIntArg('analysis-max-states', 25_000),
      maxDepthPerAlternative: safeIntArg('analysis-max-depth', 100),
      maxAnalyzedSteps: safeIntArg('analysis-max-steps', 20),
      maxAlternativesPerStep: safeIntArg('analysis-max-alternatives', 6),
      severeRecoveryThreshold: safeIntArg('severe-penalty', 5),
    },
  }
  validateConfig(config)
  return config
}
export async function assertNewOutput(path: string): Promise<void> {
  try { await access(path) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  throw new Error(`Output already exists: ${path}`)
}
// A unique temporary file and exclusive hard-link publication avoid truncation/overwrite.
export async function writeArtifact(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, serialize(value), { encoding: 'utf8', flag: 'wx' })
  try { await link(temporary, path) } finally { await unlink(temporary) }
}
function gitValue(args: string[]): string | null {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
  catch { return null }
}
export async function runLocalGeneration(options: { startIndex: number; endIndex: number; batchSeed: string; output: string; config: LocalConfig }): Promise<void> {
  requireLocalRuntime()
  const output = resolve(options.output)
  if (!output.endsWith('.json') || output.endsWith('.run.json')) throw new Error('--output must end in .json, excluding .run.json')
  const manifest = output.replace(/\.json$/, '.run.json')
  await assertNewOutput(output); await assertNewOutput(manifest)
  const git = {
    commit: gitValue(['rev-parse', 'HEAD']), branch: gitValue(['branch', '--show-current']),
    dirty: gitValue(['status', '--porcelain']) !== '',
  }
  const startTime = new Date().toISOString()
  const started = performance.now()
  let candidateStarted = started
  const candidateTimings: Array<{ candidateIndex: number; elapsedMs: number }> = []
  const shard = generateLocalShard({ ...options, onCandidate(candidate) {
    const finished = performance.now()
    candidateTimings.push({ candidateIndex: candidate.candidateIndex, elapsedMs: finished - candidateStarted })
    candidateStarted = finished
    if ((candidate.candidateIndex - options.startIndex + 1) % 10 === 0) process.stderr.write(`Processed ${candidate.candidateIndex - options.startIndex + 1} candidates\n`)
  } })
  validateLocalShard(shard)
  const usage = process.resourceUsage()
  const memory = process.memoryUsage()
  const run = {
    formatVersion: 'local-run-v1', platform: process.platform, architecture: process.arch,
    osRelease: release(), hostname: hostname(), nodeVersion: process.version, npmVersion: '11.17.0', git,
    reproducibility: shard.reproducibility, startIndex: shard.startIndex, endIndex: shard.endIndex,
    startTime, finishTime: new Date().toISOString(), elapsedMs: performance.now() - started,
    candidatesProcessed: shard.candidatesProcessed, summary: shard.summary,
    resourceStatistics: { maxRssBytes: usage.maxRSS * 1024, rssEndBytes: memory.rss, heapUsedEndBytes: memory.heapUsed,
      userCpuMicroseconds: usage.userCPUTime, systemCpuMicroseconds: usage.systemCPUTime },
    candidateTimings, shardDigest: shard.digest,
  }
  await writeArtifact(output, shard)
  await writeArtifact(manifest, run)
  console.log(serialize({ output, manifest, digest: shard.digest, candidatesProcessed: shard.candidatesProcessed, summary: shard.summary, elapsedMs: run.elapsedMs }))
}

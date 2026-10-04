import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { digest, validateLocalShard, type LocalShard, type CandidateRange } from './shard';
import { fileHash } from './artifact-store';
export interface IndexShard {
    file: string;
    sha256: string;
    digest: string;
    ranges: CandidateRange[];
    candidatesProcessed: number;
    summary: LocalShard['summary'];
}
export interface CatalogIndex {
    formatVersion: 'local-catalog-index-v1';
    namespace: {
        config: LocalShard['config'];
        reproducibility: LocalShard['reproducibility'];
    };
    shards: IndexShard[];
    ranges: CandidateRange[];
    candidatesProcessed: number;
    summary: LocalShard['summary'];
    puzzles: Array<{
        candidateIndex: number;
        canonicalKey: string;
        file: string;
    }>;
    digest: string;
}
function assembleIndex(namespace: CatalogIndex['namespace'], shards: IndexShard[], puzzles: CatalogIndex['puzzles']): CatalogIndex {
    const ordered = shards.slice().sort((a, b) => a.ranges[0].startIndex - b.ranges[0].startIndex);
    if (new Set(ordered.map(s => s.file)).size !== ordered.length)
        throw new Error('Repeated index file');
    const ranges: CandidateRange[] = [];
    for (const r of ordered.flatMap(s => s.ranges).sort((a, b) => a.startIndex - b.startIndex)) {
        const prev = ranges.at(-1);
        if (prev && r.startIndex <= prev.endIndex)
            throw new Error('Index ranges overlap');
        if (prev && r.startIndex === prev.endIndex + 1)
            prev.endIndex = r.endIndex;
        else
            ranges.push({ ...r });
    }
    const winners = new Map<string, CatalogIndex['puzzles'][number]>();
    for (const p of puzzles.slice().sort((a, b) => a.candidateIndex - b.candidateIndex))
        if (!winners.has(p.canonicalKey))
            winners.set(p.canonicalKey, p);
    const kept = [...winners.values()].sort((a, b) => a.candidateIndex - b.candidateIndex);
    const sum = (key: keyof LocalShard['summary']) => ordered.reduce((n, s) => n + s.summary[key], 0);
    const payload = { formatVersion: 'local-catalog-index-v1' as const, namespace, shards: ordered, ranges, candidatesProcessed: ordered.reduce((n, s) => n + s.candidatesProcessed, 0), summary: { accepted: kept.length, duplicate: sum('accepted') + sum('duplicate') - kept.length, qualityRejected: sum('qualityRejected'), unknown: sum('unknown'), analysisIncomplete: sum('analysisIncomplete') }, puzzles: kept };
    return { ...payload, digest: digest(payload) };
}
/** index must have been loaded/verified once in this session; only new shard is rescanned. */
export function appendCatalogIndex(index: CatalogIndex | undefined, file: string, sha256: string, shard: LocalShard): CatalogIndex {
    validateLocalShard(shard);
    const namespace = { config: shard.config, reproducibility: shard.reproducibility };
    if (index && !isDeepStrictEqual(index.namespace, namespace))
        throw new Error('Index namespace mismatch');
    const descriptor = { file, sha256, digest: shard.digest, ranges: shard.ranges, candidatesProcessed: shard.candidatesProcessed, summary: shard.summary };
    return assembleIndex(namespace, [...(index?.shards ?? []), descriptor], [...(index?.puzzles ?? []), ...shard.acceptedPuzzles.map(p => ({ candidateIndex: p.candidateIndex, canonicalKey: p.canonicalKey, file }))]);
}
/** External indexes are never trusted solely on their own checksum. */
export async function loadCatalogIndex(path: string): Promise<CatalogIndex> {
    const input = JSON.parse(await readFile(path, 'utf8')) as CatalogIndex;
    if (input?.formatVersion !== 'local-catalog-index-v1' || !Array.isArray(input.shards) || !input.shards.length)
        throw new Error('Unsupported/empty catalog index');
    let rebuilt: CatalogIndex | undefined;
    for (const s of input.shards) {
        if (typeof s.file !== 'string' || !s.file || await fileHash(resolve(dirname(path), s.file)) !== s.sha256)
            throw new Error('Index referenced file checksum mismatch');
        const shard: unknown = JSON.parse(await readFile(resolve(dirname(path), s.file), 'utf8'));
        validateLocalShard(shard);
        rebuilt = appendCatalogIndex(rebuilt, s.file, s.sha256, shard);
    }
    if (!isDeepStrictEqual(input, rebuilt))
        throw new Error('Index content/projection mismatch');
    return input;
}

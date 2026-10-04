import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendCatalogIndex, loadCatalogIndex } from '../src/catalog-index';
import { fileHash, writeExclusive } from '../src/artifact-store';
import { mergeLocalShards, type LocalShard } from '../src/shard';
const a = JSON.parse(readFileSync('data/pilots/mac-local-pilot-v1/shard-000000-000049.json', 'utf8')) as LocalShard;
const b = JSON.parse(readFileSync('data/pilots/mac-local-pilot-v1/shard-000050-000099.json', 'utf8')) as LocalShard;
describe('immutable catalog index', () => {
    it('is order-independent and matches exact v1 winner projection', () => {
        const forward = appendCatalogIndex(appendCatalogIndex(undefined, 'a', 'a', a), 'b', 'b', b), reverse = appendCatalogIndex(appendCatalogIndex(undefined, 'b', 'b', b), 'a', 'a', a);
        expect(reverse).toEqual(forward);
        expect(forward.summary).toEqual(mergeLocalShards([a, b]).summary);
        expect(() => appendCatalogIndex(forward, 'c', 'c', a)).toThrow(/overlap/);
    });
    it('verifies external files and detects changed references', async () => {
        const d = await mkdtemp(join(tmpdir(), 'ws-index-'));
        try {
            await writeExclusive(join(d, 'a.json'), a);
            const index = appendCatalogIndex(undefined, 'a.json', await fileHash(join(d, 'a.json')), a);
            await writeExclusive(join(d, 'index.json'), index);
            expect(await loadCatalogIndex(join(d, 'index.json'))).toEqual(index);
            index.shards[0].sha256 = '0'.repeat(64);
            await writeExclusive(join(d, 'bad.json'), index);
            await expect(loadCatalogIndex(join(d, 'bad.json'))).rejects.toThrow(/checksum/);
        }
        finally {
            await rm(d, { recursive: true, force: true });
        }
    });
});

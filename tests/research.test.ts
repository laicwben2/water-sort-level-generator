import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeLocalPuzzle, digest, generateLocalCandidate, validateLocalShard, type LocalShard } from '../src/shard';
import { validateResearchArtifact } from '../src/research';
import { validateRecoveryTotals } from '../src/research-metrics';
const source = JSON.parse(readFileSync('data/pilots/mac-local-pilot-v1/candidate-000050.json', 'utf8')) as LocalShard;
const artifact = JSON.parse(readFileSync('data/pilots/mac-local-pilot-v1/research-candidate-000050.json', 'utf8'));
function redigest(a: typeof artifact) { const { digest: old, ...payload } = a; a.digest = digest(payload); return a; }
describe('research validation', () => {
    it('preserves published candidate proof, solver metrics and research byte-for-byte logically', () => {
        expect(generateLocalCandidate(50, source.reproducibility.batchSeed, source.config)).toEqual(source.candidates[0]);
    });
    it('preserves all 100 published pilot research records after hot-path changes', () => {
        const pilot = JSON.parse(readFileSync('data/pilots/mac-local-pilot-v1/shard-000000-000099.json', 'utf8')) as LocalShard;
        for (const p of pilot.acceptedPuzzles)
            expect(analyzeLocalPuzzle(p, pilot.config.mistakeAnalysis)).toEqual(p.research);
    }, 30000);
    it('validates the original published smoke artifact with source identity', () => {
        validateResearchArtifact(artifact, source);
        validateLocalShard(source);
    });
    it('rejects impossible maximum recovery even after recomputing digest', () => {
        const s = structuredClone(source);
        s.candidates[0].puzzle!.research.mistakeRecovery.maximumRecoveryPenalty = 0;
        s.acceptedPuzzles[0].research.mistakeRecovery.maximumRecoveryPenalty = 0;
        const { digest: old, ...payload } = s;
        s.digest = digest(payload);
        expect(() => validateLocalShard(s)).toThrow(/recovery/);
    });
    it.each(['source', 'duplicate', 'ratio', 'zero', 'identity', 'missing-metrics'])('rejects %s corruption with valid checksum', kind => {
        const a = structuredClone(artifact);
        if (kind === 'source')
            a.sourceShardDigest = '0'.repeat(64);
        if (kind === 'duplicate')
            a.records.push(structuredClone(a.records[0]));
        if (kind === 'ratio')
            a.records[0].research.mistakeRecovery.knownCoverage = 0.5;
        if (kind === 'zero')
            a.config.maxDepthPerAlternative = 0;
        if (kind === 'identity')
            a.records[0].canonicalKey += '0';
        if (kind === 'missing-metrics')
            a.records[0].research.structural = {};
        expect(() => validateResearchArtifact(redigest(a), source)).toThrow();
    });
    it('enforces severe threshold and overflow-safe totals', () => {
        const m = structuredClone(source.acceptedPuzzles[0].research.mistakeRecovery);
        m.severeRecoveryCount = 1;
        expect(() => validateRecoveryTotals(m)).toThrow();
        m.severeRecoveryCount = 0;
        m.recoverableMistakeCount = Number.MAX_SAFE_INTEGER;
        expect(() => validateRecoveryTotals(m)).toThrow();
    });
});

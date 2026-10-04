import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { coverageReport } from '../src/coverage';
import { candidateIdentity } from '../src/identity';
import type { LocalShard } from '../src/shard';
const source = JSON.parse(readFileSync('data/pilots/mac-local-pilot-v1/candidate-000050.json', 'utf8')) as LocalShard;
describe('coverage and generation identity', () => {
    it('counts complete path coverage separately from selected alternatives', () => {
        const report = coverageReport(source), row = report.baseline[0], m = source.acceptedPuzzles[0].research.mistakeRecovery;
        expect(row.known).toBe(m.knownAlternativeCount);
        expect(row.selectedSteps + row.skippedSteps).toBe(source.acceptedPuzzles[0].optimalSolution.length);
    });
    it('keeps same candidate identity across range boundaries, distinguishes seed/config', () => {
        const a = candidateIdentity(source, 50), copy = structuredClone(source);
        copy.startIndex = 0;
        expect(candidateIdentity(copy, 50)).toEqual(a);
        copy.reproducibility.batchSeed = 'other';
        expect(candidateIdentity(copy, 50)).not.toEqual(a);
        copy.reproducibility.batchSeed = source.reproducibility.batchSeed;
        copy.config.capacity = 3;
        expect(candidateIdentity(copy, 50)).not.toEqual(a);
    });
});

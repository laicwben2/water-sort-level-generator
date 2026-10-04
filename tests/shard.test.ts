import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOCAL_CONFIG, compareLocalShards, digest, generateLocalShard, mergeLocalShards, serialize, validateLocalShard, type LocalConfig, type LocalShard } from '../src/shard'
import * as solver from '../src/solver'

const config: LocalConfig = {
  ...DEFAULT_LOCAL_CONFIG, colors: [2, 3], capacity: 2, maxEmptyTubes: 3,
  maxDepth: 30, maxVisitedStates: 1000,
  mistakeAnalysis: { maxVisitedStatesPerAlternative: 500, maxDepthPerAlternative: 30, maxAnalyzedSteps: 20, maxAlternativesPerStep: 10, severeRecoveryThreshold: 2 },
}
const run = (startIndex: number, endIndex: number, cfg = config, batchSeed = 'range-test-v1') => generateLocalShard({ startIndex, endIndex, config: cfg, batchSeed })
const full = run(0, 99)
function redigest(shard: LocalShard): LocalShard {
  const { digest: _digest, ...payload } = shard
  shard.digest = digest(payload)
  return shard
}

describe('local deterministic shards', () => {
  it('processes exactly one or 100 indexed candidates including rejections', () => {
    expect(run(0, 0).candidatesProcessed).toBe(1)
    expect(full.candidatesProcessed).toBe(100)
    expect(full.candidates.map(c => c.candidateIndex)).toEqual(Array.from({ length: 100 }, (_, i) => i))
    expect(full.summary.accepted + full.summary.duplicate + full.summary.qualityRejected + full.summary.unknown).toBe(100)
    validateLocalShard(full)
  })
  it.each([[-1, 0], [0, -1], [2, 1], [0.5, 2], [0, Number.MAX_SAFE_INTEGER]])('rejects invalid range %s..%s', (start, end) => {
    expect(() => run(start, end)).toThrow()
  })
  it('reproduces candidate 50 alone including all status/proof/research data', () => {
    expect(run(50, 50).candidates[0]).toEqual(full.candidates[50])
  })
  it('makes split merge byte-identical to a full run, regardless of input order', () => {
    const merged = mergeLocalShards([run(50, 99), run(0, 49)])
    expect(serialize(merged)).toBe(serialize(full))
    expect(compareLocalShards(full, merged).candidatesMatched).toBe(100)
  })
  it('repeats with equal bytes/digest, even with operational clocks changed', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(123456789)
    try { expect(serialize(run(0, 99))).toBe(serialize(full)) } finally { clock.mockRestore() }
    expect(run(0, 99).digest).toBe(full.digest)
    expect(serialize(full)).not.toMatch(/hostname|elapsed|timestamp|platform|architecture/)
  })
  it('rejects overlap and missing inputs', () => {
    expect(() => mergeLocalShards([run(0, 1), run(1, 2)])).toThrow(/Overlapping/)
    expect(() => mergeLocalShards([])).toThrow()
  })
  it('rejects incompatible seeds/configs', () => {
    expect(() => mergeLocalShards([run(0, 1), run(2, 3, config, 'different')])).toThrow(/metadata/)
    expect(() => mergeLocalShards([run(0, 1), run(2, 3, { ...config, maxDepth: 31 })])).toThrow(/metadata/)
  })
  it.each(['generatorVersion', 'rngVersion', 'canonicalVersion', 'encodingVersion', 'solverStateEncodingVersion', 'analysisVersion'] as const)('rejects version mismatch %s', field => {
    const modified = structuredClone(run(2, 3))
    modified.reproducibility[field] = 'incompatible'
    expect(() => mergeLocalShards([run(0, 1), redigest(modified)])).toThrow(/mismatch/)
  })
  it('rejects rules and format mismatches', () => {
    expect(() => mergeLocalShards([{ ...full, rulesVersion: 'other' }])).toThrow()
    expect(() => mergeLocalShards([{ ...full, formatVersion: 'other' }])).toThrow()
  })
  it('uses exact identity and reports duplicates with the lowest-index winner', () => {
    const winners = new Map<string, number>()
    for (const candidate of full.candidates) if (candidate.puzzle && !winners.has(candidate.puzzle.canonicalKey)) winners.set(candidate.puzzle.canonicalKey, candidate.candidateIndex)
    expect(full.duplicates.length).toBeGreaterThan(0)
    expect(full.acceptedPuzzles.length).toBe(winners.size)
    for (const duplicate of full.duplicates) expect(duplicate.retainedCandidateIndex).toBe(winners.get(duplicate.canonicalKey))
    expect(full.acceptedPuzzles.map(p => p.candidateIndex)).toEqual([...winners.values()])
  })
  it('does not run a solver during validation or merge', () => {
    const a = run(0, 49), b = run(50, 99)
    const spy = vi.spyOn(solver, 'solveBoard').mockImplementation(() => { throw new Error('Solver must not run') })
    try { validateLocalShard(a); expect(mergeLocalShards([b, a]).digest).toBe(full.digest) } finally { spy.mockRestore() }
  })
  it('retains gaps and does not claim they were processed', () => {
    const merged = mergeLocalShards([run(0, 0), run(50, 50)])
    expect(merged.candidatesProcessed).toBe(2)
    expect(merged.ranges).toEqual([{ startIndex: 0, endIndex: 0 }, { startIndex: 50, endIndex: 50 }])
    validateLocalShard(merged)
  })
  it('validates round-tripped sorted-key JSON and rejects malformed artifacts, even with a new digest', () => {
    validateLocalShard(JSON.parse(serialize(full)))
    const changes: Array<(s: LocalShard) => void> = [
      s => { s.candidates.splice(1, 1) },
      s => { s.candidates[0].candidateIndex = 5 },
      s => { s.candidates[0].rawCandidate[0][0] = 15 },
      s => { s.summary.accepted++ },
      s => { s.acceptedPuzzles = [] },
      s => { s.candidatesProcessed-- },
      s => { Object.assign(s.candidates[0], { hostname: 'must-not-enter-logical-data' }) },
      s => { s.config.capacity = 5 },
      s => { s.config.mistakeAnalysis.maxAnalyzedSteps = 0 },
      s => { const p = s.candidates.find(c => c.puzzle)!.puzzle!; p.optimalSolution[0].amount++ },
      s => { const p = s.candidates.find(c => c.puzzle)!.puzzle!; p.research.mistakeRecovery.deadEndCount++ },
    ]
    expect(() => validateLocalShard({ ...full, digest: 'bad' })).toThrow()
    for (const change of changes) {
      const malformed = structuredClone(full); change(malformed)
      expect(() => validateLocalShard(redigest(malformed))).toThrow()
    }
  })
  it('keeps state/depth resource cutoffs UNKNOWN with strict minimum proof', () => {
    const limited = run(0, 99, { ...config, maxVisitedStates: 1 })
    expect(limited.summary.unknown).toBeGreaterThan(0)
    for (const candidate of limited.candidates.filter(c => c.status === 'unknown')) {
      expect(candidate.reason).toBe('budget-exceeded')
      expect(candidate.emptyTubeAnalysis.at(-1)!.status).toBe('budget-exceeded')
      expect(candidate.puzzle).toBeUndefined()
    }
    validateLocalShard(limited)
    const depth = run(0, 10, { ...config, maxDepth: 1 })
    expect(depth.summary.unknown).toBeGreaterThan(0)
    validateLocalShard(depth)
  })
  it('keeps exhausted empty-count bounds UNKNOWN for the unconstrained minimum', () => {
    const shard = run(0, 9, { ...DEFAULT_LOCAL_CONFIG, colors: [5], maxEmptyTubes: 1 })
    const exhausted = shard.candidates.filter(c => c.reason === 'max-empty-tubes-exhausted')
    expect(exhausted.length).toBeGreaterThan(0)
    for (const candidate of exhausted) {
      expect(candidate.status).toBe('unknown')
      expect(candidate.emptyTubeAnalysis.at(-1)!.status).toBe('unsolvable')
    }
    validateLocalShard(shard)
  })

  it('keeps incomplete analysis separate from correctness and never calls UNKNOWN a dead end', () => {
    const limited = run(0, 99, { ...config, mistakeAnalysis: { ...config.mistakeAnalysis, maxVisitedStatesPerAlternative: 1 } })
    expect(limited.summary.analysisIncomplete).toBeGreaterThan(0)
    for (const candidate of limited.candidates.filter(c => c.puzzle)) {
      const m = candidate.puzzle!.research.mistakeRecovery
      expect(m.knownAlternativeCount + m.unknownCount).toBe(m.analyzedAlternatives)
      expect(m.wrongMoveCount).toBe(m.recoverableMistakeCount + m.deadEndCount)
    }
    validateLocalShard(limited)
  })
  it('ignores external run manifests and fails differing logical comparison', () => {
    const manifests = [{ elapsedMs: 1, hostname: 'mac' }, { elapsedMs: 999, hostname: 'windows' }]
    expect(manifests[0]).not.toEqual(manifests[1])
    expect(mergeLocalShards([run(0, 49), run(50, 99)]).digest).toBe(full.digest)
    expect(() => compareLocalShards(full, run(0, 98))).toThrow(/mismatch/)
  })
})

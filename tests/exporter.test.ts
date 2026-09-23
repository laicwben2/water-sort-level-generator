import { describe, expect, it } from 'vitest'
import { CANONICAL_VERSION, ENCODING_VERSION, canonicalPuzzleKey } from '../src/canonical'
import { exportRuntimePack, exportSolutionArtifact } from '../src/exporter'
import { deriveCandidateSeed, deriveLevelId } from '../src/rng'
import { analyzeSolutionPath, solveBoard } from '../src/solver'
import type { AuditCatalog } from '../src/types'
import { validateAuditCatalog } from '../src/validator'
import { GENERATOR_VERSION, RNG_VERSION, SOLVER_STATE_ENCODING_VERSION } from '../src/version'

const fixtureId = deriveLevelId('fixture-batch', 'test', 'easy', 2, 1)

function fixture(): AuditCatalog {
  const board = [[0, 1], [0, 1], []]
  const result = solveBoard(board, { capacity: 2 })
  if (result.status !== 'solved') throw new Error('fixture must solve')
  return {
    version: 'audit-v2',
    generator: 'balanced-shuffle+bounded-a-star',
    profile: 'test',
    reproducibility: {
      generatorVersion: GENERATOR_VERSION,
      rngVersion: RNG_VERSION,
      canonicalVersion: CANONICAL_VERSION,
      encodingVersion: ENCODING_VERSION,
      solverStateEncodingVersion: SOLVER_STATE_ENCODING_VERSION,
      batchSeed: 'fixture-batch',
      configFingerprint: 'fixture',
    },
    puzzles: [{
      id: fixtureId,
      difficulty: 'easy',
      candidateIndex: 1,
      candidateSeed: deriveCandidateSeed('fixture-batch', 'test', 'easy', 1),
      capacity: 2,
      emptyTubes: 1,
      minimumRequiredEmptyTubes: 1,
      board,
      optimalSolution: result.solution,
      canonicalKey: canonicalPuzzleKey(board),
      solver: { optimalMoves: result.solution.length, ...result.metrics },
      solutionPath: analyzeSolutionPath(board, result.solution, 2),
      emptyTubeAnalysis: [{
        emptyTubes: 1,
        status: 'solved',
        optimalMoves: result.solution.length,
        metrics: result.metrics,
      }],
    }],
  }
}

describe('catalog validation and exports', () => {
  it('validates audit data then strips full solutions from runtime packs', () => {
    const catalog = fixture()
    expect(validateAuditCatalog(catalog).valid).toBe(true)

    const runtime = exportRuntimePack(catalog, 'test-pack')
    expect(runtime.rulesVersion).toBe('classic-v1')
    expect(runtime.levels[0]).toEqual({
      id: fixtureId,
      difficulty: 'easy',
      capacity: 2,
      board: [[0, 1], [0, 1], []],
      metadata: { optimalMoves: catalog.puzzles[0].solver.optimalMoves },
    })
    expect(runtime.levels[0]).not.toHaveProperty('optimalSolution')
  })

  it('accepts reordered JSON fields while rejecting changed move and path values', () => {
    const catalog = fixture()
    const move = catalog.puzzles[0].optimalSolution[0]
    catalog.puzzles[0].optimalSolution[0] = {
      amount: move.amount,
      color: move.color,
      to: move.to,
      from: move.from,
    }
    const path = catalog.puzzles[0].solutionPath
    catalog.puzzles[0].solutionPath = Object.fromEntries(
      Object.entries(path).reverse(),
    ) as typeof path
    expect(validateAuditCatalog(catalog).valid).toBe(true)

    catalog.puzzles[0].optimalSolution[0].amount += 1
    expect(() => validateAuditCatalog(catalog)).toThrow(/Invalid saved move/)

    catalog.puzzles[0].optimalSolution[0].amount = move.amount
    catalog.puzzles[0].solutionPath.decisionSteps += 1
    expect(() => validateAuditCatalog(catalog)).toThrow(/Solution path metrics mismatch/)
  })
  it('validates internally consistent Difficulty v2 aggregate metrics', () => {
    const catalog = fixture()
    catalog.puzzles[0].mistakeAnalysis = {
      analyzedStates: 2,
      decisionStates: 1,
      alternatives: 4,
      optimalEquivalentAlternatives: 1,
      recoverableAlternatives: 1,
      deadEndAlternatives: 1,
      unknownAlternatives: 1,
      analysisCoverage: 3 / 4,
      alternativesPerAnalyzedState: 2,
      wrongMoveDensity: 2 / 3,
      deadEndDensity: 1 / 3,
      deadEndRisk: 1 / 2,
      averageRecoveryPenalty: 2,
      p50RecoveryPenalty: 2,
      p90RecoveryPenalty: 2,
      maxRecoveryPenalty: 2,
    }

    expect(validateAuditCatalog(catalog).valid).toBe(true)
  })

  it('rejects recovery penalties that disagree with recoverable counts', () => {
    const catalog = fixture()
    const metrics: NonNullable<AuditCatalog['puzzles'][number]['mistakeAnalysis']> = {
      analyzedStates: 1,
      decisionStates: 1,
      alternatives: 1,
      optimalEquivalentAlternatives: 0,
      recoverableAlternatives: 1,
      deadEndAlternatives: 0,
      unknownAlternatives: 0,
      analysisCoverage: 1,
      alternativesPerAnalyzedState: 1,
      wrongMoveDensity: 1,
      deadEndDensity: 0,
      deadEndRisk: 0,
      averageRecoveryPenalty: 1,
      p50RecoveryPenalty: 1,
      p90RecoveryPenalty: 1,
      maxRecoveryPenalty: 1,
    }
    catalog.puzzles[0].mistakeAnalysis = metrics
    expect(validateAuditCatalog(catalog).valid).toBe(true)

    metrics.recoverableAlternatives = 0
    metrics.optimalEquivalentAlternatives = 1
    metrics.wrongMoveDensity = 0
    expect(() => validateAuditCatalog(catalog)).toThrow(/Recovery penalty metrics disagree/)

    metrics.recoverableAlternatives = 1
    metrics.optimalEquivalentAlternatives = 0
    metrics.wrongMoveDensity = 1
    metrics.averageRecoveryPenalty = 2
    expect(() => validateAuditCatalog(catalog)).toThrow(/Recovery penalty metrics disagree/)
  })
  it('rejects inconsistent derived Difficulty v2 density metrics', () => {
    const catalog = fixture()
    catalog.puzzles[0].mistakeAnalysis = {
      analyzedStates: 2,
      decisionStates: 1,
      alternatives: 4,
      optimalEquivalentAlternatives: 1,
      recoverableAlternatives: 1,
      deadEndAlternatives: 1,
      unknownAlternatives: 1,
      analysisCoverage: 3 / 4,
      alternativesPerAnalyzedState: 2,
      wrongMoveDensity: 2 / 3,
      deadEndDensity: 0.9,
      deadEndRisk: 1 / 2,
      averageRecoveryPenalty: 2,
      p50RecoveryPenalty: 2,
      p90RecoveryPenalty: 2,
      maxRecoveryPenalty: 2,
    }

    expect(() => validateAuditCatalog(catalog)).toThrow(/Inconsistent deadEndDensity/)
  })

  it('rejects a level ID that disagrees with candidate metadata', () => {
    const catalog = fixture()
    catalog.puzzles[0].id = 'old-colliding-id'
    expect(() => validateAuditCatalog(catalog)).toThrow(/Level ID mismatch/)
  })

  it('rejects catalogs that cannot satisfy the runtime pack contract', () => {
    const empty = fixture()
    empty.puzzles = []
    expect(() => validateAuditCatalog(empty)).toThrow(/must contain puzzles/)

    const emptyId = fixture()
    emptyId.puzzles[0].id = ' '
    expect(() => validateAuditCatalog(emptyId)).toThrow(/id must not be empty/)

    const wrongDifficulty = fixture()
    wrongDifficulty.puzzles[0].difficulty = 'expert' as AuditCatalog['puzzles'][number]['difficulty']
    expect(() => validateAuditCatalog(wrongDifficulty)).toThrow(/Invalid difficulty/)
  })
  it('rejects a board that does not reproduce from its candidate seed', () => {
    const catalog = fixture()
    catalog.puzzles[0].board = [[0, 1], [1, 0], []]
    expect(() => validateAuditCatalog(catalog)).toThrow(/Candidate board mismatch/)
  })
  it('rejects unsupported capacities and Type IDs before export', () => {
    const wrongCapacity = fixture()
    wrongCapacity.puzzles[0].capacity = 5
    expect(() => validateAuditCatalog(wrongCapacity)).toThrow(/Unsupported capacity/)

    const wrongType = fixture()
    wrongType.puzzles[0].board[0][0] = 16
    expect(() => validateAuditCatalog(wrongType)).toThrow(/Invalid Type ID/)
  })
  it('rejects an inconsistent minimum-empty optimal move count', () => {
    const catalog = fixture()
    catalog.puzzles[0].emptyTubeAnalysis[0].optimalMoves = 99
    expect(() => validateAuditCatalog(catalog)).toThrow(/Minimum empty-tube optimal moves mismatch/)
  })
  it('rejects a candidate seed that disagrees with batch metadata', () => {
    const catalog = fixture()
    catalog.puzzles[0].candidateSeed = 'wrong-seed'
    expect(() => validateAuditCatalog(catalog)).toThrow(/Candidate seed mismatch/)
  })

  it('rejects Difficulty v2 counts that cannot fit the analyzed path', () => {
    const catalog = fixture()
    catalog.puzzles[0].mistakeAnalysis = {
      analyzedStates: 1,
      decisionStates: 0,
      alternatives: 1,
      optimalEquivalentAlternatives: 1,
      recoverableAlternatives: 0,
      deadEndAlternatives: 0,
      unknownAlternatives: 0,
      analysisCoverage: 1,
      alternativesPerAnalyzedState: 1,
      wrongMoveDensity: 0,
      deadEndDensity: 0,
      deadEndRisk: 0,
      averageRecoveryPenalty: 0,
      p50RecoveryPenalty: 0,
      p90RecoveryPenalty: 0,
      maxRecoveryPenalty: 0,
    }
    expect(() => validateAuditCatalog(catalog)).toThrow(/decision count disagrees with alternatives/)

    catalog.puzzles[0].mistakeAnalysis.analyzedStates = catalog.puzzles[0].optimalSolution.length + 1
    catalog.puzzles[0].mistakeAnalysis.decisionStates = 1
    catalog.puzzles[0].mistakeAnalysis.alternativesPerAnalyzedState =
      1 / catalog.puzzles[0].mistakeAnalysis.analyzedStates
    expect(() => validateAuditCatalog(catalog)).toThrow(/states exceed optimal path/)
  })
  it('rejects impossible Difficulty v2 raw counts', () => {
    const invalidCounts = [
      { analyzedStates: -1, alternatives: 0 },
      { analyzedStates: 0.5, alternatives: 0 },
      { analyzedStates: 0, alternatives: 1 },
    ]

    for (const counts of invalidCounts) {
      const catalog = fixture()
      catalog.puzzles[0].mistakeAnalysis = {
        analyzedStates: counts.analyzedStates,
        decisionStates: 0,
        alternatives: counts.alternatives,
        optimalEquivalentAlternatives: counts.alternatives,
        recoverableAlternatives: 0,
        deadEndAlternatives: 0,
        unknownAlternatives: 0,
        analysisCoverage: 1,
        alternativesPerAnalyzedState: 0,
        wrongMoveDensity: 0,
        deadEndDensity: 0,
        deadEndRisk: 0,
        averageRecoveryPenalty: 0,
        p50RecoveryPenalty: 0,
        p90RecoveryPenalty: 0,
        maxRecoveryPenalty: 0,
      }
      expect(() => validateAuditCatalog(catalog)).toThrow(/Invalid analyzedStates|alternatives without analyzed states/)
    }
  })

  it('exports a separate exact solution artifact', () => {
    const catalog = fixture()
    const artifact = exportSolutionArtifact(catalog)
    expect(artifact.solutions[0]).toEqual({
      id: fixtureId,
      optimalMoves: catalog.puzzles[0].solver.optimalMoves,
      optimalSolution: catalog.puzzles[0].optimalSolution,
    })
  })
})

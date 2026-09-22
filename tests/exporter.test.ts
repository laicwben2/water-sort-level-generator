import { describe, expect, it } from 'vitest'
import { CANONICAL_VERSION, ENCODING_VERSION, canonicalPuzzleKey } from '../src/canonical'
import { analyzeMistakes } from '../src/difficulty'
import { exportRuntimePack, exportSolutionArtifact } from '../src/exporter'
import { analyzeSolutionPath, solveBoard } from '../src/solver'
import type { AuditCatalog } from '../src/types'
import { validateAuditCatalog } from '../src/validator'
import { GENERATOR_VERSION, RNG_VERSION, SOLVER_STATE_ENCODING_VERSION } from '../src/version'

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
      id: 'fixture-1',
      difficulty: 'easy',
      candidateIndex: 0,
      candidateSeed: 'fixture-candidate',
      capacity: 2,
      emptyTubes: 1,
      minimumRequiredEmptyTubes: 1,
      board,
      optimalSolution: result.solution,
      canonicalKey: canonicalPuzzleKey(board),
      solver: { optimalMoves: result.solution.length, ...result.metrics },
      solutionPath: analyzeSolutionPath(board, result.solution, 2),
      difficultyV2: analyzeMistakes(board, result.solution, { capacity: 2 }),
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
      id: 'fixture-1',
      difficulty: 'easy',
      capacity: 2,
      board: [[0, 1], [0, 1], []],
      metadata: { optimalMoves: catalog.puzzles[0].solver.optimalMoves },
    })
    expect(runtime.levels[0]).not.toHaveProperty('optimalSolution')
  })

  it('exports a separate exact solution artifact', () => {
    const catalog = fixture()
    const artifact = exportSolutionArtifact(catalog)
    expect(artifact.solutions[0]).toEqual({
      id: 'fixture-1',
      optimalMoves: catalog.puzzles[0].solver.optimalMoves,
      optimalSolution: catalog.puzzles[0].optimalSolution,
    })
  })
})

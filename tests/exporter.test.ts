import { describe, expect, it } from 'vitest'
import { canonicalPuzzleKey } from '../src/canonical'
import { exportRuntimePack } from '../src/exporter'
import { analyzeSolutionPath, solveBoard } from '../src/solver'
import type { AuditCatalog } from '../src/types'
import { validateAuditCatalog } from '../src/validator'

function fixture(): AuditCatalog {
  const board = [[0, 1], [0, 1], [], []]
  const result = solveBoard(board, { capacity: 2 })
  if (result.status !== 'solved') throw new Error('fixture must solve')
  return {
    version: 'audit-v1',
    generator: 'balanced-shuffle+bounded-a-star',
    profile: 'test',
    puzzles: [{
      id: 'fixture-1',
      difficulty: 'easy',
      sourceSeed: 'fixture',
      capacity: 2,
      emptyTubes: 2,
      board,
      solution: result.solution,
      canonicalKey: canonicalPuzzleKey(board),
      solver: { minimumMoves: result.solution.length, ...result.metrics },
      solutionPath: analyzeSolutionPath(board, result.solution, 2),
      emptyTubeAnalysis: [{ emptyTubes: 2, status: 'solved', minimumMoves: result.solution.length, metrics: result.metrics }],
    }],
  }
}

describe('catalog validation and runtime export', () => {
  it('validates audit data then strips solver-only fields', () => {
    const catalog = fixture()
    expect(validateAuditCatalog(catalog).valid).toBe(true)
    const runtime = exportRuntimePack(catalog, 'test-pack')
    expect(runtime.rulesVersion).toBe('classic-v1')
    expect(runtime.levels[0]).toEqual({
      id: 'fixture-1',
      difficulty: 'easy',
      capacity: 2,
      board: [[0, 1], [0, 1], [], []],
      metadata: { optimalMoves: 3 },
    })
  })
})

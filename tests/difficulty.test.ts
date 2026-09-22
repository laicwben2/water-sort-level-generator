import { describe, expect, it } from 'vitest'
import {
  analyzeMistakesAlongOptimalPath,
  classifyAlternativeMove,
} from '../src/difficulty'
import { solveBoard } from '../src/solver'
import type { Board, Move } from '../src/types'

const benchmarkBoard: Board = [
  [2, 1, 1, 0],
  [0, 1, 0, 1],
  [3, 2, 3, 4],
  [3, 2, 4, 0],
  [4, 2, 4, 3],
  [],
  [],
]

describe('Difficulty v2 mistake analysis', () => {
  it('distinguishes optimal-equivalent and recoverable alternatives', () => {
    const result = solveBoard(benchmarkBoard, {
      capacity: 4,
      maxVisitedStates: 100_000,
      maxDepth: 100,
    })
    expect(result.status).toBe('solved')
    if (result.status !== 'solved') return
    expect(result.solution).toHaveLength(17)

    const equivalent: Move = { from: 1, to: 5, color: 1, amount: 1 }
    expect(classifyAlternativeMove(benchmarkBoard, equivalent, 17, {
      capacity: 4,
      maxVisitedStatesPerAlternative: 100_000,
      maxDepthPerAlternative: 100,
    })).toMatchObject({
      status: 'optimal-equivalent',
      recoveryPenalty: 0,
    })

    const recoverable: Move = { from: 4, to: 5, color: 3, amount: 1 }
    expect(classifyAlternativeMove(benchmarkBoard, recoverable, 17, {
      capacity: 4,
      maxVisitedStatesPerAlternative: 100_000,
      maxDepthPerAlternative: 100,
    })).toMatchObject({
      status: 'recoverable',
      recoveryPenalty: 1,
    })
  })

  it('recognizes a proven dead-end alternative', () => {
    const board: Board = [
      [2, 1, 1, 1],
      [0, 1],
      [3, 2, 3],
      [3, 2, 4, 4],
      [4, 2, 4, 3],
      [0, 0, 0],
      [],
    ]
    const deadEnd: Move = { from: 2, to: 6, color: 3, amount: 1 }

    expect(classifyAlternativeMove(board, deadEnd, 12, {
      capacity: 4,
      maxVisitedStatesPerAlternative: 100_000,
      maxDepthPerAlternative: 100,
    })).toEqual({ status: 'dead-end' })
  })

  it('records budget cutoffs as unknown', () => {
    const move: Move = { from: 4, to: 5, color: 3, amount: 1 }
    expect(classifyAlternativeMove(benchmarkBoard, move, 17, {
      capacity: 4,
      maxVisitedStatesPerAlternative: 0,
      maxDepthPerAlternative: 100,
    })).toEqual({
      status: 'unknown',
      reason: 'budget-exceeded',
    })
  })

  it('keeps ratios finite when there are no analyzed alternatives', () => {
    const metrics = analyzeMistakesAlongOptimalPath(
      [[0, 0], [1, 1], []],
      [],
      { capacity: 2 },
    )

    expect(metrics).toMatchObject({
      analyzedStates: 0,
      alternatives: 0,
      analysisCoverage: 1,
      wrongMoveDensity: 0,
      deadEndRisk: 0,
      averageRecoveryPenalty: 0,
    })
    expect(Object.values(metrics).every(Number.isFinite)).toBe(true)
  })

  it('rejects a stored path that is not legal', () => {
    expect(() => analyzeMistakesAlongOptimalPath(
      [[0, 1], [0, 1], [], []],
      [{ from: 0, to: 1, color: 1, amount: 1 }],
      { capacity: 2 },
    )).toThrow(/not legal/)
  })
})

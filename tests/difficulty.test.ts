import { describe, expect, it } from 'vitest'
import { analyzeMistakes } from '../src/difficulty'
import { solveBoard } from '../src/solver'
import type { Board } from '../src/types'

function optimalSolution(board: Board, capacity: number) {
  const result = solveBoard(board, {
    capacity,
    maxVisitedStates: 100_000,
    maxDepth: 100,
  })
  if (result.status !== 'solved') throw new Error('fixture must be solvable')
  return result.solution
}

describe('mistake and recovery analysis', () => {
  it('skips alternate solves for an initially forced state', () => {
    const board: Board = [[1, 0], [1, 0], [], []]
    const solution = optimalSolution(board, 2)
    const analysis = analyzeMistakes(board, solution, { capacity: 2 })

    expect(analysis.states[0].legalMoves).toBe(1)
    expect(analysis.states[0].alternatives).toHaveLength(0)
  })

  it('does not label another optimal next move as a mistake', () => {
    const board: Board = [[0, 1], [1, 0], [], []]
    const solution = optimalSolution(board, 2)
    const analysis = analyzeMistakes(board, solution, { capacity: 2 })

    expect(analysis.states[0].optimalAlternatives).toBeGreaterThanOrEqual(1)
    expect(analysis.states[0].recoveryPenalties).not.toContain(0)
  })

  it('measures an exact positive recovery penalty', () => {
    const board: Board = [[0, 2], [2, 1], [0, 1], [], []]
    const solution = optimalSolution(board, 2)
    const analysis = analyzeMistakes(board, solution, { capacity: 2 })

    expect(analysis.states[0].recoverableMistakes).toBeGreaterThanOrEqual(1)
    expect(analysis.states[0].recoveryPenalties).toContain(1)
    expect(analysis.recoverableMistakes).toBeGreaterThanOrEqual(1)
    expect(analysis.averageRecoveryPenalty).toBeGreaterThan(0)
  })

  it('labels a proven-unsolvable alternate move as a dead end', () => {
    const board: Board = [[0, 2], [2, 1], [0, 1], []]
    const solution = optimalSolution(board, 2)
    const analysis = analyzeMistakes(board, solution, { capacity: 2 })

    expect(analysis.states[0].deadEndMoves).toBe(1)
    expect(analysis.deadEndMoves).toBeGreaterThanOrEqual(1)
    expect(analysis.deadEndRatioKnown).toBeGreaterThan(0)
  })

  it('keeps budget-limited alternatives unknown', () => {
    const board: Board = [[0, 2], [2, 1], [0, 1], [], []]
    const solution = optimalSolution(board, 2)
    const analysis = analyzeMistakes(board, solution, {
      capacity: 2,
      maxVisitedStates: 1,
    })

    expect(analysis.unknownMoves).toBeGreaterThan(0)
  })

  it('uses a configurable high-penalty threshold', () => {
    const board: Board = [[0, 2], [2, 1], [0, 1], [], []]
    const solution = optimalSolution(board, 2)
    const analysis = analyzeMistakes(board, solution, {
      capacity: 2,
      highPenaltyThreshold: 1,
    })

    expect(analysis.highPenaltyMistakes).toBe(analysis.recoverableMistakes)
  })
})

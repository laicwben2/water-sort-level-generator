import { describe, expect, it } from 'vitest'
import { applyMove, isSolved } from '../src/rules'
import { analyzeSolutionPath, listLegalMoves, solveBoard } from '../src/solver'
import type { Board } from '../src/types'

describe('bounded water sort solver', () => {
  it('finds and replays a shortest solution', () => {
    const board: Board = [[0, 1], [0, 1], [], []]
    const result = solveBoard(board, { capacity: 2 })
    expect(result.status).toBe('solved')
    if (result.status !== 'solved') return
    expect(result.solution).toHaveLength(3)
    expect(isSolved(result.solution.reduce(applyMove, board), 2)).toBe(true)
  })

  it('separates unsolvable from budget-exceeded', () => {
    expect(solveBoard([[0, 1], [1, 0]], { capacity: 2 }).status).toBe('unsolvable')
    expect(solveBoard([[0, 1], [1, 0], [], []], { capacity: 2, maxVisitedStates: 0 }).status)
      .toBe('budget-exceeded')
  })

  it('collapses symmetric moves and reports path choices', () => {
    const board: Board = [[0, 1], [0, 1], [], []]
    expect(listLegalMoves(board, 2)).toHaveLength(1)
    const result = solveBoard(board, { capacity: 2 })
    if (result.status !== 'solved') throw new Error('expected solved')
    expect(analyzeSolutionPath(board, result.solution, 2).maximumChoices).toBe(2)
  })
})

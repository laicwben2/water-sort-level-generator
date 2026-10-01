import { describe, expect, it } from 'vitest'
import { solveBoardReference } from '../src/reference-solver'
import { applyMove, isSolved } from '../src/rules'
import { solveBoard } from '../src/solver'
import type { Board, Move } from '../src/types'

function replay(board: Board, moves: readonly Move[], capacity: number): Board {
  let current = board.map((tube) => [...tube])
  for (const move of moves) current = applyMove(current, move)
  return current
}

describe('reference BFS solver', () => {
  it('agrees with the production solver on every balanced two-Type capacity-2 arrangement', () => {
    const cells = [0, 0, 1, 1]
    const arrangements = new Set<string>()

    function permute(prefix: number[], remaining: number[]) {
      if (remaining.length === 0) {
        arrangements.add(prefix.join(','))
        return
      }
      for (let index = 0; index < remaining.length; index += 1) {
        const next = remaining[index]
        permute(
          [...prefix, next],
          remaining.filter((_, other) => other !== index),
        )
      }
    }

    permute([], cells)

    for (const encoded of arrangements) {
      const values = encoded.split(',').map(Number)
      const board: Board = [
        values.slice(0, 2),
        values.slice(2, 4),
        [],
      ]

      const reference = solveBoardReference(board, {
        capacity: 2,
        maxDepth: 20,
        maxVisitedStates: 20_000,
      })
      const production = solveBoard(board, {
        capacity: 2,
        maxDepth: 20,
        maxVisitedStates: 20_000,
      })

      expect(production.status).toBe(reference.status)
      if (reference.status === 'solved' && production.status === 'solved') {
        expect(production.solution).toHaveLength(reference.solution.length)
        expect(isSolved(replay(board, reference.solution, 2), 2)).toBe(true)
        expect(isSolved(replay(board, production.solution, 2), 2)).toBe(true)
      }
    }
  })

  it('agrees on an exhausted unsolvable board', () => {
    const board: Board = [[0, 1], [1, 0]]

    const reference = solveBoardReference(board, {
      capacity: 2,
      maxDepth: 20,
      maxVisitedStates: 20_000,
    })
    const production = solveBoard(board, {
      capacity: 2,
      maxDepth: 20,
      maxVisitedStates: 20_000,
    })

    expect(reference.status).toBe('unsolvable')
    expect(production.status).toBe(reference.status)
  })

  it('reports a resource cutoff as unknown rather than unsolvable', () => {
    const board: Board = [[0, 1], [1, 0], []]

    expect(solveBoardReference(board, {
      capacity: 2,
      maxDepth: 20,
      maxVisitedStates: 0,
    }).status).toBe('budget-exceeded')
  })
})

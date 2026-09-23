import { describe, expect, it } from 'vitest'
import { applyMove, calculatePour, isSolved } from '../src/rules'
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

  it('caps discovered visited states rather than only popped states', () => {
    const result = solveBoard([[0, 1], [0, 1], [], []], {
      capacity: 2,
      maxVisitedStates: 2,
      maxDepth: 20,
    })
    expect(result.status).toBe('budget-exceeded')
    expect(result.metrics.visitedStates).toBeLessThanOrEqual(2)
  })

  it('matches independent breadth-first shortest paths on small balanced layouts', () => {
    function checkLayouts(types: number, capacity: number, expectedLayouts: number) {
      const layouts: Board[] = []
      const counts = Array.from({ length: types }, () => 0)
      const cells: number[] = []

      function enumerate() {
        if (cells.length === types * capacity) {
          layouts.push([
            ...Array.from({ length: types }, (_, index) =>
              cells.slice(index * capacity, (index + 1) * capacity)),
            [],
          ])
          return
        }
        for (let type = 0; type < types; type += 1) {
          if (counts[type] === capacity) continue
          counts[type] += 1
          cells.push(type)
          enumerate()
          cells.pop()
          counts[type] -= 1
        }
      }

      function shortestByBfs(start: Board): number | undefined {
        const queue: Array<{ board: Board; depth: number }> = [{ board: start, depth: 0 }]
        const visited = new Set([JSON.stringify(start)])
        for (let index = 0; index < queue.length; index += 1) {
          const { board, depth } = queue[index]
          if (isSolved(board, capacity)) return depth
          for (let from = 0; from < board.length; from += 1) {
            for (let to = 0; to < board.length; to += 1) {
              const move = calculatePour(board, from, to, capacity)
              if (!move) continue
              const next = applyMove(board, move)
              const key = JSON.stringify(next)
              if (visited.has(key)) continue
              visited.add(key)
              queue.push({ board: next, depth: depth + 1 })
            }
          }
        }
        return undefined
      }

      enumerate()
      expect(layouts).toHaveLength(expectedLayouts)
      for (const board of layouts) {
        const shortest = shortestByBfs(board)
        const result = solveBoard(board, { capacity, maxDepth: 50, maxVisitedStates: 100_000 })
        if (shortest === undefined) {
          expect(result.status).toBe('unsolvable')
        } else {
          expect(result.status).toBe('solved')
          if (result.status === 'solved') expect(result.solution).toHaveLength(shortest)
        }
      }
    }

    checkLayouts(3, 2, 90)
    checkLayouts(2, 3, 20)
  })

  it('collapses symmetric moves and reports path choices', () => {
    const board: Board = [[0, 1], [0, 1], [], []]
    expect(listLegalMoves(board, 2)).toHaveLength(1)
    const result = solveBoard(board, { capacity: 2 })
    if (result.status !== 'solved') throw new Error('expected solved')
    expect(analyzeSolutionPath(board, result.solution, 2).maximumChoices).toBe(2)
  })
})

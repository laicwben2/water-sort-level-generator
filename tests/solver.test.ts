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

  it('matches independent breadth-first shortest paths on every three-Type layout', () => {
    const layouts: Board[] = []
    const counts = [0, 0, 0]
    const cells: number[] = []

    function enumerate() {
      if (cells.length === 6) {
        layouts.push([cells.slice(0, 2), cells.slice(2, 4), cells.slice(4, 6), []])
        return
      }
      for (let type = 0; type < 3; type += 1) {
        if (counts[type] === 2) continue
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
        if (isSolved(board, 2)) return depth
        for (let from = 0; from < board.length; from += 1) {
          for (let to = 0; to < board.length; to += 1) {
            const move = calculatePour(board, from, to, 2)
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
    expect(layouts).toHaveLength(90)
    for (const board of layouts) {
      const shortest = shortestByBfs(board)
      const result = solveBoard(board, { capacity: 2, maxDepth: 50, maxVisitedStates: 100_000 })
      if (shortest === undefined) {
        expect(result.status).toBe('unsolvable')
      } else {
        expect(result.status).toBe('solved')
        if (result.status === 'solved') expect(result.solution).toHaveLength(shortest)
      }
    }
  })
  it('collapses symmetric moves and reports path choices', () => {
    const board: Board = [[0, 1], [0, 1], [], []]
    expect(listLegalMoves(board, 2)).toHaveLength(1)
    const result = solveBoard(board, { capacity: 2 })
    if (result.status !== 'solved') throw new Error('expected solved')
    expect(analyzeSolutionPath(board, result.solution, 2).maximumChoices).toBe(2)
  })
})

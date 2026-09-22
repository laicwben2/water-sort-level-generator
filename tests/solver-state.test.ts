import { describe, expect, it } from 'vitest'
import { canonicalStateKey } from '../src/canonical'
import { applyMove, calculatePour, isSolved, topColor } from '../src/rules'
import {
  packBoard,
  packedIsSolved,
  packedStateKey,
  unpackBoard,
} from '../src/solver-state'
import { listLegalMoves } from '../src/solver'
import type { Board, Move } from '../src/types'

function legacyLegalMoves(board: Board, capacity: number): Move[] {
  const moves: Move[] = []
  const currentKey = canonicalStateKey(board)
  const seenNextStates = new Set<string>()

  for (let from = 0; from < board.length; from += 1) {
    if (board[from].length === 0) continue
    const seenTargets = new Set<string>()

    for (let to = 0; to < board.length; to += 1) {
      const targetSignature = board[to].join(',')
      if (seenTargets.has(targetSignature)) continue
      const move = calculatePour(board, from, to, capacity)
      if (!move) continue
      seenTargets.add(targetSignature)

      const nextKey = canonicalStateKey(applyMove(board, move))
      if (nextKey === currentKey || seenNextStates.has(nextKey)) continue
      seenNextStates.add(nextKey)
      moves.push(move)
    }
  }

  return moves.sort((first, second) => {
    const firstJoinsColor = topColor(board[first.to]) === first.color ? 1 : 0
    const secondJoinsColor = topColor(board[second.to]) === second.color ? 1 : 0
    return secondJoinsColor - firstJoinsColor
      || second.amount - first.amount
      || first.from - second.from
      || first.to - second.to
  })
}

describe('packed solver state', () => {
  it('round-trips partial and full tubes exactly', () => {
    const board: Board = [[0, 15, 0, 3], [7, 7], [], [12]]
    expect(unpackBoard(packBoard(board, 4), 4)).toEqual(board)
  })

  it('creates the same state key regardless of tube order', () => {
    const first = packBoard([[0, 1], [], [1, 0]], 2)
    const second = packBoard([[], [1, 0], [0, 1]], 2)
    expect(packedStateKey(first)).toBe(packedStateKey(second))
  })

  it('matches classic-v1 solved-state semantics', () => {
    const boards: Board[] = [
      [[0, 0], [1, 1], []],
      [[0, 1], [1, 0], []],
      [[0, 0], [1], []],
    ]
    for (const board of boards) {
      expect(packedIsSolved(packBoard(board, 2), 2)).toBe(isSolved(board, 2))
    }
  })

  it('matches legacy legal-move generation and symmetry pruning', () => {
    const boards: Board[] = [
      [[0, 1], [0, 1], [], []],
      [[0, 0, 1], [1, 2, 2], [2, 1, 0], [], []],
      [[0, 1, 2, 0], [2, 0, 1, 1], [2, 2, 0, 1], [], []],
      [[0, 0], [1], [1], [], []],
    ]

    for (const board of boards) {
      expect(listLegalMoves(board, 4)).toEqual(legacyLegalMoves(board, 4))
    }
  })
})

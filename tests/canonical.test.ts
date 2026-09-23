import { describe, expect, it } from 'vitest'
import {
  canonicalPuzzleKey,
  canonicalPuzzleSequence,
  canonicalStateKey,
  encodeCanonicalTube,
} from '../src/canonical'

describe('canonical representation', () => {
  it('ignores tube order for solver states', () => {
    expect(canonicalStateKey([[0, 1], [], [1, 0]])).toBe(canonicalStateKey([[], [1, 0], [0, 1]]))
  })

  it('ignores both tube order and type names across puzzles', () => {
    const first = [[0, 1, 0, 2], [2, 1, 2, 0], [1, 0, 1, 2], []]
    const second = [[], [8, 4, 8, 7], [7, 4, 7, 8], [4, 8, 4, 7]]
    expect(canonicalPuzzleKey(first)).toBe(canonicalPuzzleKey(second))
  })

  it('does not collapse distinct cross-tube type relationships', () => {
    // Every individual full tube has the same local ABAB pattern after
    // per-tube normalization, but these two puzzles have different global
    // incidence structures.
    const disconnectedPairs = [
      [0, 1, 0, 1],
      [0, 1, 0, 1],
      [2, 3, 2, 3],
      [2, 3, 2, 3],
      [],
      [],
    ]
    const interlockedPairs = [
      [0, 1, 0, 1],
      [0, 2, 0, 2],
      [1, 3, 1, 3],
      [2, 3, 2, 3],
      [],
      [],
    ]

    expect(canonicalPuzzleKey(disconnectedPairs)).not.toBe(canonicalPuzzleKey(interlockedPairs))
  })

  it('treats repeated identical and empty tubes as a multiset', () => {
    const first = [[5, 6, 5, 6], [], [5, 6, 5, 6], []]
    const second = [[], [9, 3, 9, 3], [], [9, 3, 9, 3]]
    expect(canonicalPuzzleKey(first)).toBe(canonicalPuzzleKey(second))
  })

  it('produces deterministic uint64-backed sequences', () => {
    const board = [[3, 8, 3, 5], [5, 8, 5, 3], [], []]
    expect(canonicalPuzzleSequence(board)).toEqual(canonicalPuzzleSequence(board))
    expect(encodeCanonicalTube([0, 1, 0, 2])).toBeTypeOf('bigint')
  })

  it('is invariant across all tube and type permutations of a small puzzle', () => {
    const base = [
      [0, 1, 2, 0],
      [2, 0, 1, 1],
      [2, 2, 0, 1],
      [],
    ]

    function permutations<T>(items: readonly T[]): T[][] {
      if (items.length <= 1) return [Array.from(items)]
      return items.flatMap((item, index) =>
        permutations(items.filter((_, other) => other !== index))
          .map((suffix) => [item, ...suffix]))
    }

    const expected = canonicalPuzzleKey(base)
    for (const tubeOrder of permutations([0, 1, 2, 3])) {
      for (const typeOrder of permutations([0, 1, 2])) {
        const renamed = tubeOrder.map((tubeIndex) =>
          base[tubeIndex].map((type) => typeOrder[type] + 10))
        expect(canonicalPuzzleKey(renamed)).toBe(expected)
      }
    }
  })

  it('matches exhaustive tube-order search on every small three-tube board', () => {
    const orders = [
      [0, 1, 2], [0, 2, 1], [1, 0, 2],
      [1, 2, 0], [2, 0, 1], [2, 1, 0],
    ]

    function exhaustiveSequence(board: number[][]): bigint[] {
      let best: bigint[] | undefined
      for (const order of orders) {
        const mapping = new Map<number, number>()
        const sequence = order.map((tubeIndex) => {
          const normalized = board[tubeIndex].map((type) => {
            let canonical = mapping.get(type)
            if (canonical === undefined) {
              canonical = mapping.size
              mapping.set(type, canonical)
            }
            return canonical
          })
          return encodeCanonicalTube(normalized)
        })
        if (!best) {
          best = sequence
          continue
        }
        for (let index = 0; index < sequence.length; index += 1) {
          if (sequence[index] < best[index]) {
            best = sequence
            break
          }
          if (sequence[index] > best[index]) break
        }
      }
      return best!
    }

    for (let code = 0; code < 3 ** 6; code += 1) {
      let digits = code
      const cells = Array.from({ length: 6 }, () => {
        const type = digits % 3
        digits = Math.floor(digits / 3)
        return type
      })
      const board = [cells.slice(0, 2), cells.slice(2, 4), cells.slice(4, 6)]
      expect(canonicalPuzzleSequence(board)).toEqual(exhaustiveSequence(board))
    }
  })
  it('handles sixteen isolated Types without exploring equivalent branches', () => {
    const board = [
      ...Array.from({ length: 16 }, (_, type) => [type, type, type, type]),
      [],
      [],
    ]
    const reordered = board.slice().reverse().map((tube) =>
      tube.map((type) => 100 + 15 - type))

    expect(canonicalPuzzleKey(board)).toBe(canonicalPuzzleKey(reordered))
  })
  it('supports sixteen abstract types without factorial type permutations', () => {
    const board = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 10, 11],
      [12, 13, 14, 15],
      [],
    ]
    expect(canonicalPuzzleSequence(board)).toHaveLength(5)
  })
})

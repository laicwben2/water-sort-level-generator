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

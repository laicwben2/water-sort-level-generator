import { describe, expect, it } from 'vitest'
import { canonicalPuzzleKey, canonicalStateKey } from '../src/canonical'

describe('canonical representation', () => {
  it('ignores tube order for solver states', () => {
    expect(canonicalStateKey([[0, 1], [], [1, 0]])).toBe(canonicalStateKey([[], [1, 0], [0, 1]]))
  })

  it('ignores both tube order and color names across puzzles', () => {
    const first = [[0, 1, 0, 2], [2, 1, 2, 0], [1, 0, 1, 2], []]
    const second = [[], [8, 4, 8, 7], [7, 4, 7, 8], [4, 8, 4, 7]]
    expect(canonicalPuzzleKey(first)).toBe(canonicalPuzzleKey(second))
  })
})

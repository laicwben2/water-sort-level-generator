import { describe, expect, it } from 'vitest'
import { canonicalPuzzleKey } from '../src/canonical'
import { arePuzzlesEquivalent } from '../src/puzzle-equivalence'

describe('independent puzzle equivalence', () => {
  it('accepts global Type renaming and tube reordering', () => {
    const first = [[0, 1, 0, 2], [2, 1, 2, 0], [1, 0, 1, 2], []]
    const equivalent = [[], [8, 4, 8, 7], [7, 4, 7, 8], [4, 8, 4, 7]]

    expect(arePuzzlesEquivalent(first, equivalent)).toBe(true)
  })

  it('rejects distinct cross-tube Type relationships', () => {
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

    expect(arePuzzlesEquivalent(disconnectedPairs, interlockedPairs)).toBe(false)
  })

  it('agrees with canonical identity across every small binary three-tube board pair', () => {
    const boards = Array.from({ length: 2 ** 6 }, (_, code) => {
      const cells = Array.from({ length: 6 }, (_, bit) => (code >>> bit) & 1)
      return [
        cells.slice(0, 2),
        cells.slice(2, 4),
        cells.slice(4, 6),
      ]
    })
    const keys = boards.map(canonicalPuzzleKey)

    for (let first = 0; first < boards.length; first += 1) {
      for (let second = 0; second < boards.length; second += 1) {
        expect(arePuzzlesEquivalent(boards[first], boards[second]))
          .toBe(keys[first] === keys[second])
      }
    }
  })
})

import { describe, expect, it } from 'vitest'
import { canonicalPuzzleKey } from '../src/canonical'
import {
  PUZZLE_ID_VERSION,
  derivePuzzleId,
  derivePuzzleIdFromCanonicalKey,
} from '../src/identity'

describe('stable puzzle identity', () => {
  it('is invariant under tube reorder and global Type rename', () => {
    const first = [
      [0, 1, 0, 2],
      [2, 1, 2, 0],
      [1, 0, 1, 2],
      [],
    ]
    const equivalent = [
      [],
      [8, 4, 8, 7],
      [7, 4, 7, 8],
      [4, 8, 4, 7],
    ]

    expect(derivePuzzleId(first)).toBe(derivePuzzleId(equivalent))
  })

  it('changes when the structural puzzle changes', () => {
    const first = [[0, 1], [1, 0], []]
    const second = [[0, 0], [1, 1], []]

    expect(derivePuzzleId(first)).not.toBe(derivePuzzleId(second))
  })

  it('namespaces identity by rules version', () => {
    const board = [[0, 1], [1, 0], []]
    const key = canonicalPuzzleKey(board)

    expect(derivePuzzleIdFromCanonicalKey(key, 2, 'classic-v1'))
      .not.toBe(derivePuzzleIdFromCanonicalKey(key, 2, 'classic-v2'))
  })

  it('namespaces identity by capacity', () => {
    const board = [[0, 1], [1, 0], []]
    const key = canonicalPuzzleKey(board)

    expect(derivePuzzleIdFromCanonicalKey(key, 2))
      .not.toBe(derivePuzzleIdFromCanonicalKey(key, 4))
  })

  it('is deterministic and explicitly versioned', () => {
    const board = [[0, 1], [1, 0], []]
    const first = derivePuzzleId(board)
    const second = derivePuzzleId(board)

    expect(first).toBe(second)
    expect(first).toContain('ws-p1-classic-v1-k4-')
    expect(PUZZLE_ID_VERSION).toBe('puzzle-id-v1')
  })
})

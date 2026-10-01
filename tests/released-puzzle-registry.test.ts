import { describe, expect, it } from 'vitest'
import { canonicalPuzzleKey } from '../src/canonical'
import { derivePuzzleIdFromCanonicalKey } from '../src/identity'
import {
  inspectReleaseCandidate,
  validateReleasedPuzzleRegistry,
  type RegistryReleaseEvent,
  type ReleasedPuzzleRegistry,
} from '../src/released-puzzle-registry'
import type { Board } from '../src/types'

function release(
  sequence: number,
  board: Board,
  capacity = 2,
  rulesVersion = 'classic-v1',
  packId = 'pack-a',
): RegistryReleaseEvent {
  const canonicalKey = canonicalPuzzleKey(board)
  return {
    sequence,
    type: 'release',
    puzzleId: derivePuzzleIdFromCanonicalKey(canonicalKey, capacity, rulesVersion),
    rulesVersion,
    capacity,
    canonicalKey,
    board,
    packId,
  }
}

describe('released puzzle registry', () => {
  it('replays release, withdrawal, and reinstatement as an append-only state machine', () => {
    const board: Board = [[0, 1], [1, 0], []]
    const first = release(0, board)
    const registry: ReleasedPuzzleRegistry = {
      formatVersion: 1,
      events: [
        first,
        { sequence: 1, type: 'withdrawal', puzzleId: first.puzzleId, reason: 'test' },
        { sequence: 2, type: 'reinstatement', puzzleId: first.puzzleId, packId: 'pack-b' },
      ],
    }

    const result = validateReleasedPuzzleRegistry(registry)
    expect(result.valid).toBe(true)
    expect(result.puzzles.get(first.puzzleId)?.status).toBe('active')
  })

  it('finds an equivalent released puzzle despite tube reorder and Type rename', () => {
    const original: Board = [[0, 1], [1, 0], []]
    const equivalent: Board = [[], [8, 4], [4, 8]]
    const first = release(0, original)
    const registry: ReleasedPuzzleRegistry = { formatVersion: 1, events: [first] }

    const candidate = inspectReleaseCandidate(registry, equivalent, 2)
    expect(candidate.puzzleId).toBe(first.puzzleId)
    expect(candidate.equivalentRelease?.puzzleId).toBe(first.puzzleId)
  })

  it('keeps withdrawn identities reserved against republishing as a new puzzle', () => {
    const original: Board = [[0, 1], [1, 0], []]
    const equivalent: Board = [[], [8, 4], [4, 8]]
    const first = release(0, original)
    const registry: ReleasedPuzzleRegistry = {
      formatVersion: 1,
      events: [
        first,
        { sequence: 1, type: 'withdrawal', puzzleId: first.puzzleId },
      ],
    }

    const candidate = inspectReleaseCandidate(registry, equivalent, 2)
    expect(candidate.equivalentRelease?.puzzleId).toBe(first.puzzleId)
  })

  it('rejects invalid event transitions and sequence gaps', () => {
    const board: Board = [[0, 1], [1, 0], []]
    const first = release(0, board)

    expect(() => validateReleasedPuzzleRegistry({
      formatVersion: 1,
      events: [{ ...first, sequence: 1 }],
    })).toThrow(/sequence mismatch/)

    expect(() => validateReleasedPuzzleRegistry({
      formatVersion: 1,
      events: [
        first,
        { sequence: 1, type: 'reinstatement', puzzleId: first.puzzleId, packId: 'pack-b' },
      ],
    })).toThrow(/non-withdrawn/)
  })

  it('allows the same structural board to be a different identity under another rules version or capacity', () => {
    const board: Board = [[0, 1], [1, 0], []]
    const first = release(0, board, 2, 'classic-v1')
    const secondRules = release(1, board, 2, 'classic-v2', 'pack-b')
    const secondCapacity = release(2, board, 4, 'classic-v1', 'pack-c')

    expect(() => validateReleasedPuzzleRegistry({
      formatVersion: 1,
      events: [first, secondRules, secondCapacity],
    })).not.toThrow()
    expect(first.puzzleId).not.toBe(secondRules.puzzleId)
    expect(first.puzzleId).not.toBe(secondCapacity.puzzleId)
  })
})

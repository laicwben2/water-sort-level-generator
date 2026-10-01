import { canonicalPuzzleKey } from './canonical'
import { derivePuzzleIdFromCanonicalKey } from './identity'
import { arePuzzlesEquivalent } from './puzzle-equivalence'
import type { Board } from './types'
import { RULES_VERSION } from './version'

export interface RegistryReleaseEvent {
  sequence: number
  type: 'release'
  puzzleId: string
  rulesVersion: string
  capacity: number
  canonicalKey: string
  board: Board
  packId: string
}

export interface RegistryWithdrawalEvent {
  sequence: number
  type: 'withdrawal'
  puzzleId: string
  reason?: string
}

export interface RegistryReinstatementEvent {
  sequence: number
  type: 'reinstatement'
  puzzleId: string
  packId: string
}

export type RegistryEvent =
  | RegistryReleaseEvent
  | RegistryWithdrawalEvent
  | RegistryReinstatementEvent

export interface ReleasedPuzzleRegistry {
  formatVersion: 1
  events: RegistryEvent[]
}

export interface RegistryPuzzleState {
  release: RegistryReleaseEvent
  status: 'active' | 'withdrawn'
}

export interface RegistryValidationResult {
  valid: true
  puzzles: Map<string, RegistryPuzzleState>
}

function assertNonEmpty(value: string, name: string, sequence: number): void {
  if (!value.trim()) throw new Error(`${name} must not be empty at registry event ${sequence}`)
}

function assertCapacity(capacity: number, sequence: number): void {
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 4) {
    throw new Error(`Unsupported capacity at registry event ${sequence}`)
  }
}

function releaseEvents(registry: ReleasedPuzzleRegistry): RegistryReleaseEvent[] {
  return registry.events.filter((event): event is RegistryReleaseEvent => event.type === 'release')
}

export function findEquivalentReleasedPuzzle(
  registry: ReleasedPuzzleRegistry,
  board: Board,
  capacity: number,
  rulesVersion: string = RULES_VERSION,
): RegistryReleaseEvent | undefined {
  return releaseEvents(registry).find((release) =>
    release.rulesVersion === rulesVersion
    && release.capacity === capacity
    && arePuzzlesEquivalent(release.board, board))
}

export function validateReleasedPuzzleRegistry(
  registry: ReleasedPuzzleRegistry,
): RegistryValidationResult {
  if (registry.formatVersion !== 1) {
    throw new Error(`Unsupported registry format version: ${registry.formatVersion}`)
  }

  const puzzles = new Map<string, RegistryPuzzleState>()
  const priorReleases: RegistryReleaseEvent[] = []

  for (let index = 0; index < registry.events.length; index += 1) {
    const event = registry.events[index]
    if (event.sequence !== index) {
      throw new Error(`Registry sequence mismatch at index ${index}`)
    }

    if (event.type === 'release') {
      assertNonEmpty(event.puzzleId, 'puzzleId', event.sequence)
      assertNonEmpty(event.rulesVersion, 'rulesVersion', event.sequence)
      assertNonEmpty(event.packId, 'packId', event.sequence)
      assertCapacity(event.capacity, event.sequence)
      if (puzzles.has(event.puzzleId)) {
        throw new Error(`Puzzle already has a first release: ${event.puzzleId}`)
      }

      const canonicalKey = canonicalPuzzleKey(event.board)
      if (event.canonicalKey !== canonicalKey) {
        throw new Error(`Registry canonical key mismatch: ${event.puzzleId}`)
      }
      const expectedPuzzleId = derivePuzzleIdFromCanonicalKey(
        canonicalKey,
        event.capacity,
        event.rulesVersion,
      )
      if (event.puzzleId !== expectedPuzzleId) {
        throw new Error(`Registry puzzle ID mismatch: ${event.puzzleId}`)
      }

      const equivalent = priorReleases.find((release) =>
        release.rulesVersion === event.rulesVersion
        && release.capacity === event.capacity
        && arePuzzlesEquivalent(release.board, event.board))
      if (equivalent) {
        throw new Error(
          `Equivalent puzzle already released as ${equivalent.puzzleId}; cannot first-release ${event.puzzleId}`,
        )
      }

      priorReleases.push(event)
      puzzles.set(event.puzzleId, { release: event, status: 'active' })
      continue
    }

    const state = puzzles.get(event.puzzleId)
    if (!state) throw new Error(`Registry event references unknown puzzle: ${event.puzzleId}`)

    if (event.type === 'withdrawal') {
      if (state.status !== 'active') {
        throw new Error(`Cannot withdraw non-active puzzle: ${event.puzzleId}`)
      }
      puzzles.set(event.puzzleId, { ...state, status: 'withdrawn' })
      continue
    }

    assertNonEmpty(event.packId, 'packId', event.sequence)
    if (state.status !== 'withdrawn') {
      throw new Error(`Cannot reinstate non-withdrawn puzzle: ${event.puzzleId}`)
    }
    puzzles.set(event.puzzleId, { ...state, status: 'active' })
  }

  return { valid: true, puzzles }
}

export interface ReleaseCandidateIdentity {
  puzzleId: string
  canonicalKey: string
  equivalentRelease?: RegistryReleaseEvent
}

export function inspectReleaseCandidate(
  registry: ReleasedPuzzleRegistry,
  board: Board,
  capacity: number,
  rulesVersion: string = RULES_VERSION,
): ReleaseCandidateIdentity {
  validateReleasedPuzzleRegistry(registry)
  const canonicalKey = canonicalPuzzleKey(board)
  const puzzleId = derivePuzzleIdFromCanonicalKey(canonicalKey, capacity, rulesVersion)

  const direct = releaseEvents(registry).find((release) => release.puzzleId === puzzleId)
  const equivalentRelease = direct ?? findEquivalentReleasedPuzzle(
    registry,
    board,
    capacity,
    rulesVersion,
  )

  return {
    puzzleId,
    canonicalKey,
    ...(equivalentRelease ? { equivalentRelease } : {}),
  }
}

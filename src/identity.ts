import { createHash } from 'node:crypto'
import { canonicalPuzzleKey } from './canonical'
import type { Board } from './types'
import { RULES_VERSION } from './version'

export const PUZZLE_ID_VERSION = 'puzzle-id-v1' as const

function assertIdentityComponent(value: string, name: string): void {
  if (!value.trim()) throw new Error(`${name} must not be empty`)
}

function assertCapacity(capacity: number): void {
  if (!Number.isSafeInteger(capacity) || capacity < 1) {
    throw new Error('capacity must be a positive safe integer')
  }
}

export function derivePuzzleIdFromCanonicalKey(
  canonicalKey: string,
  capacity = 4,
  rulesVersion: string = RULES_VERSION,
): string {
  assertIdentityComponent(canonicalKey, 'canonicalKey')
  assertIdentityComponent(rulesVersion, 'rulesVersion')
  assertCapacity(capacity)

  const digest = createHash('sha256')
    .update(PUZZLE_ID_VERSION, 'utf8')
    .update('\0', 'utf8')
    .update(rulesVersion, 'utf8')
    .update('\0', 'utf8')
    .update(String(capacity), 'utf8')
    .update('\0', 'utf8')
    .update(canonicalKey, 'utf8')
    .digest('hex')

  return `ws-p1-${rulesVersion}-k${capacity}-${digest}`
}

export function derivePuzzleId(
  board: Board,
  capacity = 4,
  rulesVersion: string = RULES_VERSION,
): string {
  return derivePuzzleIdFromCanonicalKey(canonicalPuzzleKey(board), capacity, rulesVersion)
}

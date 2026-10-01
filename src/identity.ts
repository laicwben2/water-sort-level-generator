import { createHash } from 'node:crypto'
import { canonicalPuzzleKey } from './canonical'
import type { Board } from './types'
import { RULES_VERSION } from './version'

export const PUZZLE_ID_VERSION = 'puzzle-id-v1' as const

function assertIdentityComponent(value: string, name: string): void {
  if (!value.trim()) throw new Error(`${name} must not be empty`)
}

export function derivePuzzleIdFromCanonicalKey(
  canonicalKey: string,
  rulesVersion: string = RULES_VERSION,
): string {
  assertIdentityComponent(canonicalKey, 'canonicalKey')
  assertIdentityComponent(rulesVersion, 'rulesVersion')

  const digest = createHash('sha256')
    .update(PUZZLE_ID_VERSION, 'utf8')
    .update('\0', 'utf8')
    .update(rulesVersion, 'utf8')
    .update('\0', 'utf8')
    .update(canonicalKey, 'utf8')
    .digest('hex')

  return `ws-p1-${rulesVersion}-${digest}`
}

export function derivePuzzleId(
  board: Board,
  rulesVersion: string = RULES_VERSION,
): string {
  return derivePuzzleIdFromCanonicalKey(canonicalPuzzleKey(board), rulesVersion)
}

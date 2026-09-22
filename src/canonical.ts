import type { Board, Tube } from './types'

export const ENCODING_VERSION = 'tube64-v1' as const
export const CANONICAL_VERSION = 'tube-order-v2' as const
export const MAX_CANONICAL_TYPES = 16
export const MAX_TUBE_CAPACITY = 4

const TYPE_BITS = 4n
const CONTENT_BITS = BigInt(MAX_TUBE_CAPACITY) * TYPE_BITS
const LENGTH_SHIFT = CONTENT_BITS

function assertSupportedTube(tube: readonly number[]) {
  if (tube.length > MAX_TUBE_CAPACITY) {
    throw new Error(`tube64-v1 supports capacity <= ${MAX_TUBE_CAPACITY}, got ${tube.length}`)
  }
}

function rawTubeKey(tube: readonly number[]): string {
  return tube.join(',')
}

function compareBigIntSequences(first: readonly bigint[], second: readonly bigint[]): number {
  const length = Math.min(first.length, second.length)
  for (let index = 0; index < length; index += 1) {
    if (first[index] < second[index]) return -1
    if (first[index] > second[index]) return 1
  }
  return first.length - second.length
}

function encodeWithMapping(
  tube: readonly number[],
  mapping: ReadonlyMap<number, number>,
  nextType: number,
): {
  encoded: bigint
  mapping: Map<number, number>
  nextType: number
} {
  assertSupportedTube(tube)

  const nextMapping = new Map(mapping)
  let nextCanonicalType = nextType
  let content = 0n

  for (const rawType of tube) {
    let canonicalType = nextMapping.get(rawType)
    if (canonicalType === undefined) {
      if (nextCanonicalType >= MAX_CANONICAL_TYPES) {
        throw new Error(`tube64-v1 supports at most ${MAX_CANONICAL_TYPES} types`)
      }
      canonicalType = nextCanonicalType
      nextMapping.set(rawType, canonicalType)
      nextCanonicalType += 1
    }
    content = (content << TYPE_BITS) | BigInt(canonicalType)
  }

  // Keep the first (bottom) cell most significant within the fixed 16-bit
  // content field so numeric order matches bottom-to-top lexicographic order.
  const missingCells = MAX_TUBE_CAPACITY - tube.length
  content <<= BigInt(missingCells) * TYPE_BITS

  return {
    encoded: (BigInt(tube.length) << LENGTH_SHIFT) | content,
    mapping: nextMapping,
    nextType: nextCanonicalType,
  }
}

function stateMemoKey(
  remaining: readonly Tube[],
  mapping: ReadonlyMap<number, number>,
  nextType: number,
): string {
  const tubes = remaining.map(rawTubeKey).sort().join('|')
  const mapped = [...mapping.entries()]
    .sort(([first], [second]) => first - second)
    .map(([raw, canonical]) => `${raw}:${canonical}`)
    .join(',')
  return `${nextType}#${mapped}#${tubes}`
}

export function encodeCanonicalTube(
  canonicalTypes: readonly number[],
): bigint {
  const mapping = new Map<number, number>()
  for (const type of canonicalTypes) {
    if (!Number.isInteger(type) || type < 0 || type >= MAX_CANONICAL_TYPES) {
      throw new Error(`canonical type must be an integer in 0..${MAX_CANONICAL_TYPES - 1}`)
    }
    mapping.set(type, type)
  }
  return encodeWithMapping(canonicalTypes, mapping, mapping.size).encoded
}

export function canonicalPuzzleSequence(board: Board): bigint[] {
  const memo = new Map<string, bigint[]>()

  function search(
    remaining: Tube[],
    mapping: ReadonlyMap<number, number>,
    nextType: number,
  ): bigint[] {
    if (remaining.length === 0) return []

    const memoKey = stateMemoKey(remaining, mapping, nextType)
    const memoized = memo.get(memoKey)
    if (memoized) return memoized

    const candidates = remaining.map((tube, index) => ({
      index,
      tube,
      ...encodeWithMapping(tube, mapping, nextType),
    }))

    let minimum = candidates[0].encoded
    for (const candidate of candidates.slice(1)) {
      if (candidate.encoded < minimum) minimum = candidate.encoded
    }

    // Exact duplicate raw tubes are interchangeable. Distinct raw tubes that
    // merely encode to the same value must still branch because they can
    // establish different global type mappings for later tubes.
    const seenRawTubes = new Set<string>()
    let best: bigint[] | undefined

    for (const candidate of candidates) {
      if (candidate.encoded !== minimum) continue
      const rawKey = rawTubeKey(candidate.tube)
      if (seenRawTubes.has(rawKey)) continue
      seenRawTubes.add(rawKey)

      const nextRemaining = remaining.filter((_, index) => index !== candidate.index)
      const suffix = search(nextRemaining, candidate.mapping, candidate.nextType)
      const sequence = [candidate.encoded, ...suffix]

      if (best === undefined || compareBigIntSequences(sequence, best) < 0) {
        best = sequence
      }
    }

    const result = best ?? []
    memo.set(memoKey, result)
    return result
  }

  return search(board.map((tube) => [...tube]), new Map(), 0)
}

export function canonicalPuzzleKeyFromSequence(sequence: readonly bigint[]): string {
  return `${CANONICAL_VERSION}:${ENCODING_VERSION}:${sequence
    .map((value) => value.toString(16).padStart(16, '0'))
    .join('.')}`
}

export function canonicalPuzzleKey(board: Board): string {
  return canonicalPuzzleKeyFromSequence(canonicalPuzzleSequence(board))
}

function encodeTubeForState(tube: readonly number[]): string {
  return tube.join(',')
}

export function canonicalStateKey(board: Board): string {
  // Solver-state identity keeps type IDs stable within one search and only
  // removes tube-order symmetry. Puzzle-level type-renaming symmetry is handled
  // separately by canonicalPuzzleKey().
  return board.map(encodeTubeForState).sort().join('|')
}

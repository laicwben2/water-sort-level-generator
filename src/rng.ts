import { GENERATOR_VERSION, RNG_VERSION, RULES_VERSION } from './version'

export { RNG_VERSION }

export function hashSeed(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createRng(seed: string): () => number {
  let state = hashSeed(`${RNG_VERSION}:${seed}`) || 0x6d2b79f5
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function deriveCandidateSeed(
  batchSeed: string,
  profile: string,
  difficulty: string,
  candidateIndex: number,
): string {
  if (!Number.isSafeInteger(candidateIndex) || candidateIndex < 0) {
    throw new Error('candidateIndex must be a non-negative safe integer')
  }
  return [
    'water-sort',
    'candidate',
    RNG_VERSION,
    batchSeed,
    profile,
    difficulty,
    String(candidateIndex),
  ].join(':')
}

export function deriveLevelId(
  batchSeed: string,
  profile: string,
  difficulty: string,
  capacity: number,
  candidateIndex: number,
): string {
  if (!Number.isSafeInteger(candidateIndex) || candidateIndex < 0) {
    throw new Error('candidateIndex must be a non-negative safe integer')
  }
  const encodedBatchSeed = Buffer.from(batchSeed, 'utf16le').toString('base64url')
  return [
    `ws-g${GENERATOR_VERSION}-r${RNG_VERSION}-u${RULES_VERSION}`,
    `b${encodedBatchSeed}`,
    profile,
    difficulty,
    `k${capacity}`,
    `c${String(candidateIndex).padStart(6, '0')}`,
  ].join('.')
}

export function fingerprintConfig(config: unknown): string {
  const serialized = JSON.stringify(config)
  return hashSeed(`${RNG_VERSION}:${serialized}`).toString(16).padStart(8, '0')
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[next[index], next[other]] = [next[other], next[index]]
  }
  return next
}

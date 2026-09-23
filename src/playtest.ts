export interface PlaytestResultEntry {
  benchmarkId: string
  outcome: 'solved' | 'gave-up'
  elapsedMs: number
  moves: number
  restarts: number
  perceivedDifficulty: number
  confidence?: number
  frustration?: number
}

export interface PlaytestResults {
  version: 'difficulty-v2-playtest-results-v1'
  benchmark: string
  exportedAt: string
  results: PlaytestResultEntry[]
}

export interface PlaytestValidationSummary {
  valid: true
  benchmark: string
  results: number
  solved: number
  gaveUp: number
}

function assertRecord(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`)
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  name: string,
): void {
  const allowedSet = new Set(allowed)
  const unexpected = Object.keys(value).find((key) => !allowedSet.has(key))
  if (unexpected !== undefined) {
    throw new Error(`Unexpected ${name} field: ${unexpected}`)
  }
}

function assertNonNegativeSafeInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`)
  }
}

function assertRating(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 5) {
    throw new Error(`${name} must be an integer from 1 to 5`)
  }
}

export function validatePlaytestResults(
  data: unknown,
  expectedBenchmark: string,
  allowedBenchmarkIds: ReadonlySet<string>,
): PlaytestValidationSummary {
  assertRecord(data, 'Playtest results')
  assertExactKeys(data, ['version', 'benchmark', 'exportedAt', 'results'], 'playtest results')

  if (data.version !== 'difficulty-v2-playtest-results-v1') {
    throw new Error(`Unsupported playtest results version: ${String(data.version)}`)
  }
  if (data.benchmark !== expectedBenchmark) {
    throw new Error(`Unexpected benchmark: ${String(data.benchmark)}`)
  }
  if (typeof data.exportedAt !== 'string'
    || data.exportedAt.trim() === ''
    || Number.isNaN(Date.parse(data.exportedAt))) {
    throw new Error('exportedAt must be a valid date-time string')
  }
  if (!Array.isArray(data.results)) {
    throw new Error('Playtest results must contain a results array')
  }

  const seen = new Set<string>()
  let solved = 0
  let gaveUp = 0

  for (const [index, rawResult] of data.results.entries()) {
    assertRecord(rawResult, `Result ${index}`)
    assertExactKeys(
      rawResult,
      [
        'benchmarkId',
        'outcome',
        'elapsedMs',
        'moves',
        'restarts',
        'perceivedDifficulty',
        'confidence',
        'frustration',
      ],
      `result ${index}`,
    )

    const benchmarkId = rawResult.benchmarkId
    if (typeof benchmarkId !== 'string' || !allowedBenchmarkIds.has(benchmarkId)) {
      throw new Error(`Unknown benchmarkId: ${String(benchmarkId)}`)
    }
    if (seen.has(benchmarkId)) {
      throw new Error(`Duplicate benchmarkId: ${benchmarkId}`)
    }
    seen.add(benchmarkId)

    if (rawResult.outcome !== 'solved' && rawResult.outcome !== 'gave-up') {
      throw new Error(`Invalid outcome: ${benchmarkId}`)
    }
    assertNonNegativeSafeInteger(rawResult.elapsedMs, `elapsedMs for ${benchmarkId}`)
    assertNonNegativeSafeInteger(rawResult.moves, `moves for ${benchmarkId}`)
    assertNonNegativeSafeInteger(rawResult.restarts, `restarts for ${benchmarkId}`)
    assertRating(rawResult.perceivedDifficulty, `perceivedDifficulty for ${benchmarkId}`)

    if (rawResult.confidence !== undefined) {
      assertRating(rawResult.confidence, `confidence for ${benchmarkId}`)
    }
    if (rawResult.frustration !== undefined) {
      assertRating(rawResult.frustration, `frustration for ${benchmarkId}`)
    }

    if (rawResult.outcome === 'solved') solved += 1
    else gaveUp += 1
  }

  return {
    valid: true,
    benchmark: expectedBenchmark,
    results: data.results.length,
    solved,
    gaveUp,
  }
}

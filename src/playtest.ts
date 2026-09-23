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

function assertNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`)
  }
}

function assertRating(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 5) {
    throw new Error(`${name} must be an integer from 1 to 5`)
  }
}

export function validatePlaytestResults(
  data: PlaytestResults,
  expectedBenchmark: string,
  allowedBenchmarkIds: ReadonlySet<string>,
): PlaytestValidationSummary {
  if (data.version !== 'difficulty-v2-playtest-results-v1') {
    throw new Error(`Unsupported playtest results version: ${data.version}`)
  }
  if (data.benchmark !== expectedBenchmark) {
    throw new Error(`Unexpected benchmark: ${data.benchmark}`)
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

  for (const result of data.results) {
    if (typeof result.benchmarkId !== 'string' || !allowedBenchmarkIds.has(result.benchmarkId)) {
      throw new Error(`Unknown benchmarkId: ${String(result.benchmarkId)}`)
    }
    if (seen.has(result.benchmarkId)) {
      throw new Error(`Duplicate benchmarkId: ${result.benchmarkId}`)
    }
    seen.add(result.benchmarkId)

    if (result.outcome !== 'solved' && result.outcome !== 'gave-up') {
      throw new Error(`Invalid outcome: ${result.benchmarkId}`)
    }
    assertNonNegativeSafeInteger(result.elapsedMs, `elapsedMs for ${result.benchmarkId}`)
    assertNonNegativeSafeInteger(result.moves, `moves for ${result.benchmarkId}`)
    assertNonNegativeSafeInteger(result.restarts, `restarts for ${result.benchmarkId}`)
    assertRating(result.perceivedDifficulty, `perceivedDifficulty for ${result.benchmarkId}`)

    if (result.confidence !== undefined) {
      assertRating(result.confidence, `confidence for ${result.benchmarkId}`)
    }
    if (result.frustration !== undefined) {
      assertRating(result.frustration, `frustration for ${result.benchmarkId}`)
    }

    if (result.outcome === 'solved') solved += 1
    else gaveUp += 1
  }

  return {
    valid: true,
    benchmark: data.benchmark,
    results: data.results.length,
    solved,
    gaveUp,
  }
}

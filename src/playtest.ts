export const GIVE_UP_REASONS = [
  'no-next-move',
  'likely-dead-end',
  'repeated-restarts',
  'too-many-choices',
  'taking-too-long',
  'no-longer-fun',
  'other',
] as const

export type GiveUpReason = typeof GIVE_UP_REASONS[number]

export type PlaytestAction =
  | {
    type: 'move'
    atMs: number
    from: number
    to: number
    color: number
    amount: number
  }
  | {
    type: 'restart'
    atMs: number
  }

export interface PlaytestResultEntry {
  benchmarkId: string
  outcome: 'solved' | 'gave-up'
  elapsedMs: number
  moves: number
  restarts: number
  actions: PlaytestAction[]
  finalBoard: number[][]
  perceivedDifficulty: number
  confidence?: number
  frustration?: number
  giveUpReasons?: GiveUpReason[]
  giveUpNote?: string
}

export interface PlaytestResults {
  version: 'difficulty-v2-playtest-results-v2'
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

function assertPositiveSafeInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer`)
  }
}

function assertRating(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 5) {
    throw new Error(`${name} must be an integer from 1 to 5`)
  }
}

function validateAction(rawAction: unknown, index: number, elapsedMs: number): PlaytestAction['type'] {
  assertRecord(rawAction, `Action ${index}`)
  const type = rawAction.type

  if (type === 'move') {
    assertExactKeys(rawAction, ['type', 'atMs', 'from', 'to', 'color', 'amount'], `action ${index}`)
    assertNonNegativeSafeInteger(rawAction.atMs, `atMs for action ${index}`)
    assertNonNegativeSafeInteger(rawAction.from, `from for action ${index}`)
    assertNonNegativeSafeInteger(rawAction.to, `to for action ${index}`)
    assertNonNegativeSafeInteger(rawAction.color, `color for action ${index}`)
    assertPositiveSafeInteger(rawAction.amount, `amount for action ${index}`)
  } else if (type === 'restart') {
    assertExactKeys(rawAction, ['type', 'atMs'], `action ${index}`)
    assertNonNegativeSafeInteger(rawAction.atMs, `atMs for action ${index}`)
  } else {
    throw new Error(`Invalid action type at index ${index}: ${String(type)}`)
  }

  if (rawAction.atMs > elapsedMs) {
    throw new Error(`Action timestamp exceeds elapsed time at index ${index}`)
  }

  return type
}

function validateBoard(value: unknown, name: string): void {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`)
  for (const [tubeIndex, tube] of value.entries()) {
    if (!Array.isArray(tube)) throw new Error(`${name} tube ${tubeIndex} must be an array`)
    for (const [cellIndex, color] of tube.entries()) {
      assertNonNegativeSafeInteger(color, `${name} color at ${tubeIndex}:${cellIndex}`)
    }
  }
}

function validateGiveUpFeedback(
  outcome: 'solved' | 'gave-up',
  rawReasons: unknown,
  rawNote: unknown,
  benchmarkId: string,
): void {
  if (outcome === 'solved') {
    if (rawReasons !== undefined || rawNote !== undefined) {
      throw new Error(`Solved result must not contain give-up feedback: ${benchmarkId}`)
    }
    return
  }

  if (!Array.isArray(rawReasons) || rawReasons.length === 0) {
    throw new Error(`gave-up result requires at least one giveUpReason: ${benchmarkId}`)
  }

  const allowed = new Set<string>(GIVE_UP_REASONS)
  const seen = new Set<string>()
  for (const reason of rawReasons) {
    if (typeof reason !== 'string' || !allowed.has(reason)) {
      throw new Error(`Invalid giveUpReason for ${benchmarkId}: ${String(reason)}`)
    }
    if (seen.has(reason)) throw new Error(`Duplicate giveUpReason for ${benchmarkId}: ${reason}`)
    seen.add(reason)
  }

  if (rawNote !== undefined && (typeof rawNote !== 'string' || rawNote.trim() === '')) {
    throw new Error(`giveUpNote must be a non-empty string: ${benchmarkId}`)
  }
  if (seen.has('other') && (typeof rawNote !== 'string' || rawNote.trim() === '')) {
    throw new Error(`giveUpNote is required when reason is other: ${benchmarkId}`)
  }
}

export function validatePlaytestResults(
  data: unknown,
  expectedBenchmark: string,
  allowedBenchmarkIds: ReadonlySet<string>,
): PlaytestValidationSummary {
  assertRecord(data, 'Playtest results')
  assertExactKeys(data, ['version', 'benchmark', 'exportedAt', 'results'], 'playtest results')

  if (data.version !== 'difficulty-v2-playtest-results-v2') {
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
        'actions',
        'finalBoard',
        'perceivedDifficulty',
        'confidence',
        'frustration',
        'giveUpReasons',
        'giveUpNote',
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
    validateBoard(rawResult.finalBoard, `finalBoard for ${benchmarkId}`)

    if (!Array.isArray(rawResult.actions)) {
      throw new Error(`actions must be an array: ${benchmarkId}`)
    }
    let moveActions = 0
    let restartActions = 0
    let previousAtMs = -1
    for (const [actionIndex, action] of rawResult.actions.entries()) {
      const type = validateAction(action, actionIndex, rawResult.elapsedMs)
      const atMs = (action as Record<string, unknown>).atMs as number
      if (atMs < previousAtMs) {
        throw new Error(`Action timestamps must be non-decreasing: ${benchmarkId}`)
      }
      previousAtMs = atMs
      if (type === 'move') moveActions += 1
      else restartActions += 1
    }
    if (moveActions !== rawResult.moves) {
      throw new Error(`Move count disagrees with actions: ${benchmarkId}`)
    }
    if (restartActions !== rawResult.restarts) {
      throw new Error(`Restart count disagrees with actions: ${benchmarkId}`)
    }

    if (rawResult.confidence !== undefined) {
      assertRating(rawResult.confidence, `confidence for ${benchmarkId}`)
    }
    if (rawResult.frustration !== undefined) {
      assertRating(rawResult.frustration, `frustration for ${benchmarkId}`)
    }

    validateGiveUpFeedback(
      rawResult.outcome,
      rawResult.giveUpReasons,
      rawResult.giveUpNote,
      benchmarkId,
    )

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

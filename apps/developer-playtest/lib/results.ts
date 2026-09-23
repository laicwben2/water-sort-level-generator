import type { Board, Move } from './game'

export const GIVE_UP_REASONS = [
  'no-next-move',
  'likely-dead-end',
  'repeated-restarts',
  'too-many-choices',
  'taking-too-long',
  'no-longer-fun',
  'other',
] as const

export type GiveUpReason = (typeof GIVE_UP_REASONS)[number]

export type PlaytestAction =
  | ({ type: 'move'; atMs: number } & Move)
  | { type: 'restart'; atMs: number }

export interface PlaytestResult {
  benchmarkId: string
  outcome: 'solved' | 'gave-up'
  elapsedMs: number
  moves: number
  restarts: number
  actions: PlaytestAction[]
  finalBoard: Board
  perceivedDifficulty: number
  confidence?: number
  frustration?: number
  giveUpReasons?: GiveUpReason[]
  giveUpNote?: string
}

export interface PlaytestResultsDocument {
  version: 'difficulty-v2-playtest-results-v2'
  benchmark: string
  exportedAt: string
  results: PlaytestResult[]
}

export function resultsStorageKey(benchmark: string, sessionId: string): string {
  return `water-sort-developer-playtest-results-v2:${benchmark}:${sessionId}`
}

export function loadResults(benchmark: string, sessionId: string): PlaytestResult[] {
  const raw = window.localStorage.getItem(resultsStorageKey(benchmark, sessionId))
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as PlaytestResultsDocument
    if (
      parsed.version !== 'difficulty-v2-playtest-results-v2' ||
      parsed.benchmark !== benchmark ||
      !Array.isArray(parsed.results)
    ) {
      return []
    }
    return parsed.results
  } catch {
    return []
  }
}

export function saveResults(
  benchmark: string,
  sessionId: string,
  results: readonly PlaytestResult[],
): void {
  const document: PlaytestResultsDocument = {
    version: 'difficulty-v2-playtest-results-v2',
    benchmark,
    exportedAt: new Date().toISOString(),
    results: [...results],
  }
  window.localStorage.setItem(
    resultsStorageKey(benchmark, sessionId),
    JSON.stringify(document),
  )
}

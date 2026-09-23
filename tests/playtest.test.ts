import { describe, expect, it } from 'vitest'
import type { PlaytestResults } from '../src/playtest'
import { validatePlaytestResults } from '../src/playtest'

const allowedIds = new Set(['B01', 'B02', 'B03'])

function fixture(): PlaytestResults {
  return {
    version: 'difficulty-v2-playtest-results-v2',
    benchmark: 'difficulty-v2-benchmark-v1',
    exportedAt: '2026-09-23T03:46:00.000Z',
    results: [{
      benchmarkId: 'B01',
      outcome: 'solved',
      elapsedMs: 42_000,
      moves: 1,
      restarts: 1,
      actions: [
        { type: 'move', atMs: 10_000, from: 0, to: 1, color: 2, amount: 1 },
        { type: 'restart', atMs: 20_000 },
      ],
      finalBoard: [[], [2]],
      perceivedDifficulty: 3,
      confidence: 4,
      frustration: 2,
    }],
  }
}

describe('playtest result validation', () => {
  it('accepts valid partial benchmark sessions', () => {
    const data = fixture()
    expect(validatePlaytestResults(
      data,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toEqual({
      valid: true,
      benchmark: 'difficulty-v2-benchmark-v1',
      results: 1,
      solved: 1,
      gaveUp: 0,
    })
  })

  it('accepts gave-up outcomes with explicit reasons', () => {
    const data = fixture()
    data.results[0] = {
      benchmarkId: 'B02',
      outcome: 'gave-up',
      elapsedMs: 60_000,
      moves: 0,
      restarts: 0,
      actions: [],
      finalBoard: [[1], []],
      perceivedDifficulty: 5,
      giveUpReasons: ['no-next-move', 'taking-too-long'],
    }

    expect(validatePlaytestResults(
      data,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    ).gaveUp).toBe(1)
  })

  it('requires give-up feedback and an other note when applicable', () => {
    const missingReasons = fixture()
    missingReasons.results[0] = {
      ...missingReasons.results[0],
      outcome: 'gave-up',
    }
    expect(() => validatePlaytestResults(
      missingReasons,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/requires at least one giveUpReason/)

    const missingOtherNote = fixture()
    missingOtherNote.results[0] = {
      ...missingOtherNote.results[0],
      outcome: 'gave-up',
      giveUpReasons: ['other'],
    }
    expect(() => validatePlaytestResults(
      missingOtherNote,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/giveUpNote is required/)

    const solvedWithReason = fixture()
    solvedWithReason.results[0].giveUpReasons = ['taking-too-long']
    expect(() => validatePlaytestResults(
      solvedWithReason,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/Solved result must not contain/)
  })

  it('rejects action-count and timestamp inconsistencies', () => {
    const wrongMoves = fixture()
    wrongMoves.results[0].moves = 2
    expect(() => validatePlaytestResults(
      wrongMoves,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/Move count disagrees/)

    const wrongRestarts = fixture()
    wrongRestarts.results[0].restarts = 0
    expect(() => validatePlaytestResults(
      wrongRestarts,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/Restart count disagrees/)

    const lateAction = fixture()
    lateAction.results[0].actions[1] = { type: 'restart', atMs: 50_000 }
    expect(() => validatePlaytestResults(
      lateAction,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/timestamp exceeds elapsed time/)

    const reordered = fixture()
    reordered.results[0].actions = [
      { type: 'restart', atMs: 20_000 },
      { type: 'move', atMs: 10_000, from: 0, to: 1, color: 2, amount: 1 },
    ]
    expect(() => validatePlaytestResults(
      reordered,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/timestamps must be non-decreasing/)
  })

  it('rejects unknown and duplicate benchmark IDs', () => {
    const unknown = fixture()
    unknown.results[0].benchmarkId = 'B99'
    expect(() => validatePlaytestResults(
      unknown,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/Unknown benchmarkId/)

    const duplicate = fixture()
    duplicate.results.push({ ...duplicate.results[0] })
    expect(() => validatePlaytestResults(
      duplicate,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/Duplicate benchmarkId/)
  })

  it('rejects invalid result values', () => {
    const invalidRating = fixture()
    invalidRating.results[0].perceivedDifficulty = 6
    expect(() => validatePlaytestResults(
      invalidRating,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/perceivedDifficulty/)

    const invalidElapsed = fixture()
    invalidElapsed.results[0].elapsedMs = Number.NaN
    expect(() => validatePlaytestResults(
      invalidElapsed,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/elapsedMs/)

    const invalidOutcome = fixture()
    invalidOutcome.results[0].outcome = 'skipped' as PlaytestResults['results'][number]['outcome']
    expect(() => validatePlaytestResults(
      invalidOutcome,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/Invalid outcome/)
  })

  it('rejects non-object roots and unknown fields', () => {
    expect(() => validatePlaytestResults(
      null,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/must be an object/)

    const extraRoot = fixture() as PlaytestResults & { sourceDifficulty?: string }
    extraRoot.sourceDifficulty = 'easy'
    expect(() => validatePlaytestResults(
      extraRoot,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/Unexpected playtest results field/)

    const extraResult = fixture()
    ;(extraResult.results[0] as PlaytestResults['results'][number] & { optimalMoves?: number }).optimalMoves = 12
    expect(() => validatePlaytestResults(
      extraResult,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/Unexpected result 0 field/)
  })

  it('rejects mismatched metadata', () => {
    const wrongBenchmark = fixture()
    wrongBenchmark.benchmark = 'other-benchmark'
    expect(() => validatePlaytestResults(
      wrongBenchmark,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/Unexpected benchmark/)

    const wrongDate = fixture()
    wrongDate.exportedAt = 'not-a-date'
    expect(() => validatePlaytestResults(
      wrongDate,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    )).toThrow(/exportedAt/)
  })
})

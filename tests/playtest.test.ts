import { describe, expect, it } from 'vitest'
import type { PlaytestResults } from '../src/playtest'
import { validatePlaytestResults } from '../src/playtest'

const allowedIds = new Set(['B01', 'B02', 'B03'])

function fixture(): PlaytestResults {
  return {
    version: 'difficulty-v2-playtest-results-v1',
    benchmark: 'difficulty-v2-benchmark-v1',
    exportedAt: '2026-09-23T03:46:00.000Z',
    results: [{
      benchmarkId: 'B01',
      outcome: 'solved',
      elapsedMs: 42_000,
      moves: 18,
      restarts: 1,
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

  it('accepts gave-up outcomes and omitted optional ratings', () => {
    const data = fixture()
    data.results[0] = {
      benchmarkId: 'B02',
      outcome: 'gave-up',
      elapsedMs: 60_000,
      moves: 12,
      restarts: 0,
      perceivedDifficulty: 5,
    }

    expect(validatePlaytestResults(
      data,
      'difficulty-v2-benchmark-v1',
      allowedIds,
    ).gaveUp).toBe(1)
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

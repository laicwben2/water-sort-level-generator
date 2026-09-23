import { describe, expect, it } from 'vitest'
import type { PlaytestResults } from '../src/playtest'
import type { BenchmarkCorrelationManifest } from '../src/playtest-correlation'
import {
  correlatePlaytestResults,
  spearmanRankCorrelation,
} from '../src/playtest-correlation'

describe('playtest solver correlation', () => {
  it('computes Spearman rank correlation including ties', () => {
    expect(spearmanRankCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12)
    expect(spearmanRankCorrelation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 12)
    expect(spearmanRankCorrelation([1, 1, 2], [1, 2, 3])).toBeCloseTo(Math.sqrt(3) / 2, 12)
  })

  it('returns null when correlation is not identifiable', () => {
    expect(spearmanRankCorrelation([1], [5])).toBeNull()
    expect(spearmanRankCorrelation([1, 1, 1], [1, 2, 3])).toBeNull()
    expect(spearmanRankCorrelation([1, 2, 3], [4, 4, 4])).toBeNull()
  })

  it('joins partial playtest results to benchmark metrics without thresholds', () => {
    const benchmark: BenchmarkCorrelationManifest = {
      version: 'difficulty-v2-benchmark-v1',
      puzzles: [
        {
          benchmarkId: 'B01',
          optimalMoves: 10,
          decisionStates: 5,
          alternativesPerAnalyzedState: 1,
          wrongMoveDensity: 0.8,
          deadEndDensity: 0.4,
          maxRecoveryPenalty: 1,
        },
        {
          benchmarkId: 'B02',
          optimalMoves: 20,
          decisionStates: 10,
          alternativesPerAnalyzedState: 2,
          wrongMoveDensity: 0.5,
          deadEndDensity: 0.2,
          maxRecoveryPenalty: 1,
        },
        {
          benchmarkId: 'B03',
          optimalMoves: 30,
          decisionStates: 15,
          alternativesPerAnalyzedState: 3,
          wrongMoveDensity: 0.2,
          deadEndDensity: 0,
          maxRecoveryPenalty: 2,
        },
      ],
    }

    const playtest: PlaytestResults = {
      version: 'difficulty-v2-playtest-results-v2',
      benchmark: 'difficulty-v2-benchmark-v1',
      exportedAt: '2026-09-23T05:20:00.000Z',
      results: [
        {
          benchmarkId: 'B01',
          outcome: 'solved',
          elapsedMs: 10_000,
          moves: 10,
          restarts: 0,
          actions: [],
          finalBoard: [],
          perceivedDifficulty: 1,
        },
        {
          benchmarkId: 'B02',
          outcome: 'solved',
          elapsedMs: 20_000,
          moves: 20,
          restarts: 0,
          actions: [],
          finalBoard: [],
          perceivedDifficulty: 3,
        },
        {
          benchmarkId: 'B03',
          outcome: 'gave-up',
          elapsedMs: 30_000,
          moves: 30,
          restarts: 1,
          actions: [{ type: 'restart', atMs: 10_000 }],
          finalBoard: [],
          perceivedDifficulty: 5,
          giveUpReasons: ['no-next-move'],
        },
      ],
    }

    const report = correlatePlaytestResults(playtest, benchmark)
    expect(report.version).toBe('difficulty-v2-playtest-correlation-v1')
    expect(report.samples).toBe(3)

    const byMetric = Object.fromEntries(
      report.correlations.map((entry) => [entry.metric, entry.spearman]),
    )
    expect(byMetric.optimalMoves).toBeCloseTo(1, 12)
    expect(byMetric.decisionStates).toBeCloseTo(1, 12)
    expect(byMetric.alternativesPerAnalyzedState).toBeCloseTo(1, 12)
    expect(byMetric.wrongMoveDensity).toBeCloseTo(-1, 12)
    expect(byMetric.deadEndDensity).toBeCloseTo(-1, 12)
    expect(byMetric.maxRecoveryPenalty).toBeCloseTo(Math.sqrt(3) / 2, 12)
  })

  it('rejects internal benchmark provenance mismatches', () => {
    const playtest: PlaytestResults = {
      version: 'difficulty-v2-playtest-results-v2',
      benchmark: 'difficulty-v2-benchmark-v1',
      exportedAt: '2026-09-23T05:20:00.000Z',
      results: [],
    }
    const benchmark: BenchmarkCorrelationManifest = {
      version: 'different-benchmark',
      puzzles: [],
    }

    expect(() => correlatePlaytestResults(playtest, benchmark))
      .toThrow(/Unexpected internal benchmark/)
  })
})

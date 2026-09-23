import type { PlaytestResults } from './playtest'
import { validatePlaytestResults } from './playtest'

export const CORRELATION_METRICS = [
  'optimalMoves',
  'decisionStates',
  'alternativesPerAnalyzedState',
  'wrongMoveDensity',
  'deadEndDensity',
  'maxRecoveryPenalty',
] as const

export type CorrelationMetric = typeof CORRELATION_METRICS[number]

export interface BenchmarkCorrelationPuzzle {
  benchmarkId: string
  optimalMoves: number
  decisionStates: number
  alternativesPerAnalyzedState: number
  wrongMoveDensity: number
  deadEndDensity: number
  maxRecoveryPenalty: number
}

export interface BenchmarkCorrelationManifest {
  version: string
  puzzles: BenchmarkCorrelationPuzzle[]
}

export interface MetricCorrelation {
  metric: CorrelationMetric
  samples: number
  spearman: number | null
}

export interface PlaytestCorrelationReport {
  version: 'difficulty-v2-playtest-correlation-v1'
  benchmark: string
  samples: number
  correlations: MetricCorrelation[]
}

function averageRanks(values: readonly number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value)

  const ranks = Array<number>(values.length)
  let start = 0

  while (start < indexed.length) {
    let end = start + 1
    while (end < indexed.length && indexed[end].value === indexed[start].value) end += 1

    const averageRank = ((start + 1) + end) / 2
    for (let index = start; index < end; index += 1) {
      ranks[indexed[index].index] = averageRank
    }
    start = end
  }

  return ranks
}

function pearson(valuesA: readonly number[], valuesB: readonly number[]): number | null {
  if (valuesA.length !== valuesB.length || valuesA.length < 2) return null

  const meanA = valuesA.reduce((sum, value) => sum + value, 0) / valuesA.length
  const meanB = valuesB.reduce((sum, value) => sum + value, 0) / valuesB.length

  let numerator = 0
  let varianceA = 0
  let varianceB = 0

  for (let index = 0; index < valuesA.length; index += 1) {
    const deltaA = valuesA[index] - meanA
    const deltaB = valuesB[index] - meanB
    numerator += deltaA * deltaB
    varianceA += deltaA * deltaA
    varianceB += deltaB * deltaB
  }

  if (varianceA === 0 || varianceB === 0) return null
  return numerator / Math.sqrt(varianceA * varianceB)
}

export function spearmanRankCorrelation(
  valuesA: readonly number[],
  valuesB: readonly number[],
): number | null {
  if (valuesA.length !== valuesB.length || valuesA.length < 2) return null
  return pearson(averageRanks(valuesA), averageRanks(valuesB))
}

export function correlatePlaytestResults(
  data: PlaytestResults,
  benchmark: BenchmarkCorrelationManifest,
): PlaytestCorrelationReport {
  if (benchmark.version !== data.benchmark) {
    throw new Error(`Unexpected internal benchmark: ${benchmark.version}`)
  }

  const byId = new Map<string, BenchmarkCorrelationPuzzle>()
  for (const puzzle of benchmark.puzzles) {
    if (byId.has(puzzle.benchmarkId)) {
      throw new Error(`Duplicate internal benchmarkId: ${puzzle.benchmarkId}`)
    }
    byId.set(puzzle.benchmarkId, puzzle)
  }

  validatePlaytestResults(data, benchmark.version, new Set(byId.keys()))

  const joined = data.results.map((result) => {
    const puzzle = byId.get(result.benchmarkId)
    if (!puzzle) throw new Error(`Missing internal benchmark puzzle: ${result.benchmarkId}`)
    return { result, puzzle }
  })

  const perceived = joined.map(({ result }) => result.perceivedDifficulty)

  return {
    version: 'difficulty-v2-playtest-correlation-v1',
    benchmark: benchmark.version,
    samples: joined.length,
    correlations: CORRELATION_METRICS.map((metric) => ({
      metric,
      samples: joined.length,
      spearman: spearmanRankCorrelation(
        joined.map(({ puzzle }) => puzzle[metric]),
        perceived,
      ),
    })),
  }
}

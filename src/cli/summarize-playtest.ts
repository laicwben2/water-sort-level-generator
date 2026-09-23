import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { PlaytestResultEntry, PlaytestResults } from '../playtest'
import { validatePlaytestResults } from '../playtest'
import { stringArg } from './args'

interface BlindBenchmark {
  benchmark: string
  puzzles: Array<{ benchmarkId: string }>
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)]
}

function distribution(values: readonly number[]) {
  if (values.length === 0) return { count: 0, mean: 0, p50: 0, p90: 0, max: 0 }
  return {
    count: values.length,
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    p50: percentile(values, 0.50),
    p90: percentile(values, 0.90),
    max: Math.max(...values),
  }
}

function optionalRatings(
  results: readonly PlaytestResultEntry[],
  key: 'confidence' | 'frustration',
) {
  return distribution(
    results
      .map((result) => result[key])
      .filter((value): value is number => value !== undefined),
  )
}

const inputPath = resolve(stringArg('input', 'difficulty-v2-playtest-results.json')!)
const benchmarkPath = resolve(
  stringArg('benchmark', 'data/benchmarks/difficulty-v2-benchmark-v1-blind.json')!,
)
const outputPath = stringArg('output') ? resolve(stringArg('output')!) : undefined

const [data, benchmark] = await Promise.all([
  readFile(inputPath, 'utf8').then((value) => JSON.parse(value) as PlaytestResults),
  readFile(benchmarkPath, 'utf8').then((value) => JSON.parse(value) as BlindBenchmark),
])

const allowedIds = new Set(benchmark.puzzles.map((puzzle) => puzzle.benchmarkId))
const validation = validatePlaytestResults(data, benchmark.benchmark, allowedIds)

const report = {
  version: 'difficulty-v2-playtest-summary-v1',
  source: inputPath,
  benchmark: data.benchmark,
  exportedAt: data.exportedAt,
  results: validation.results,
  benchmarkSize: benchmark.puzzles.length,
  completionRate: validation.results === 0 ? 0 : validation.solved / validation.results,
  coverageRate: benchmark.puzzles.length === 0 ? 0 : validation.results / benchmark.puzzles.length,
  solved: validation.solved,
  gaveUp: validation.gaveUp,
  elapsedMs: distribution(data.results.map((result) => result.elapsedMs)),
  moves: distribution(data.results.map((result) => result.moves)),
  restarts: distribution(data.results.map((result) => result.restarts)),
  perceivedDifficulty: distribution(data.results.map((result) => result.perceivedDifficulty)),
  confidence: optionalRatings(data.results, 'confidence'),
  frustration: optionalRatings(data.results, 'frustration'),
  byPuzzle: [...data.results]
    .sort((a, b) => a.benchmarkId.localeCompare(b.benchmarkId))
    .map((result) => ({
      benchmarkId: result.benchmarkId,
      outcome: result.outcome,
      elapsedMs: result.elapsedMs,
      moves: result.moves,
      restarts: result.restarts,
      perceivedDifficulty: result.perceivedDifficulty,
      ...(result.confidence !== undefined ? { confidence: result.confidence } : {}),
      ...(result.frustration !== undefined ? { frustration: result.frustration } : {}),
    })),
}

if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
}

console.log(JSON.stringify(report, null, 2))

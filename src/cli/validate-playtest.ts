import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { PlaytestResults } from '../playtest'
import { validatePlaytestResults } from '../playtest'
import { stringArg } from './args'

interface BlindBenchmark {
  benchmark: string
  puzzles: Array<{ benchmarkId: string }>
}

const inputPath = resolve(stringArg('file', 'difficulty-v2-playtest-results.json')!)
const benchmarkPath = resolve(
  stringArg('benchmark', 'data/benchmarks/difficulty-v2-benchmark-v1-blind.json')!,
)

const [data, benchmark] = await Promise.all([
  readFile(inputPath, 'utf8').then((value) => JSON.parse(value) as PlaytestResults),
  readFile(benchmarkPath, 'utf8').then((value) => JSON.parse(value) as BlindBenchmark),
])

const allowedIds = new Set(benchmark.puzzles.map((puzzle) => puzzle.benchmarkId))
const summary = validatePlaytestResults(data, benchmark.benchmark, allowedIds)
console.log(JSON.stringify(summary, null, 2))

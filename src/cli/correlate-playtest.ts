import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { PlaytestResults } from '../playtest'
import type { BenchmarkCorrelationManifest } from '../playtest-correlation'
import { correlatePlaytestResults } from '../playtest-correlation'
import { stringArg } from './args'

const inputPath = resolve(stringArg('input', 'difficulty-v2-playtest-results.json')!)
const benchmarkPath = resolve(
  stringArg('benchmark', 'data/benchmarks/difficulty-v2-benchmark-v1.json')!,
)
const outputPath = stringArg('output') ? resolve(stringArg('output')!) : undefined

const [data, benchmark] = await Promise.all([
  readFile(inputPath, 'utf8').then((value) => JSON.parse(value) as PlaytestResults),
  readFile(benchmarkPath, 'utf8').then((value) => JSON.parse(value) as BenchmarkCorrelationManifest),
])

const report = correlatePlaytestResults(data, benchmark)

if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
}

console.log(JSON.stringify(report, null, 2))

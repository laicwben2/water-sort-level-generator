import { mkdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { positiveIntArg, stringArg } from './args'

interface CaseResult {
  types: number
  candidateIndex: number
  status: 'exact' | 'unknown'
  reason?: string
  minimumRequiredEmptyTubes?: number
  optimalMoves?: number
  elapsedMs: number
  maxRssMb: number
  rssEndMb: number
  heapUsedEndMb: number
  exploredStates: number
  peakVisitedStates: number
  generatedMoves: number
}

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1)
  return sorted[rank]
}

function distribution(values: readonly number[]) {
  return {
    p50: percentile(values, 0.50),
    p90: percentile(values, 0.90),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    max: values.length === 0 ? 0 : Math.max(...values),
  }
}

const minTypes = positiveIntArg('min-types', 6)
const maxTypes = positiveIntArg('max-types', 16)
const samples = positiveIntArg('samples', 10)
const capacity = positiveIntArg('capacity', 4)
const maxEmptyTubes = positiveIntArg('max-empty', 5)
const maxVisitedStates = positiveIntArg('max-states', 100_000)
const maxDepth = positiveIntArg('max-depth', 160)
const batchSeed = stringArg('seed', 'water-sort:benchmark:v0.2')!
const outputPath = resolve(stringArg('output', 'data/output/solver-benchmark.json')!)

if (minTypes > maxTypes) throw new Error('--min-types must be <= --max-types')
if (maxTypes > 16) throw new Error('--max-types must be <= 16')

const casePath = fileURLToPath(new URL('./benchmark-case.ts', import.meta.url))
const cases: CaseResult[] = []

for (let types = minTypes; types <= maxTypes; types += 1) {
  for (let candidateIndex = 0; candidateIndex < samples; candidateIndex += 1) {
    const child = spawnSync(process.execPath, [
      '--import',
      'tsx',
      casePath,
      `--types=${types}`,
      `--candidate-index=${candidateIndex}`,
      `--capacity=${capacity}`,
      `--max-empty=${maxEmptyTubes}`,
      `--max-states=${maxVisitedStates}`,
      `--max-depth=${maxDepth}`,
      `--seed=${batchSeed}`,
    ], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    })

    if (child.status !== 0) {
      throw new Error(
        `benchmark case failed for types=${types}, candidate=${candidateIndex}: ${child.stderr || child.stdout}`,
      )
    }

    cases.push(JSON.parse(child.stdout.trim()) as CaseResult)
  }
}

const summaries = Array.from(
  { length: maxTypes - minTypes + 1 },
  (_, offset) => minTypes + offset,
).map((types) => {
  const group = cases.filter((entry) => entry.types === types)
  const exact = group.filter((entry) => entry.status === 'exact')
  const unknown = group.filter((entry) => entry.status === 'unknown')
  const minimumEmptyDistribution: Record<string, number> = {}
  for (const entry of exact) {
    const key = String(entry.minimumRequiredEmptyTubes)
    minimumEmptyDistribution[key] = (minimumEmptyDistribution[key] ?? 0) + 1
  }

  return {
    types,
    samples: group.length,
    exact: exact.length,
    unknown: unknown.length,
    exactRate: group.length === 0 ? 0 : exact.length / group.length,
    unknownReasons: unknown.reduce<Record<string, number>>((counts, entry) => {
      const reason = entry.reason ?? 'unknown'
      counts[reason] = (counts[reason] ?? 0) + 1
      return counts
    }, {}),
    minimumEmptyDistribution,
    elapsedMs: distribution(group.map((entry) => entry.elapsedMs)),
    maxRssMb: distribution(group.map((entry) => entry.maxRssMb)),
    exploredStates: distribution(group.map((entry) => entry.exploredStates)),
    peakVisitedStates: distribution(group.map((entry) => entry.peakVisitedStates)),
    generatedMoves: distribution(group.map((entry) => entry.generatedMoves)),
    optimalMoves: distribution(exact.flatMap((entry) =>
      entry.optimalMoves === undefined ? [] : [entry.optimalMoves])),
  }
})

const report = {
  version: 'solver-benchmark-v1',
  createdAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  config: {
    minTypes,
    maxTypes,
    samples,
    capacity,
    maxEmptyTubes,
    maxVisitedStates,
    maxDepth,
    batchSeed,
    concurrency: 1,
    processIsolation: 'one-child-per-candidate',
  },
  summaries,
  cases,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ output: outputPath, summaries }, null, 2))

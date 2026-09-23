import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { AuditCatalog, MistakeAnalysisMetrics } from '../types'
import { validateAuditCatalog } from '../validator'
import { stringArg } from './args'

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.max(0, Math.ceil(fraction * sorted.length) - 1)
  return sorted[rank]
}

function distribution(values: readonly number[]) {
  return {
    p50: percentile(values, 0.50),
    p90: percentile(values, 0.90),
    p95: percentile(values, 0.95),
    max: values.length === 0 ? 0 : Math.max(...values),
  }
}

const inputPath = resolve(stringArg('input', 'data/audit/catalog-expanded.json')!)
const outputPath = stringArg('output')
  ? resolve(stringArg('output')!)
  : undefined

const catalog = JSON.parse(await readFile(inputPath, 'utf8')) as AuditCatalog
validateAuditCatalog(catalog)
const difficulties = ['easy', 'medium', 'hard'] as const

const summaries = difficulties.map((difficulty) => {
  const puzzles = catalog.puzzles.filter((puzzle) => puzzle.difficulty === difficulty)
  const analyzed = puzzles.filter(
    (puzzle): puzzle is typeof puzzle & { mistakeAnalysis: MistakeAnalysisMetrics } =>
      puzzle.mistakeAnalysis !== undefined,
  )
  const metrics = analyzed.map((puzzle) => puzzle.mistakeAnalysis)

  return {
    difficulty,
    puzzles: puzzles.length,
    analyzed: analyzed.length,
    analyzedRate: puzzles.length === 0 ? 0 : analyzed.length / puzzles.length,
    analysisCoverage: distribution(metrics.map((entry) => entry.analysisCoverage)),
    decisionStates: distribution(metrics.map((entry) => entry.decisionStates)),
    alternatives: distribution(metrics.map((entry) => entry.alternatives)),
    alternativesPerAnalyzedState: distribution(metrics.map((entry) => entry.alternativesPerAnalyzedState)),
    wrongMoveDensity: distribution(metrics.map((entry) => entry.wrongMoveDensity)),
    deadEndDensity: distribution(metrics.map((entry) => entry.deadEndDensity)),
    deadEndRisk: distribution(metrics.map((entry) => entry.deadEndRisk)),
    averageRecoveryPenalty: distribution(metrics.map((entry) => entry.averageRecoveryPenalty)),
    p90RecoveryPenalty: distribution(metrics.map((entry) => entry.p90RecoveryPenalty)),
    maxRecoveryPenalty: distribution(metrics.map((entry) => entry.maxRecoveryPenalty)),
    unknownAlternatives: distribution(metrics.map((entry) => entry.unknownAlternatives)),
  }
})

const report = {
  version: 'difficulty-v2-summary-v1',
  source: inputPath,
  catalogProfile: catalog.profile,
  reproducibility: catalog.reproducibility,
  summaries,
}

if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
}

console.log(JSON.stringify(report, null, 2))

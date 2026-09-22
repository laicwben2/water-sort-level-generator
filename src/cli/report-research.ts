import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { ResearchPool, ResearchPuzzle } from '../research'
import { validateResearchPool } from '../research'
import { positiveIntArg, stringArg } from './args'

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1)
  return sorted[rank]
}

function distribution(values: readonly number[]) {
  return {
    min: values.length === 0 ? 0 : Math.min(...values),
    p10: percentile(values, 0.10),
    p25: percentile(values, 0.25),
    p50: percentile(values, 0.50),
    p75: percentile(values, 0.75),
    p90: percentile(values, 0.90),
    p95: percentile(values, 0.95),
    max: values.length === 0 ? 0 : Math.max(...values),
    mean: values.length === 0
      ? 0
      : values.reduce((sum, value) => sum + value, 0) / values.length,
  }
}

function metrics(puzzle: ResearchPuzzle) {
  const analysis = puzzle.difficultyV2
  const decisionStates = analysis.states.filter((state) => state.legalMoves > 1)
  const riskyDecisionStates = decisionStates.filter((state) =>
    state.recoverableMistakes + state.deadEndMoves > 0).length
  const decisionChoiceRisks = decisionStates.map((state) => {
    const knownChoices = state.legalMoves - state.unknownMoves
    const badChoices = state.recoverableMistakes + state.deadEndMoves
    return knownChoices === 0 ? 0 : badChoices / knownChoices
  })
  const knownAlternatives = analysis.totalAlternativeMoves - analysis.unknownMoves

  return {
    id: puzzle.id,
    candidateIndex: puzzle.candidateIndex,
    minimumRequiredEmptyTubes: puzzle.minimumRequiredEmptyTubes,
    optimalMoves: puzzle.solver.optimalMoves,
    exploredStates: puzzle.solver.exploredStates,
    visitedStates: puzzle.solver.visitedStates,
    decisionRatio: puzzle.solver.optimalMoves === 0
      ? 0
      : puzzle.solutionPath.decisionSteps / puzzle.solver.optimalMoves,
    averageChoices: puzzle.solutionPath.averageChoices,
    maximumChoices: puzzle.solutionPath.maximumChoices,
    riskyDecisionStates,
    riskyDecisionRatio: decisionStates.length === 0 ? 0 : riskyDecisionStates / decisionStates.length,
    averageDecisionChoiceRisk: decisionChoiceRisks.length === 0
      ? 0
      : decisionChoiceRisks.reduce((sum, value) => sum + value, 0) / decisionChoiceRisks.length,
    maxDecisionChoiceRisk: decisionChoiceRisks.length === 0 ? 0 : Math.max(...decisionChoiceRisks),
    optimalAlternativeRate: knownAlternatives === 0
      ? 0
      : analysis.optimalAlternativeMoves / knownAlternatives,
    deadEndRatioKnown: analysis.deadEndRatioKnown,
    averageRecoveryPenalty: analysis.averageRecoveryPenalty,
    maxRecoveryPenalty: analysis.maxRecoveryPenalty,
    unknownAlternativeRate: analysis.totalAlternativeMoves === 0
      ? 0
      : analysis.unknownMoves / analysis.totalAlternativeMoves,
  }
}

function extremes(
  puzzles: readonly ReturnType<typeof metrics>[],
  key: keyof ReturnType<typeof metrics>,
  count: number,
) {
  const numeric = puzzles.filter((puzzle) => typeof puzzle[key] === 'number')
  const sorted = [...numeric].sort((first, second) =>
    (first[key] as number) - (second[key] as number)
    || first.candidateIndex - second.candidateIndex)

  return {
    lowest: sorted.slice(0, count).map((puzzle) => ({ id: puzzle.id, value: puzzle[key] })),
    highest: sorted.slice(-count).reverse().map((puzzle) => ({ id: puzzle.id, value: puzzle[key] })),
  }
}

const inputPath = resolve(stringArg('input', 'data/research/types-7-v0.2.json')!)
const outputPath = resolve(stringArg('output', 'data/output/research-report-v0.2.json')!)
const extremeCount = positiveIntArg('extremes', 5)

const pool = JSON.parse(await readFile(inputPath, 'utf8')) as ResearchPool
const validation = validateResearchPool(pool)
const puzzles = pool.puzzles.map(metrics)

const metricKeys = [
  'optimalMoves',
  'exploredStates',
  'visitedStates',
  'decisionRatio',
  'averageChoices',
  'maximumChoices',
  'riskyDecisionStates',
  'riskyDecisionRatio',
  'averageDecisionChoiceRisk',
  'maxDecisionChoiceRisk',
  'optimalAlternativeRate',
  'deadEndRatioKnown',
  'averageRecoveryPenalty',
  'maxRecoveryPenalty',
  'unknownAlternativeRate',
] as const

const report = {
  version: 'research-report-v1',
  source: inputPath,
  types: pool.types,
  capacity: pool.capacity,
  puzzles: pool.puzzles.length,
  attemptsScanned: pool.attemptsScanned,
  acceptanceRate: pool.attemptsScanned === 0 ? 0 : pool.puzzles.length / pool.attemptsScanned,
  minimumEmptyDistribution: validation.minimumEmptyDistribution,
  reproducibility: pool.reproducibility,
  distributions: Object.fromEntries(metricKeys.map((key) => [
    key,
    distribution(puzzles.map((puzzle) => puzzle[key])),
  ])),
  extremes: Object.fromEntries(metricKeys.map((key) => [
    key,
    extremes(puzzles, key, extremeCount),
  ])),
  puzzleMetrics: puzzles,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)

console.log(JSON.stringify({
  output: outputPath,
  types: report.types,
  puzzles: report.puzzles,
  acceptanceRate: report.acceptanceRate,
  minimumEmptyDistribution: report.minimumEmptyDistribution,
  distributions: report.distributions,
}, null, 2))

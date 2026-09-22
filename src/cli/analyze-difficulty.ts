import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { AuditCatalog, AuditPuzzle } from '../types'
import { validateAuditCatalog } from '../validator'
import { stringArg } from './args'

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1)
  return sorted[rank]
}

function distribution(values: readonly number[]) {
  return {
    min: values.length === 0 ? 0 : Math.min(...values),
    p50: percentile(values, 0.50),
    p90: percentile(values, 0.90),
    p95: percentile(values, 0.95),
    max: values.length === 0 ? 0 : Math.max(...values),
    mean: values.length === 0
      ? 0
      : values.reduce((sum, value) => sum + value, 0) / values.length,
  }
}

function cueRisk(
  puzzles: readonly AuditPuzzle[],
  predicate: (entry: AuditPuzzle['difficultyV2']['states'][number]['alternatives'][number]) => boolean,
) {
  const entries = puzzles
    .flatMap((puzzle) => puzzle.difficultyV2.states)
    .flatMap((state) => state.alternatives)
    .filter((entry) => entry.status !== 'unknown' && predicate(entry))

  const nonOptimal = entries.filter((entry) =>
    entry.status === 'recoverable-mistake' || entry.status === 'dead-end').length
  const deadEnds = entries.filter((entry) => entry.status === 'dead-end').length

  return {
    known: entries.length,
    nonOptimal,
    deadEnds,
    riskRate: entries.length === 0 ? 0 : nonOptimal / entries.length,
    deadEndRate: entries.length === 0 ? 0 : deadEnds / entries.length,
  }
}

function puzzleMetrics(puzzle: AuditPuzzle) {
  const analysis = puzzle.difficultyV2
  const knownAlternatives = analysis.totalAlternativeMoves - analysis.unknownMoves
  const decisionRatio = puzzle.solver.optimalMoves === 0
    ? 0
    : puzzle.solutionPath.decisionSteps / puzzle.solver.optimalMoves
  const unknownAlternativeRate = analysis.totalAlternativeMoves === 0
    ? 0
    : analysis.unknownMoves / analysis.totalAlternativeMoves
  const optimalAlternativeRate = knownAlternatives === 0
    ? 0
    : analysis.optimalAlternativeMoves / knownAlternatives

  const decisionStates = analysis.states.filter((state) => state.legalMoves > 1)
  const riskyDecisionStates = decisionStates.filter((state) =>
    state.recoverableMistakes + state.deadEndMoves > 0).length
  const safeDecisionStates = decisionStates.filter((state) =>
    state.recoverableMistakes + state.deadEndMoves === 0 && state.unknownMoves === 0).length
  const deadEndDecisionStates = decisionStates.filter((state) => state.deadEndMoves > 0).length
  const decisionChoiceRisks = decisionStates.map((state) => {
    const knownChoices = state.legalMoves - state.unknownMoves
    const badChoices = state.recoverableMistakes + state.deadEndMoves
    return knownChoices === 0 ? 0 : badChoices / knownChoices
  })

  return {
    id: puzzle.id,
    difficulty: puzzle.difficulty,
    optimalMoves: puzzle.solver.optimalMoves,
    decisionRatio,
    averageChoices: puzzle.solutionPath.averageChoices,
    maximumChoices: puzzle.solutionPath.maximumChoices,
    totalAlternativeMoves: analysis.totalAlternativeMoves,
    optimalAlternativeMoves: analysis.optimalAlternativeMoves,
    recoverableMistakes: analysis.recoverableMistakes,
    deadEndMoves: analysis.deadEndMoves,
    unknownMoves: analysis.unknownMoves,
    unknownAlternativeRate,
    optimalAlternativeRate,
    deadEndRatioKnown: analysis.deadEndRatioKnown,
    averageRecoveryPenalty: analysis.averageRecoveryPenalty,
    maxRecoveryPenalty: analysis.maxRecoveryPenalty,
    highPenaltyMistakes: analysis.highPenaltyMistakes,
    riskyDecisionStates,
    safeDecisionStates,
    deadEndDecisionStates,
    riskyDecisionRatio: decisionStates.length === 0 ? 0 : riskyDecisionStates / decisionStates.length,
    averageDecisionChoiceRisk: decisionChoiceRisks.length === 0
      ? 0
      : decisionChoiceRisks.reduce((sum, value) => sum + value, 0) / decisionChoiceRisks.length,
    maxDecisionChoiceRisk: decisionChoiceRisks.length === 0 ? 0 : Math.max(...decisionChoiceRisks),
  }
}

const inputPath = resolve(stringArg('input', 'data/audit/catalog-expanded.json')!)
const outputPath = resolve(stringArg('output', 'data/output/difficulty-report.json')!)

const catalog = JSON.parse(await readFile(inputPath, 'utf8')) as AuditCatalog
validateAuditCatalog(catalog)

const puzzles = catalog.puzzles.map(puzzleMetrics)
const difficultyNames = [...new Set(puzzles.map((puzzle) => puzzle.difficulty))].sort()

const groups = difficultyNames.map((difficulty) => {
  const group = puzzles.filter((puzzle) => puzzle.difficulty === difficulty)
  return {
    difficulty,
    puzzles: group.length,
    completeAnalysis: group.filter((puzzle) => puzzle.unknownMoves === 0).length,
    optimalMoves: distribution(group.map((puzzle) => puzzle.optimalMoves)),
    decisionRatio: distribution(group.map((puzzle) => puzzle.decisionRatio)),
    averageChoices: distribution(group.map((puzzle) => puzzle.averageChoices)),
    totalAlternativeMoves: distribution(group.map((puzzle) => puzzle.totalAlternativeMoves)),
    unknownAlternativeRate: distribution(group.map((puzzle) => puzzle.unknownAlternativeRate)),
    optimalAlternativeRate: distribution(group.map((puzzle) => puzzle.optimalAlternativeRate)),
    deadEndRatioKnown: distribution(group.map((puzzle) => puzzle.deadEndRatioKnown)),
    averageRecoveryPenalty: distribution(group.map((puzzle) => puzzle.averageRecoveryPenalty)),
    maxRecoveryPenalty: distribution(group.map((puzzle) => puzzle.maxRecoveryPenalty)),
    highPenaltyMistakes: distribution(group.map((puzzle) => puzzle.highPenaltyMistakes)),
    riskyDecisionStates: distribution(group.map((puzzle) => puzzle.riskyDecisionStates)),
    riskyDecisionRatio: distribution(group.map((puzzle) => puzzle.riskyDecisionRatio)),
    averageDecisionChoiceRisk: distribution(group.map((puzzle) => puzzle.averageDecisionChoiceRisk)),
    maxDecisionChoiceRisk: distribution(group.map((puzzle) => puzzle.maxDecisionChoiceRisk)),
    cueRisk: {
      sameTypeJoin: cueRisk(
        catalog.puzzles.filter((puzzle) => puzzle.difficulty === difficulty),
        (entry) => entry.features.joinsSameType,
      ),
      emptyDestination: cueRisk(
        catalog.puzzles.filter((puzzle) => puzzle.difficulty === difficulty),
        (entry) => entry.features.destination === 'empty',
      ),
      sourceBecomesEmpty: cueRisk(
        catalog.puzzles.filter((puzzle) => puzzle.difficulty === difficulty),
        (entry) => entry.features.sourceBecomesEmpty,
      ),
      targetBecomesComplete: cueRisk(
        catalog.puzzles.filter((puzzle) => puzzle.difficulty === difficulty),
        (entry) => entry.features.targetBecomesComplete,
      ),
      segmentImproves: cueRisk(
        catalog.puzzles.filter((puzzle) => puzzle.difficulty === difficulty),
        (entry) => entry.features.segmentDelta < 0,
      ),
      multiLayerMove: cueRisk(
        catalog.puzzles.filter((puzzle) => puzzle.difficulty === difficulty),
        (entry) => entry.features.movedAmount > 1,
      ),
    },
  }
})

const report = {
  version: 'difficulty-report-v1',
  source: inputPath,
  profile: catalog.profile,
  reproducibility: catalog.reproducibility,
  groups,
  puzzles,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  output: outputPath,
  groups,
}, null, 2))

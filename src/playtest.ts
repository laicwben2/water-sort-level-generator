import { createRng, shuffle } from './rng'
import type { ResearchPool, ResearchPuzzle } from './research'

export type PlaytestMetricName =
  | 'averageDecisionChoiceRisk'
  | 'riskyDecisionRatio'
  | 'optimalAlternativeRate'
  | 'deadEndRatioKnown'
  | 'averageChoices'
  | 'optimalMoves'

export interface PlaytestReason {
  metric: PlaytestMetricName
  direction: 'low' | 'high'
  value: number
  rankWithinMetric: number
}

export interface PlaytestCase {
  order: number
  id: string
  reason: PlaytestReason
  puzzle: ResearchPuzzle
}

export interface PlaytestSelection {
  version: 'playtest-selection-v1'
  types: number
  capacity: number
  sourceBatchSeed: string
  selectionSeed: string
  cases: PlaytestCase[]
}

function decisionMetrics(puzzle: ResearchPuzzle) {
  const analysis = puzzle.difficultyV2
  const decisionStates = analysis.states.filter((state) => state.legalMoves > 1)
  const decisionChoiceRisks = decisionStates.map((state) => {
    const knownChoices = state.legalMoves - state.unknownMoves
    const badChoices = state.recoverableMistakes + state.deadEndMoves
    return knownChoices === 0 ? 0 : badChoices / knownChoices
  })
  const riskyDecisionStates = decisionStates.filter((state) =>
    state.recoverableMistakes + state.deadEndMoves > 0).length
  const knownAlternatives = analysis.totalAlternativeMoves - analysis.unknownMoves

  return {
    averageDecisionChoiceRisk: decisionChoiceRisks.length === 0
      ? 0
      : decisionChoiceRisks.reduce((sum, value) => sum + value, 0) / decisionChoiceRisks.length,
    riskyDecisionRatio: decisionStates.length === 0
      ? 0
      : riskyDecisionStates / decisionStates.length,
    optimalAlternativeRate: knownAlternatives === 0
      ? 0
      : analysis.optimalAlternativeMoves / knownAlternatives,
    deadEndRatioKnown: analysis.deadEndRatioKnown,
    averageChoices: puzzle.solutionPath.averageChoices,
    optimalMoves: puzzle.solver.optimalMoves,
  }
}

export function playtestMetricValue(
  puzzle: ResearchPuzzle,
  metric: PlaytestMetricName,
): number {
  return decisionMetrics(puzzle)[metric]
}

const DEFAULT_ROLES: ReadonlyArray<{
  metric: PlaytestMetricName
  direction: 'low' | 'high'
}> = [
  { metric: 'averageDecisionChoiceRisk', direction: 'low' },
  { metric: 'averageDecisionChoiceRisk', direction: 'high' },
  { metric: 'riskyDecisionRatio', direction: 'low' },
  { metric: 'riskyDecisionRatio', direction: 'high' },
  { metric: 'optimalAlternativeRate', direction: 'low' },
  { metric: 'optimalAlternativeRate', direction: 'high' },
  { metric: 'deadEndRatioKnown', direction: 'low' },
  { metric: 'deadEndRatioKnown', direction: 'high' },
  { metric: 'averageChoices', direction: 'low' },
  { metric: 'averageChoices', direction: 'high' },
  { metric: 'optimalMoves', direction: 'low' },
  { metric: 'optimalMoves', direction: 'high' },
]

export function selectPlaytestCases(
  pool: ResearchPool,
  selectionSeed = 'water-sort-playtest-v0.2',
): PlaytestSelection {
  if (pool.puzzles.length < DEFAULT_ROLES.length) {
    throw new Error(`playtest selection requires at least ${DEFAULT_ROLES.length} puzzles`)
  }

  const selected = new Set<string>()
  const cases: Array<Omit<PlaytestCase, 'order'>> = []

  for (const role of DEFAULT_ROLES) {
    const ranked = pool.puzzles
      .map((puzzle) => ({
        puzzle,
        value: playtestMetricValue(puzzle, role.metric),
      }))
      .sort((first, second) => {
        const delta = role.direction === 'low'
          ? first.value - second.value
          : second.value - first.value
        return delta || first.puzzle.candidateIndex - second.puzzle.candidateIndex
      })

    const index = ranked.findIndex((entry) => !selected.has(entry.puzzle.id))
    if (index < 0) throw new Error('unable to select unique playtest cases')

    const chosen = ranked[index]
    selected.add(chosen.puzzle.id)
    cases.push({
      id: chosen.puzzle.id,
      reason: {
        metric: role.metric,
        direction: role.direction,
        value: chosen.value,
        rankWithinMetric: index + 1,
      },
      puzzle: chosen.puzzle,
    })
  }

  const ordered = shuffle(cases, createRng(selectionSeed))
    .map((entry, index) => ({
      ...entry,
      order: index + 1,
    }))

  return {
    version: 'playtest-selection-v1',
    types: pool.types,
    capacity: pool.capacity,
    sourceBatchSeed: pool.reproducibility.batchSeed,
    selectionSeed,
    cases: ordered,
  }
}

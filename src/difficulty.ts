import { applyMove } from './rules'
import { listLegalMoves, solveBoard } from './solver'
import type { Board, MistakeAnalysisMetrics, Move, SolverResult } from './types'

export interface MistakeAnalysisOptions {
  capacity?: number
  maxVisitedStatesPerAlternative?: number
  maxDepthPerAlternative?: number
  maxPathStates?: number
}

export type AlternativeClassification =
  | { status: 'optimal-equivalent'; recoveryPenalty: 0; remainingOptimalMoves: number }
  | { status: 'recoverable'; recoveryPenalty: number; remainingOptimalMoves: number }
  | { status: 'dead-end' }
  | { status: 'unknown'; reason: 'budget-exceeded' }

function sameMove(first: Move, second: Move): boolean {
  return first.from === second.from
    && first.to === second.to
    && first.color === second.color
    && first.amount === second.amount
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((first, second) => first - second)
  const rank = Math.max(0, Math.ceil(fraction * sorted.length) - 1)
  return sorted[rank]
}

export function classifyAlternativeMove(
  board: Board,
  move: Move,
  optimalMovesRemainingBeforeMove: number,
  options: MistakeAnalysisOptions = {},
): AlternativeClassification {
  const capacity = options.capacity ?? 4
  const nextBoard = applyMove(board, move)
  const result = solveBoard(nextBoard, {
    capacity,
    maxVisitedStates: options.maxVisitedStatesPerAlternative ?? 20_000,
    maxDepth: options.maxDepthPerAlternative ?? 120,
  })

  if (result.status === 'budget-exceeded') {
    return { status: 'unknown', reason: 'budget-exceeded' }
  }

  if (result.status === 'unsolvable') {
    return { status: 'dead-end' }
  }

  const totalMovesViaAlternative = 1 + result.solution.length
  const recoveryPenalty = totalMovesViaAlternative - optimalMovesRemainingBeforeMove

  if (recoveryPenalty < 0) {
    throw new Error(
      `Optimality contradiction: alternative path is ${-recoveryPenalty} move(s) shorter than stored optimal path`,
    )
  }

  if (recoveryPenalty === 0) {
    return {
      status: 'optimal-equivalent',
      recoveryPenalty: 0,
      remainingOptimalMoves: result.solution.length,
    }
  }

  return {
    status: 'recoverable',
    recoveryPenalty,
    remainingOptimalMoves: result.solution.length,
  }
}

export function analyzeMistakesAlongOptimalPath(
  initialBoard: Board,
  optimalSolution: readonly Move[],
  options: MistakeAnalysisOptions = {},
): MistakeAnalysisMetrics {
  const capacity = options.capacity ?? 4
  const maxPathStates = options.maxPathStates ?? Number.POSITIVE_INFINITY

  let board = initialBoard.map((tube) => [...tube])
  let analyzedStates = 0
  let decisionStates = 0
  let alternatives = 0
  let optimalEquivalentAlternatives = 0
  let recoverableAlternatives = 0
  let deadEndAlternatives = 0
  let unknownAlternatives = 0
  const recoveryPenalties: number[] = []

  for (let step = 0; step < optimalSolution.length && analyzedStates < maxPathStates; step += 1) {
    const optimalMove = optimalSolution[step]
    const legalMoves = listLegalMoves(board, capacity)
    const matchingOptimal = legalMoves.find((move) => sameMove(move, optimalMove))

    if (!matchingOptimal) {
      throw new Error(`Stored optimal move is not legal at step ${step}`)
    }

    analyzedStates += 1
    if (legalMoves.length > 1) decisionStates += 1

    const optimalMovesRemaining = optimalSolution.length - step

    for (const move of legalMoves) {
      if (sameMove(move, optimalMove)) continue
      alternatives += 1

      const classification = classifyAlternativeMove(
        board,
        move,
        optimalMovesRemaining,
        { ...options, capacity },
      )

      if (classification.status === 'optimal-equivalent') {
        optimalEquivalentAlternatives += 1
      } else if (classification.status === 'recoverable') {
        recoverableAlternatives += 1
        recoveryPenalties.push(classification.recoveryPenalty)
      } else if (classification.status === 'dead-end') {
        deadEndAlternatives += 1
      } else {
        unknownAlternatives += 1
      }
    }

    board = applyMove(board, optimalMove)
  }

  const knownAlternatives = alternatives - unknownAlternatives
  const knownWrongAlternatives = recoverableAlternatives + deadEndAlternatives
  const recoveryPenaltySum = recoveryPenalties.reduce((sum, value) => sum + value, 0)

  return {
    analyzedStates,
    decisionStates,
    alternatives,
    optimalEquivalentAlternatives,
    recoverableAlternatives,
    deadEndAlternatives,
    unknownAlternatives,
    analysisCoverage: alternatives === 0 ? 1 : knownAlternatives / alternatives,
    wrongMoveDensity: knownAlternatives === 0 ? 0 : knownWrongAlternatives / knownAlternatives,
    deadEndRisk: knownWrongAlternatives === 0 ? 0 : deadEndAlternatives / knownWrongAlternatives,
    averageRecoveryPenalty: recoveryPenalties.length === 0 ? 0 : recoveryPenaltySum / recoveryPenalties.length,
    p50RecoveryPenalty: percentile(recoveryPenalties, 0.50),
    p90RecoveryPenalty: percentile(recoveryPenalties, 0.90),
    maxRecoveryPenalty: recoveryPenalties.length === 0 ? 0 : Math.max(...recoveryPenalties),
  }
}

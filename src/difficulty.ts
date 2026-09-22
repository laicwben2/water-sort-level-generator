import { applyMove } from './rules'
import { listLegalMoves, solveBoard } from './solver'
import { packBoard, packedStateKey } from './solver-state'
import type { Board, Move } from './types'

export interface MistakeAnalysisOptions {
  capacity?: number
  maxVisitedStates?: number
  maxDepthExtra?: number
  highPenaltyThreshold?: number
}

export type AlternativeMoveAnalysis =
  | {
      move: Move
      status: 'optimal-alternative'
      nextOptimalMoves: number
      recoveryPenalty: 0
    }
  | {
      move: Move
      status: 'recoverable-mistake'
      nextOptimalMoves: number
      recoveryPenalty: number
    }
  | {
      move: Move
      status: 'dead-end'
    }
  | {
      move: Move
      status: 'unknown'
    }

export interface MistakeStateAnalysis {
  pathIndex: number
  remainingOptimalMoves: number
  legalMoves: number
  optimalAlternatives: number
  recoverableMistakes: number
  deadEndMoves: number
  unknownMoves: number
  recoveryPenalties: number[]
  maxRecoveryPenalty: number
  alternatives: AlternativeMoveAnalysis[]
}

export interface MistakeAnalysis {
  analyzedStates: number
  decisionStates: number
  forcedStates: number
  totalAlternativeMoves: number
  optimalAlternativeMoves: number
  recoverableMistakes: number
  deadEndMoves: number
  unknownMoves: number
  knownNonOptimalMoves: number
  deadEndRatioKnown: number
  averageRecoveryPenalty: number
  maxRecoveryPenalty: number
  highPenaltyMistakes: number
  states: MistakeStateAnalysis[]
}

type DistanceCacheEntry =
  | { status: 'solved'; distance: number }
  | { status: 'unsolvable' }
  | { status: 'unknown' }

function sameMove(first: Move, second: Move): boolean {
  return first.from === second.from
    && first.to === second.to
    && first.color === second.color
    && first.amount === second.amount
}

export function analyzeMistakes(
  initialBoard: Board,
  optimalSolution: readonly Move[],
  options: MistakeAnalysisOptions = {},
): MistakeAnalysis {
  const capacity = options.capacity ?? 4
  const maxVisitedStates = options.maxVisitedStates ?? 50_000
  const maxDepthExtra = options.maxDepthExtra ?? 40
  const highPenaltyThreshold = options.highPenaltyThreshold ?? 4
  const distanceCache = new Map<bigint, DistanceCacheEntry>()

  let board = initialBoard.map((tube) => [...tube])
  const states: MistakeStateAnalysis[] = []

  for (let pathIndex = 0; pathIndex < optimalSolution.length; pathIndex += 1) {
    const storedOptimalMove = optimalSolution[pathIndex]
    const remainingOptimalMoves = optimalSolution.length - pathIndex
    const legalMoves = listLegalMoves(board, capacity)

    const storedMovePresent = legalMoves.some((move) => sameMove(move, storedOptimalMove))
    if (!storedMovePresent) {
      throw new Error(`Stored optimal move is not legal at path index ${pathIndex}`)
    }

    const alternatives: AlternativeMoveAnalysis[] = []

    for (const move of legalMoves) {
      if (sameMove(move, storedOptimalMove)) continue

      const nextBoard = applyMove(board, move)
      const key = packedStateKey(packBoard(nextBoard, capacity))
      let cached = distanceCache.get(key)

      if (!cached) {
        const result = solveBoard(nextBoard, {
          capacity,
          maxVisitedStates,
          maxDepth: remainingOptimalMoves + maxDepthExtra,
        })

        cached = result.status === 'solved'
          ? { status: 'solved', distance: result.solution.length }
          : result.status === 'unsolvable'
            ? { status: 'unsolvable' }
            : { status: 'unknown' }
        distanceCache.set(key, cached)
      }

      if (cached.status === 'unknown') {
        alternatives.push({ move, status: 'unknown' })
        continue
      }

      if (cached.status === 'unsolvable') {
        alternatives.push({ move, status: 'dead-end' })
        continue
      }

      const totalDistance = 1 + cached.distance
      if (totalDistance < remainingOptimalMoves) {
        throw new Error(
          `Stored solution is not optimal at path index ${pathIndex}: alternate path length ${totalDistance} < ${remainingOptimalMoves}`,
        )
      }

      const recoveryPenalty = totalDistance - remainingOptimalMoves
      if (recoveryPenalty === 0) {
        alternatives.push({
          move,
          status: 'optimal-alternative',
          nextOptimalMoves: cached.distance,
          recoveryPenalty: 0,
        })
      } else {
        alternatives.push({
          move,
          status: 'recoverable-mistake',
          nextOptimalMoves: cached.distance,
          recoveryPenalty,
        })
      }
    }

    const recoveryPenalties = alternatives.flatMap((entry) =>
      entry.status === 'recoverable-mistake' ? [entry.recoveryPenalty] : [])

    states.push({
      pathIndex,
      remainingOptimalMoves,
      legalMoves: legalMoves.length,
      optimalAlternatives: alternatives.filter((entry) => entry.status === 'optimal-alternative').length,
      recoverableMistakes: recoveryPenalties.length,
      deadEndMoves: alternatives.filter((entry) => entry.status === 'dead-end').length,
      unknownMoves: alternatives.filter((entry) => entry.status === 'unknown').length,
      recoveryPenalties,
      maxRecoveryPenalty: recoveryPenalties.length === 0 ? 0 : Math.max(...recoveryPenalties),
      alternatives,
    })

    board = applyMove(board, storedOptimalMove)
  }

  const allAlternatives = states.flatMap((state) => state.alternatives)
  const penalties = allAlternatives.flatMap((entry) =>
    entry.status === 'recoverable-mistake' ? [entry.recoveryPenalty] : [])
  const deadEndMoves = allAlternatives.filter((entry) => entry.status === 'dead-end').length
  const recoverableMistakes = penalties.length
  const knownNonOptimalMoves = deadEndMoves + recoverableMistakes
  const totalAlternativeMoves = allAlternatives.length

  return {
    analyzedStates: states.length,
    decisionStates: states.filter((state) => state.legalMoves > 1).length,
    forcedStates: states.filter((state) => state.legalMoves <= 1).length,
    totalAlternativeMoves,
    optimalAlternativeMoves: allAlternatives.filter((entry) => entry.status === 'optimal-alternative').length,
    recoverableMistakes,
    deadEndMoves,
    unknownMoves: allAlternatives.filter((entry) => entry.status === 'unknown').length,
    knownNonOptimalMoves,
    deadEndRatioKnown: knownNonOptimalMoves === 0 ? 0 : deadEndMoves / knownNonOptimalMoves,
    averageRecoveryPenalty: penalties.length === 0
      ? 0
      : penalties.reduce((sum, value) => sum + value, 0) / penalties.length,
    maxRecoveryPenalty: penalties.length === 0 ? 0 : Math.max(...penalties),
    highPenaltyMistakes: penalties.filter((penalty) => penalty >= highPenaltyThreshold).length,
    states,
  }
}

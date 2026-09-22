import { applyMove } from './rules'
import { listLegalMoves, solveBoard } from './solver'
import { packBoard, packedStateKey } from './solver-state'
import type { Board, Move, MistakeAnalysis, MistakeStateAnalysis, AlternativeMoveAnalysis, MoveLocalFeatures } from './types'

export interface MistakeAnalysisOptions {
  capacity?: number
  maxVisitedStates?: number
  maxDepthExtra?: number
  highPenaltyThreshold?: number
}

type DistanceCacheEntry =
  | { status: 'solved'; distance: number }
  | { status: 'unsolvable' }
  | { status: 'unknown' }

function segmentCount(board: Board): number {
  let segments = 0
  for (const tube of board) {
    for (let index = 0; index < tube.length; index += 1) {
      if (index === 0 || tube[index] !== tube[index - 1]) segments += 1
    }
  }
  return segments
}

function localFeatures(
  board: Board,
  nextBoard: Board,
  move: Move,
  capacity: number,
): MoveLocalFeatures {
  const target = board[move.to]
  const joinsSameType = target.length > 0 && target[target.length - 1] === move.color
  const nextTarget = nextBoard[move.to]
  const targetBecomesComplete = nextTarget.length === capacity
    && nextTarget.every((type) => type === nextTarget[0])

  return {
    destination: target.length === 0 ? 'empty' : 'same-type',
    joinsSameType,
    movedAmount: move.amount,
    sourceBecomesEmpty: nextBoard[move.from].length === 0,
    targetBecomesComplete,
    segmentDelta: segmentCount(nextBoard) - segmentCount(board),
  }
}

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
      const features = localFeatures(board, nextBoard, move, capacity)
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
        alternatives.push({ move, features, status: 'unknown' })
        continue
      }

      if (cached.status === 'unsolvable') {
        alternatives.push({ move, features, status: 'dead-end' })
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
          features,
          status: 'optimal-alternative',
          nextOptimalMoves: cached.distance,
          recoveryPenalty: 0,
        })
      } else {
        alternatives.push({
          move,
          features,
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

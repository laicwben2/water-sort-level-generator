import { applyMove, isUniform, topColor } from './rules'
import { analyzeSolutionPath, listLegalMoves, solveBoard } from './solver'
import { packBoard, packedStateKey } from './solver-state'
import type {
  Board,
  DifficultyV2Metrics,
  MistakeAnalysisConfig,
  MistakeRecoveryMetrics,
  Move,
  OptimalPathDifficultyMetrics,
  StructuralDifficultyMetrics,
} from './types'

export const DEFAULT_MISTAKE_ANALYSIS_CONFIG: MistakeAnalysisConfig = {
  maxVisitedStatesPerAlternative: 25_000,
  maxDepthPerAlternative: 100,
  maxAnalyzedSteps: 20,
  maxAlternativesPerStep: 6,
  severeRecoveryThreshold: 5,
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function segmentCount(tube: readonly number[]): number {
  let segments = 0
  for (let index = 0; index < tube.length; index += 1) {
    if (index === 0 || tube[index] !== tube[index - 1]) segments += 1
  }
  return segments
}

export function analyzeStructuralDifficulty(
  board: Board,
  capacity = 4,
): StructuralDifficultyMetrics {
  const types = [...new Set(board.flat())]
  const typeTubeSpread = new Map<number, Set<number>>()
  let initialSegments = 0
  let mixedTubeCount = 0
  let monochromeFullTubeCount = 0
  const blockingDepths: number[] = []

  for (let tubeIndex = 0; tubeIndex < board.length; tubeIndex += 1) {
    const tube = board[tubeIndex]
    initialSegments += segmentCount(tube)

    const uniqueTypes = new Set(tube)
    if (uniqueTypes.size > 1) mixedTubeCount += 1
    const completed = tube.length === capacity && tube.length > 0 && isUniform(tube)
    if (completed) monochromeFullTubeCount += 1

    for (const type of uniqueTypes) {
      let tubes = typeTubeSpread.get(type)
      if (!tubes) {
        tubes = new Set<number>()
        typeTubeSpread.set(type, tubes)
      }
      tubes.add(tubeIndex)
    }

    if (!completed) {
      let segmentStart = 0
      while (segmentStart < tube.length) {
        let segmentEnd = segmentStart
        while (segmentEnd + 1 < tube.length && tube[segmentEnd + 1] === tube[segmentStart]) {
          segmentEnd += 1
        }
        blockingDepths.push(tube.length - 1 - segmentEnd)
        segmentStart = segmentEnd + 1
      }
    }
  }

  const spreads = types.map((type) => typeTubeSpread.get(type)?.size ?? 0)
  const typeCount = types.length

  return {
    typeCount,
    tubeCount: board.length,
    initialEmptyTubes: board.filter((tube) => tube.length === 0).length,
    initialSegments,
    fragmentationExcess: Math.max(0, initialSegments - typeCount),
    averageTypeTubeSpread: average(spreads),
    maximumTypeTubeSpread: spreads.length === 0 ? 0 : Math.max(...spreads),
    averageBlockingDepth: average(blockingDepths),
    maximumBlockingDepth: blockingDepths.length === 0 ? 0 : Math.max(...blockingDepths),
    mixedTubeCount,
    monochromeFullTubeCount,
  }
}

export function analyzeOptimalPathDifficulty(
  initialBoard: Board,
  optimalSolution: readonly Move[],
  capacity = 4,
): OptimalPathDifficultyMetrics {
  const base = analyzeSolutionPath(initialBoard, optimalSolution, capacity)
  let board = initialBoard.map((tube) => [...tube])
  let movesIntoEmptyTube = 0
  let movesJoiningSameType = 0

  for (const move of optimalSolution) {
    const target = board[move.to]
    if (target.length === 0) movesIntoEmptyTube += 1
    else if (topColor(target) === move.color) movesJoiningSameType += 1
    board = applyMove(board, move)
  }

  return {
    optimalMoves: optimalSolution.length,
    ...base,
    movesIntoEmptyTube,
    movesJoiningSameType,
    stagingRatio: optimalSolution.length === 0 ? 0 : movesIntoEmptyTube / optimalSolution.length,
  }
}

export function selectDifficultyAnalysisSteps(
  optimalMoves: number,
  maxAnalyzedSteps: number,
): number[] {
  if (!Number.isInteger(optimalMoves) || optimalMoves < 0) {
    throw new Error('optimalMoves must be a non-negative integer')
  }
  if (!Number.isInteger(maxAnalyzedSteps) || maxAnalyzedSteps < 1) {
    throw new Error('maxAnalyzedSteps must be a positive integer')
  }
  if (optimalMoves === 0) return []
  if (optimalMoves <= maxAnalyzedSteps) {
    return Array.from({ length: optimalMoves }, (_, index) => index)
  }
  if (maxAnalyzedSteps === 1) return [0]

  const selected = new Set<number>()
  for (let index = 0; index < maxAnalyzedSteps; index += 1) {
    selected.add(Math.round(index * (optimalMoves - 1) / (maxAnalyzedSteps - 1)))
  }
  return [...selected].sort((first, second) => first - second)
}

function boardKey(board: Board, capacity: number): bigint {
  return packedStateKey(packBoard(board, capacity))
}

export function analyzeMistakeRecovery(
  initialBoard: Board,
  optimalSolution: readonly Move[],
  capacity = 4,
  config: MistakeAnalysisConfig = DEFAULT_MISTAKE_ANALYSIS_CONFIG,
): MistakeRecoveryMetrics {
  const selectedSteps = new Set(selectDifficultyAnalysisSteps(
    optimalSolution.length,
    config.maxAnalyzedSteps,
  ))
  const cache = new Map<bigint, ReturnType<typeof solveBoard>>()

  let board = initialBoard.map((tube) => [...tube])
  let eligibleAlternatives = 0
  let analyzedAlternatives = 0
  let skippedAlternatives = 0
  let equivalentOptimalSuccessorsExcluded = 0
  let optimalAlternativeCount = 0
  let recoverableMistakeCount = 0
  let deadEndCount = 0
  let unknownCount = 0
  let recoveryPenaltyTotal = 0
  let maximumRecoveryPenalty = 0
  let severeRecoveryCount = 0

  for (let stepIndex = 0; stepIndex < optimalSolution.length; stepIndex += 1) {
    const optimalMove = optimalSolution[stepIndex]

    if (selectedSteps.has(stepIndex)) {
      const optimalSuccessor = applyMove(board, optimalMove)
      const optimalSuccessorKey = boardKey(optimalSuccessor, capacity)
      const alternatives: Array<{ move: Move; board: Board; key: bigint }> = []

      for (const move of listLegalMoves(board, capacity)) {
        const successor = applyMove(board, move)
        const key = boardKey(successor, capacity)
        if (key === optimalSuccessorKey) {
          if (move.from !== optimalMove.from || move.to !== optimalMove.to) {
            equivalentOptimalSuccessorsExcluded += 1
          }
          continue
        }
        alternatives.push({ move, board: successor, key })
      }

      eligibleAlternatives += alternatives.length
      const selectedAlternatives = alternatives.slice(0, config.maxAlternativesPerStep)
      skippedAlternatives += alternatives.length - selectedAlternatives.length

      const optimalRemaining = optimalSolution.length - stepIndex

      for (const alternative of selectedAlternatives) {
        analyzedAlternatives += 1
        let result = cache.get(alternative.key)
        if (!result) {
          result = solveBoard(alternative.board, {
            capacity,
            maxVisitedStates: config.maxVisitedStatesPerAlternative,
            maxDepth: config.maxDepthPerAlternative,
          })
          cache.set(alternative.key, result)
        }

        if (result.status === 'budget-exceeded') {
          unknownCount += 1
          continue
        }

        if (result.status === 'unsolvable') {
          deadEndCount += 1
          continue
        }

        const penalty = 1 + result.solution.length - optimalRemaining
        if (penalty < 0) {
          throw new Error('Alternative path is shorter than the stored optimal solution')
        }
        if (penalty === 0) {
          optimalAlternativeCount += 1
          continue
        }

        recoverableMistakeCount += 1
        recoveryPenaltyTotal += penalty
        maximumRecoveryPenalty = Math.max(maximumRecoveryPenalty, penalty)
        if (penalty >= config.severeRecoveryThreshold) severeRecoveryCount += 1
      }
    }

    board = applyMove(board, optimalMove)
  }

  const knownAlternatives = optimalAlternativeCount + recoverableMistakeCount + deadEndCount
  const knownMistakes = recoverableMistakeCount + deadEndCount

  return {
    config: { ...config },
    analyzedSteps: selectedSteps.size,
    skippedSteps: optimalSolution.length - selectedSteps.size,
    eligibleAlternatives,
    analyzedAlternatives,
    skippedAlternatives,
    equivalentOptimalSuccessorsExcluded,
    optimalAlternativeCount,
    recoverableMistakeCount,
    deadEndCount,
    unknownCount,
    analyzedCoverage: eligibleAlternatives === 0 ? 1 : analyzedAlternatives / eligibleAlternatives,
    knownCoverage: eligibleAlternatives === 0 ? 1 : knownAlternatives / eligibleAlternatives,
    deadEndRatio: knownMistakes === 0 ? 0 : deadEndCount / knownMistakes,
    averageRecoveryPenalty: recoverableMistakeCount === 0
      ? 0
      : recoveryPenaltyTotal / recoverableMistakeCount,
    maximumRecoveryPenalty,
    severeRecoveryCount,
  }
}

export function analyzeDifficultyV2(
  board: Board,
  optimalSolution: readonly Move[],
  capacity = 4,
  mistakeConfig?: MistakeAnalysisConfig,
): DifficultyV2Metrics {
  return {
    structural: analyzeStructuralDifficulty(board, capacity),
    optimalPath: analyzeOptimalPathDifficulty(board, optimalSolution, capacity),
    ...(mistakeConfig
      ? { mistakeRecovery: analyzeMistakeRecovery(board, optimalSolution, capacity, mistakeConfig) }
      : {}),
  }
}

import { CANONICAL_VERSION, ENCODING_VERSION, canonicalPuzzleKey } from './canonical'
import { generateBalancedFullTubes } from './candidate'
import { applyMove, calculatePour, isSolved } from './rules'
import { deriveCandidateSeed, deriveLevelId } from './rng'
import { analyzeSolutionPath } from './solver'
import type { AuditCatalog, SolverMetrics } from './types'
import { GENERATOR_VERSION, RNG_VERSION, SOLVER_STATE_ENCODING_VERSION } from './version'

export interface ValidationSummary {
  valid: true
  puzzles: number
  byDifficulty: Record<string, number>
}

function approximatelyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= 1e-12
}

const solverCountNames = [
  'exploredStates',
  'visitedStates',
  'generatedMoves',
  'maxDepthReached',
] as const
const solverMetricNames = [...solverCountNames, 'averageBranching'] as const

function validateSolverMetrics(puzzleId: string, metrics: SolverMetrics) {
  for (const name of solverCountNames) {
    const value = metrics[name]
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Invalid solver ${name}: ${puzzleId}`)
    }
  }
  if (metrics.exploredStates === 0 || metrics.visitedStates === 0) {
    throw new Error(`Exact solver proof has no visited states: ${puzzleId}`)
  }
  const expectedBranching = metrics.generatedMoves / metrics.exploredStates
  if (!Number.isFinite(metrics.averageBranching)
    || metrics.averageBranching < 0
    || !approximatelyEqual(metrics.averageBranching, expectedBranching)) {
    throw new Error(`Inconsistent solver averageBranching: ${puzzleId}`)
  }
}

function validateMistakeAnalysis(puzzleId: string, metrics: NonNullable<AuditCatalog['puzzles'][number]['mistakeAnalysis']>) {
  for (const [name, value] of [
    ['analyzedStates', metrics.analyzedStates],
    ['decisionStates', metrics.decisionStates],
    ['alternatives', metrics.alternatives],
    ['optimalEquivalentAlternatives', metrics.optimalEquivalentAlternatives],
    ['recoverableAlternatives', metrics.recoverableAlternatives],
    ['deadEndAlternatives', metrics.deadEndAlternatives],
    ['unknownAlternatives', metrics.unknownAlternatives],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Invalid ${name} in mistake analysis: ${puzzleId}`)
    }
  }
  if (metrics.analyzedStates === 0 && metrics.alternatives !== 0) {
    throw new Error(`Mistake-analysis alternatives without analyzed states: ${puzzleId}`)
  }
  const countedAlternatives = metrics.optimalEquivalentAlternatives
    + metrics.recoverableAlternatives
    + metrics.deadEndAlternatives
    + metrics.unknownAlternatives

  if (countedAlternatives !== metrics.alternatives) {
    throw new Error(`Mistake-analysis alternative count mismatch: ${puzzleId}`)
  }
  if (metrics.decisionStates > metrics.analyzedStates) {
    throw new Error(`Mistake-analysis decision count exceeds analyzed states: ${puzzleId}`)
  }
  if (metrics.decisionStates > metrics.alternatives
    || (metrics.decisionStates === 0) !== (metrics.alternatives === 0)) {
    throw new Error(`Mistake-analysis decision count disagrees with alternatives: ${puzzleId}`)
  }

  const knownAlternatives = metrics.alternatives - metrics.unknownAlternatives
  const knownWrongAlternatives = metrics.recoverableAlternatives + metrics.deadEndAlternatives

  const expectedCoverage = metrics.alternatives === 0 ? 1 : knownAlternatives / metrics.alternatives
  const expectedAlternativesPerState = metrics.analyzedStates === 0 ? 0 : metrics.alternatives / metrics.analyzedStates
  const expectedWrongMoveDensity = knownAlternatives === 0 ? 0 : knownWrongAlternatives / knownAlternatives
  const expectedDeadEndDensity = knownAlternatives === 0 ? 0 : metrics.deadEndAlternatives / knownAlternatives
  const expectedDeadEndRisk = knownWrongAlternatives === 0 ? 0 : metrics.deadEndAlternatives / knownWrongAlternatives

  for (const [name, value, expected] of [
    ['analysisCoverage', metrics.analysisCoverage, expectedCoverage],
    ['alternativesPerAnalyzedState', metrics.alternativesPerAnalyzedState, expectedAlternativesPerState],
    ['wrongMoveDensity', metrics.wrongMoveDensity, expectedWrongMoveDensity],
    ['deadEndDensity', metrics.deadEndDensity, expectedDeadEndDensity],
    ['deadEndRisk', metrics.deadEndRisk, expectedDeadEndRisk],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid ${name} in mistake analysis: ${puzzleId}`)
    }
    if (name !== 'alternativesPerAnalyzedState' && value > 1) {
      throw new Error(`Invalid ${name} in mistake analysis: ${puzzleId}`)
    }
    if (!approximatelyEqual(value, expected)) {
      throw new Error(`Inconsistent ${name} in mistake analysis: ${puzzleId}`)
    }
  }

  for (const [name, value] of [
    ['averageRecoveryPenalty', metrics.averageRecoveryPenalty],
    ['p50RecoveryPenalty', metrics.p50RecoveryPenalty],
    ['p90RecoveryPenalty', metrics.p90RecoveryPenalty],
    ['maxRecoveryPenalty', metrics.maxRecoveryPenalty],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid ${name} in mistake analysis: ${puzzleId}`)
    }
  }

  if (metrics.p50RecoveryPenalty > metrics.p90RecoveryPenalty
    || metrics.p90RecoveryPenalty > metrics.maxRecoveryPenalty) {
    throw new Error(`Recovery penalty percentiles are not monotonic: ${puzzleId}`)
  }
  const penalties = [
    metrics.averageRecoveryPenalty,
    metrics.p50RecoveryPenalty,
    metrics.p90RecoveryPenalty,
    metrics.maxRecoveryPenalty,
  ]
  const invalidPenalties = metrics.recoverableAlternatives === 0
    ? penalties.some((value) => value !== 0)
    : penalties.some((value) => value < 1)
      || !Number.isSafeInteger(metrics.p50RecoveryPenalty)
      || !Number.isSafeInteger(metrics.p90RecoveryPenalty)
      || !Number.isSafeInteger(metrics.maxRecoveryPenalty)
      || metrics.averageRecoveryPenalty > metrics.maxRecoveryPenalty
  if (invalidPenalties) {
    throw new Error(`Recovery penalty metrics disagree with recoverable count: ${puzzleId}`)
  }
}

export function validateAuditCatalog(catalog: AuditCatalog): ValidationSummary {
  if (catalog.version !== 'audit-v2') throw new Error(`Unsupported audit version: ${catalog.version}`)
  if (catalog.reproducibility.generatorVersion !== GENERATOR_VERSION) {
    throw new Error('Generator version mismatch')
  }
  if (catalog.reproducibility.rngVersion !== RNG_VERSION) throw new Error('RNG version mismatch')
  if (catalog.reproducibility.canonicalVersion !== CANONICAL_VERSION) {
    throw new Error('Canonical version mismatch')
  }
  if (catalog.reproducibility.encodingVersion !== ENCODING_VERSION) {
    throw new Error('Encoding version mismatch')
  }
  if (catalog.reproducibility.solverStateEncodingVersion !== SOLVER_STATE_ENCODING_VERSION) {
    throw new Error('Solver state encoding version mismatch')
  }

  if (catalog.puzzles.length === 0) throw new Error('Audit catalog must contain puzzles')

  const ids = new Set<string>()
  const canonicalKeys = new Set<string>()
  const byDifficulty: Record<string, number> = {}

  for (const puzzle of catalog.puzzles) {
    if (!puzzle.id.trim()) throw new Error('Puzzle id must not be empty')
    if (!['easy', 'medium', 'hard'].includes(puzzle.difficulty)) {
      throw new Error(`Invalid difficulty: ${puzzle.id}`)
    }
    if (ids.has(puzzle.id)) throw new Error(`Duplicate puzzle id: ${puzzle.id}`)
    ids.add(puzzle.id)

    if (!Number.isInteger(puzzle.candidateIndex) || puzzle.candidateIndex < 0) {
      throw new Error(`Invalid candidate index: ${puzzle.id}`)
    }
    if (puzzle.candidateSeed !== deriveCandidateSeed(
      catalog.reproducibility.batchSeed,
      catalog.profile,
      puzzle.difficulty,
      puzzle.candidateIndex,
    )) {
      throw new Error(`Candidate seed mismatch: ${puzzle.id}`)
    }

    if (canonicalKeys.has(puzzle.canonicalKey)) throw new Error(`Canonical duplicate: ${puzzle.id}`)
    canonicalKeys.add(puzzle.canonicalKey)

    if (!Number.isInteger(puzzle.capacity) || puzzle.capacity < 1 || puzzle.capacity > 4) {
      throw new Error(`Unsupported capacity: ${puzzle.id}`)
    }
    if (puzzle.id !== deriveLevelId(
      catalog.reproducibility.batchSeed,
      catalog.profile,
      puzzle.difficulty,
      puzzle.capacity,
      puzzle.candidateIndex,
    )) {
      throw new Error(`Level ID mismatch: ${puzzle.id}`)
    }
    if (puzzle.board.some((tube) => tube.some((type) =>
      !Number.isInteger(type) || type < 0 || type >= 16))) {
      throw new Error(`Invalid Type ID: ${puzzle.id}`)
    }
    if (!Number.isSafeInteger(puzzle.emptyTubes)
      || puzzle.emptyTubes < 1
      || puzzle.emptyTubes > puzzle.board.length) {
      throw new Error(`Invalid empty tube count: ${puzzle.id}`)
    }
    const typeCount = new Set(puzzle.board.flat()).size
    if (typeCount < 1) throw new Error(`Puzzle has no Types: ${puzzle.id}`)
    const reconstructedBoard = [
      ...generateBalancedFullTubes(typeCount, puzzle.capacity, puzzle.candidateSeed),
      ...Array.from({ length: puzzle.emptyTubes }, () => []),
    ]
    if (JSON.stringify(puzzle.board) !== JSON.stringify(reconstructedBoard)) {
      throw new Error(`Candidate board mismatch: ${puzzle.id}`)
    }
    if (canonicalPuzzleKey(puzzle.board) !== puzzle.canonicalKey) {
      throw new Error(`Invalid canonical key: ${puzzle.id}`)
    }
    if (isSolved(puzzle.board, puzzle.capacity)) throw new Error(`Starts solved: ${puzzle.id}`)
    if (puzzle.emptyTubes !== puzzle.minimumRequiredEmptyTubes) {
      throw new Error(`Minimum empty tube mismatch: ${puzzle.id}`)
    }
    if (puzzle.board.filter((tube) => tube.length === 0).length !== puzzle.emptyTubes) {
      throw new Error(`Empty tube mismatch: ${puzzle.id}`)
    }
    if (!puzzle.board.every((tube) => tube.length === 0 || tube.length === puzzle.capacity)) {
      throw new Error(`Non-classic occupancy: ${puzzle.id}`)
    }

    validateSolverMetrics(puzzle.id, puzzle.solver)
    if (puzzle.solver.maxDepthReached < puzzle.solver.optimalMoves) {
      throw new Error(`Solver proof depth shorter than optimal solution: ${puzzle.id}`)
    }
    if (puzzle.emptyTubeAnalysis.length !== puzzle.minimumRequiredEmptyTubes) {
      throw new Error(`Incomplete minimum-empty proof: ${puzzle.id}`)
    }
    for (let index = 0; index < puzzle.emptyTubeAnalysis.length; index += 1) {
      const analysis = puzzle.emptyTubeAnalysis[index]
      validateSolverMetrics(puzzle.id, analysis.metrics)
      const expectedEmptyTubes = index + 1
      if (analysis.emptyTubes !== expectedEmptyTubes) {
        throw new Error(`Non-sequential empty-tube proof: ${puzzle.id}`)
      }
      const isMinimum = expectedEmptyTubes === puzzle.minimumRequiredEmptyTubes
      if (isMinimum && analysis.status !== 'solved') {
        throw new Error(`Minimum empty-tube result must be solved: ${puzzle.id}`)
      }
      if (!isMinimum && analysis.status !== 'unsolvable') {
        throw new Error(`Smaller empty-tube count must be proven unsolvable: ${puzzle.id}`)
      }
      if (isMinimum && analysis.optimalMoves !== puzzle.solver.optimalMoves) {
        throw new Error(`Minimum empty-tube optimal moves mismatch: ${puzzle.id}`)
      }
      if (isMinimum && solverMetricNames.some((name) =>
        analysis.metrics[name] !== puzzle.solver[name])) {
        throw new Error(`Minimum empty-tube solver metrics mismatch: ${puzzle.id}`)
      }
      if (!isMinimum && analysis.optimalMoves !== undefined) {
        throw new Error(`Unsolvable empty-tube result has optimal moves: ${puzzle.id}`)
      }
    }

    const colorCounts = new Map<number, number>()
    for (const color of puzzle.board.flat()) colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1)
    if ([...colorCounts.values()].some((count) => count !== puzzle.capacity)) {
      throw new Error(`Color conservation failure: ${puzzle.id}`)
    }

    let board = puzzle.board.map((tube) => [...tube])
    for (const expectedMove of puzzle.optimalSolution) {
      const move = calculatePour(board, expectedMove.from, expectedMove.to, puzzle.capacity)
      if (!move
        || move.from !== expectedMove.from
        || move.to !== expectedMove.to
        || move.color !== expectedMove.color
        || move.amount !== expectedMove.amount) {
        throw new Error(`Invalid saved move: ${puzzle.id}`)
      }
      board = applyMove(board, expectedMove)
    }

    if (!isSolved(board, puzzle.capacity)) throw new Error(`Solution does not finish: ${puzzle.id}`)
    if (puzzle.optimalSolution.length !== puzzle.solver.optimalMoves) {
      throw new Error(`Solution length mismatch: ${puzzle.id}`)
    }
    const solutionPath = analyzeSolutionPath(puzzle.board, puzzle.optimalSolution, puzzle.capacity)
    if (solutionPath.decisionSteps !== puzzle.solutionPath.decisionSteps
      || solutionPath.forcedSteps !== puzzle.solutionPath.forcedSteps
      || solutionPath.totalAlternativeMoves !== puzzle.solutionPath.totalAlternativeMoves
      || solutionPath.averageChoices !== puzzle.solutionPath.averageChoices
      || solutionPath.maximumChoices !== puzzle.solutionPath.maximumChoices) {
      throw new Error(`Solution path metrics mismatch: ${puzzle.id}`)
    }

    if (puzzle.mistakeAnalysis) {
      if (puzzle.mistakeAnalysis.analyzedStates > puzzle.optimalSolution.length) {
        throw new Error(`Mistake-analysis states exceed optimal path: ${puzzle.id}`)
      }
      validateMistakeAnalysis(puzzle.id, puzzle.mistakeAnalysis)
    }

    byDifficulty[puzzle.difficulty] = (byDifficulty[puzzle.difficulty] ?? 0) + 1
  }

  return { valid: true, puzzles: catalog.puzzles.length, byDifficulty }
}

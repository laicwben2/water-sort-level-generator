import { CANONICAL_VERSION, ENCODING_VERSION, canonicalPuzzleKey } from './canonical'
import { applyMove, calculatePour, isSolved } from './rules'
import { analyzeSolutionPath } from './solver'
import type { AuditCatalog } from './types'
import { GENERATOR_VERSION, RNG_VERSION, SOLVER_STATE_ENCODING_VERSION } from './version'

export function validateDifficultyV2(puzzleId: string, analysis: import('./types').MistakeAnalysis, optimalMoves: number) {
  if (analysis.analyzedStates !== optimalMoves || analysis.states.length !== optimalMoves) {
    throw new Error(`Difficulty v2 state count mismatch: ${puzzleId}`)
  }

  let optimalAlternatives = 0
  let recoverableMistakes = 0
  let deadEndMoves = 0
  let unknownMoves = 0
  const penalties: number[] = []

  for (let index = 0; index < analysis.states.length; index += 1) {
    const state = analysis.states[index]
    if (state.pathIndex !== index) throw new Error(`Difficulty v2 path index mismatch: ${puzzleId}`)
    if (state.remainingOptimalMoves !== optimalMoves - index) {
      throw new Error(`Difficulty v2 remaining-distance mismatch: ${puzzleId}`)
    }

    const stateOptimal = state.alternatives.filter((entry) => entry.status === 'optimal-alternative').length
    const stateRecoverable = state.alternatives.filter((entry) => entry.status === 'recoverable-mistake').length
    const stateDead = state.alternatives.filter((entry) => entry.status === 'dead-end').length
    const stateUnknown = state.alternatives.filter((entry) => entry.status === 'unknown').length
    const statePenalties = state.alternatives.flatMap((entry) =>
      entry.status === 'recoverable-mistake' ? [entry.recoveryPenalty] : [])

    if (state.alternatives.length !== Math.max(0, state.legalMoves - 1)) {
      throw new Error(`Difficulty v2 alternate count mismatch: ${puzzleId}`)
    }
    if (state.optimalAlternatives !== stateOptimal
      || state.recoverableMistakes !== stateRecoverable
      || state.deadEndMoves !== stateDead
      || state.unknownMoves !== stateUnknown) {
      throw new Error(`Difficulty v2 state aggregate mismatch: ${puzzleId}`)
    }

    const expectedMaxPenalty = statePenalties.length === 0 ? 0 : Math.max(...statePenalties)
    if (state.maxRecoveryPenalty !== expectedMaxPenalty) {
      throw new Error(`Difficulty v2 state penalty mismatch: ${puzzleId}`)
    }

    optimalAlternatives += stateOptimal
    recoverableMistakes += stateRecoverable
    deadEndMoves += stateDead
    unknownMoves += stateUnknown
    penalties.push(...statePenalties)
  }

  const totalAlternativeMoves = optimalAlternatives + recoverableMistakes + deadEndMoves + unknownMoves
  const knownNonOptimalMoves = recoverableMistakes + deadEndMoves
  const expectedDeadEndRatio = knownNonOptimalMoves === 0 ? 0 : deadEndMoves / knownNonOptimalMoves
  const expectedAveragePenalty = penalties.length === 0
    ? 0
    : penalties.reduce((sum, value) => sum + value, 0) / penalties.length
  const expectedMaxPenalty = penalties.length === 0 ? 0 : Math.max(...penalties)

  if (analysis.totalAlternativeMoves !== totalAlternativeMoves
    || analysis.optimalAlternativeMoves !== optimalAlternatives
    || analysis.recoverableMistakes !== recoverableMistakes
    || analysis.deadEndMoves !== deadEndMoves
    || analysis.unknownMoves !== unknownMoves
    || analysis.knownNonOptimalMoves !== knownNonOptimalMoves
    || analysis.deadEndRatioKnown !== expectedDeadEndRatio
    || analysis.averageRecoveryPenalty !== expectedAveragePenalty
    || analysis.maxRecoveryPenalty !== expectedMaxPenalty) {
    throw new Error(`Difficulty v2 puzzle aggregate mismatch: ${puzzleId}`)
  }

  const decisionStates = analysis.states.filter((state) => state.legalMoves > 1).length
  const forcedStates = analysis.states.filter((state) => state.legalMoves <= 1).length
  if (analysis.decisionStates !== decisionStates || analysis.forcedStates !== forcedStates) {
    throw new Error(`Difficulty v2 decision-state mismatch: ${puzzleId}`)
  }
}

export interface ValidationSummary {
  valid: true
  puzzles: number
  byDifficulty: Record<string, number>
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

  const ids = new Set<string>()
  const canonicalKeys = new Set<string>()
  const byDifficulty: Record<string, number> = {}

  for (const puzzle of catalog.puzzles) {
    if (ids.has(puzzle.id)) throw new Error(`Duplicate puzzle id: ${puzzle.id}`)
    ids.add(puzzle.id)

    if (!Number.isInteger(puzzle.candidateIndex) || puzzle.candidateIndex < 0) {
      throw new Error(`Invalid candidate index: ${puzzle.id}`)
    }
    if (!puzzle.candidateSeed) throw new Error(`Missing candidate seed: ${puzzle.id}`)

    if (canonicalKeys.has(puzzle.canonicalKey)) throw new Error(`Canonical duplicate: ${puzzle.id}`)
    canonicalKeys.add(puzzle.canonicalKey)

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

    if (puzzle.emptyTubeAnalysis.length !== puzzle.minimumRequiredEmptyTubes) {
      throw new Error(`Incomplete minimum-empty proof: ${puzzle.id}`)
    }
    for (let index = 0; index < puzzle.emptyTubeAnalysis.length; index += 1) {
      const analysis = puzzle.emptyTubeAnalysis[index]
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
    }

    const colorCounts = new Map<number, number>()
    for (const color of puzzle.board.flat()) colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1)
    if ([...colorCounts.values()].some((count) => count !== puzzle.capacity)) {
      throw new Error(`Color conservation failure: ${puzzle.id}`)
    }

    let board = puzzle.board.map((tube) => [...tube])
    for (const expectedMove of puzzle.optimalSolution) {
      const move = calculatePour(board, expectedMove.from, expectedMove.to, puzzle.capacity)
      if (JSON.stringify(move) !== JSON.stringify(expectedMove)) {
        throw new Error(`Invalid saved move: ${puzzle.id}`)
      }
      board = applyMove(board, expectedMove)
    }

    if (!isSolved(board, puzzle.capacity)) throw new Error(`Solution does not finish: ${puzzle.id}`)
    if (puzzle.optimalSolution.length !== puzzle.solver.optimalMoves) {
      throw new Error(`Solution length mismatch: ${puzzle.id}`)
    }
    if (JSON.stringify(analyzeSolutionPath(puzzle.board, puzzle.optimalSolution, puzzle.capacity))
      !== JSON.stringify(puzzle.solutionPath)) {
      throw new Error(`Solution path metrics mismatch: ${puzzle.id}`)
    }
    validateDifficultyV2(puzzle.id, puzzle.difficultyV2, puzzle.solver.optimalMoves)

    byDifficulty[puzzle.difficulty] = (byDifficulty[puzzle.difficulty] ?? 0) + 1
  }

  return { valid: true, puzzles: catalog.puzzles.length, byDifficulty }
}

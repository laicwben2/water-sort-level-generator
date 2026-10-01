import { CANONICAL_VERSION, ENCODING_VERSION, canonicalPuzzleKey } from './canonical'
import { generateBalancedFullTubes } from './candidate'
import { PUZZLE_ID_VERSION, derivePuzzleIdFromCanonicalKey } from './identity'
import {
  RESEARCH_GENERATOR_FAMILY,
  RESEARCH_PROOF_BUDGET_VERSION,
  researchStratumId,
} from './research-config'
import { applyMove, calculatePour, isSolved } from './rules'
import { deriveResearchCandidateSeed } from './rng'
import { analyzeSolutionPath } from './solver'
import { analyzeStructure } from './structure'
import type { ResearchCandidateCatalog, SolverMetrics } from './types'
import { GENERATOR_VERSION, RNG_VERSION, SOLVER_STATE_ENCODING_VERSION } from './version'

export interface ResearchValidationSummary {
  valid: true
  puzzles: number
  typeCount: number
}

const solverMetricNames = [
  'exploredStates',
  'visitedStates',
  'generatedMoves',
  'maxDepthReached',
] as const

function approximatelyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= 1e-12
}

function validateSolverMetrics(id: string, metrics: SolverMetrics): void {
  for (const name of solverMetricNames) {
    const value = metrics[name]
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Invalid solver ${name}: ${id}`)
    }
  }
  if (metrics.exploredStates === 0 || metrics.visitedStates === 0) {
    throw new Error(`Exact solver proof has no visited states: ${id}`)
  }
  const expectedBranching = metrics.generatedMoves / metrics.exploredStates
  if (!Number.isFinite(metrics.averageBranching)
    || metrics.averageBranching < 0
    || !approximatelyEqual(metrics.averageBranching, expectedBranching)) {
    throw new Error(`Inconsistent solver averageBranching: ${id}`)
  }
}

export function validateResearchCandidateCatalog(
  catalog: ResearchCandidateCatalog,
): ResearchValidationSummary {
  if (catalog.version !== 'research-candidates-v1') {
    throw new Error(`Unsupported research catalog version: ${catalog.version}`)
  }
  if (catalog.generator !== 'balanced-shuffle+bounded-a-star') {
    throw new Error(`Unsupported research generator: ${catalog.generator}`)
  }
  if (catalog.generatorFamily !== RESEARCH_GENERATOR_FAMILY) {
    throw new Error(`Unsupported research generator family: ${catalog.generatorFamily}`)
  }
  if (catalog.stratum.id !== researchStratumId(catalog.stratum.typeCount)) {
    throw new Error('Research stratum ID/typeCount mismatch')
  }

  const versions = catalog.reproducibility
  if (versions.generatorVersion !== GENERATOR_VERSION) throw new Error('Generator version mismatch')
  if (versions.rngVersion !== RNG_VERSION) throw new Error('RNG version mismatch')
  if (versions.canonicalVersion !== CANONICAL_VERSION) throw new Error('Canonical version mismatch')
  if (versions.encodingVersion !== ENCODING_VERSION) throw new Error('Encoding version mismatch')
  if (versions.solverStateEncodingVersion !== SOLVER_STATE_ENCODING_VERSION) {
    throw new Error('Solver state encoding version mismatch')
  }
  if (versions.puzzleIdentityVersion !== PUZZLE_ID_VERSION) {
    throw new Error('Puzzle identity version mismatch')
  }
  if (versions.proofBudgetVersion !== RESEARCH_PROOF_BUDGET_VERSION) {
    throw new Error('Research proof budget version mismatch')
  }
  if (catalog.puzzles.length === 0) throw new Error('Research catalog must contain puzzles')

  const canonicalKeys = new Set<string>()
  const puzzleIds = new Set<string>()

  for (const puzzle of catalog.puzzles) {
    const id = puzzle.puzzleId
    if (!id.trim()) throw new Error('Research puzzleId must not be empty')
    if (puzzle.stratumId !== catalog.stratum.id || puzzle.typeCount !== catalog.stratum.typeCount) {
      throw new Error(`Research puzzle stratum mismatch: ${id}`)
    }
    if (!Number.isSafeInteger(puzzle.candidateIndex) || puzzle.candidateIndex < 0) {
      throw new Error(`Invalid candidate index: ${id}`)
    }
    const expectedSeed = deriveResearchCandidateSeed(
      catalog.reproducibility.batchSeed,
      catalog.generatorFamily,
      catalog.stratum.id,
      puzzle.candidateIndex,
    )
    if (puzzle.candidateSeed !== expectedSeed) {
      throw new Error(`Research candidate seed mismatch: ${id}`)
    }
    if (!Number.isSafeInteger(puzzle.capacity) || puzzle.capacity < 1 || puzzle.capacity > 4) {
      throw new Error(`Unsupported capacity: ${id}`)
    }

    const typeIds = puzzle.board.flat()
    if (typeIds.some((type) => !Number.isInteger(type) || type < 0 || type >= 16)) {
      throw new Error(`Invalid Type ID: ${id}`)
    }
    if (new Set(typeIds).size !== catalog.stratum.typeCount) {
      throw new Error(`Research Type count mismatch: ${id}`)
    }
    if (!puzzle.board.every((tube) => tube.length === 0 || tube.length === puzzle.capacity)) {
      throw new Error(`Non-classic occupancy: ${id}`)
    }
    if (puzzle.board.filter((tube) => tube.length === 0).length !== puzzle.emptyTubes) {
      throw new Error(`Empty tube mismatch: ${id}`)
    }
    if (puzzle.emptyTubes !== puzzle.minimumRequiredEmptyTubes) {
      throw new Error(`Minimum empty tube mismatch: ${id}`)
    }

    const reconstructed = [
      ...generateBalancedFullTubes(catalog.stratum.typeCount, puzzle.capacity, puzzle.candidateSeed),
      ...Array.from({ length: puzzle.emptyTubes }, () => [] as number[]),
    ]
    if (JSON.stringify(reconstructed) !== JSON.stringify(puzzle.board)) {
      throw new Error(`Research candidate board mismatch: ${id}`)
    }

    const canonicalKey = canonicalPuzzleKey(puzzle.board)
    if (canonicalKey !== puzzle.canonicalKey) {
      throw new Error(`Invalid canonical key: ${id}`)
    }
    if (canonicalKeys.has(canonicalKey)) throw new Error(`Canonical duplicate: ${id}`)
    canonicalKeys.add(canonicalKey)

    const expectedPuzzleId = derivePuzzleIdFromCanonicalKey(canonicalKey, puzzle.capacity)
    if (id !== expectedPuzzleId) throw new Error(`Stable puzzle ID mismatch: ${id}`)
    if (puzzleIds.has(id)) throw new Error(`Duplicate stable puzzle ID: ${id}`)
    puzzleIds.add(id)

    if (isSolved(puzzle.board, puzzle.capacity)) throw new Error(`Starts solved: ${id}`)

    const counts = new Map<number, number>()
    for (const type of typeIds) counts.set(type, (counts.get(type) ?? 0) + 1)
    if ([...counts.values()].some((count) => count !== puzzle.capacity)) {
      throw new Error(`Type conservation failure: ${id}`)
    }

    const expectedStructure = analyzeStructure(puzzle.board, puzzle.capacity)
    if (JSON.stringify(expectedStructure) !== JSON.stringify(puzzle.structure)) {
      throw new Error(`Structure descriptors mismatch: ${id}`)
    }

    validateSolverMetrics(id, puzzle.solver)
    if (puzzle.solver.maxDepthReached < puzzle.solver.optimalMoves) {
      throw new Error(`Solver proof depth shorter than optimal solution: ${id}`)
    }
    if (puzzle.emptyTubeAnalysis.length !== puzzle.minimumRequiredEmptyTubes) {
      throw new Error(`Incomplete minimum-empty proof: ${id}`)
    }
    for (let index = 0; index < puzzle.emptyTubeAnalysis.length; index += 1) {
      const analysis = puzzle.emptyTubeAnalysis[index]
      validateSolverMetrics(id, analysis.metrics)
      const expectedEmptyTubes = index + 1
      if (analysis.emptyTubes !== expectedEmptyTubes) {
        throw new Error(`Non-sequential empty-tube proof: ${id}`)
      }
      const isMinimum = expectedEmptyTubes === puzzle.minimumRequiredEmptyTubes
      if (isMinimum && analysis.status !== 'solved') {
        throw new Error(`Minimum empty-tube result must be solved: ${id}`)
      }
      if (!isMinimum && analysis.status !== 'unsolvable') {
        throw new Error(`Smaller empty-tube count must be proven unsolvable: ${id}`)
      }
      if (isMinimum && analysis.optimalMoves !== puzzle.solver.optimalMoves) {
        throw new Error(`Minimum empty-tube optimal moves mismatch: ${id}`)
      }
      if (!isMinimum && analysis.optimalMoves !== undefined) {
        throw new Error(`Unsolvable empty-tube result has optimal moves: ${id}`)
      }
    }

    let replay = puzzle.board.map((tube) => [...tube])
    for (const expectedMove of puzzle.optimalSolution) {
      const legal = calculatePour(replay, expectedMove.from, expectedMove.to, puzzle.capacity)
      if (!legal
        || legal.from !== expectedMove.from
        || legal.to !== expectedMove.to
        || legal.color !== expectedMove.color
        || legal.amount !== expectedMove.amount) {
        throw new Error(`Invalid saved move: ${id}`)
      }
      replay = applyMove(replay, expectedMove)
    }
    if (!isSolved(replay, puzzle.capacity)) throw new Error(`Solution does not finish: ${id}`)
    if (puzzle.optimalSolution.length !== puzzle.solver.optimalMoves) {
      throw new Error(`Solution length mismatch: ${id}`)
    }

    const path = analyzeSolutionPath(puzzle.board, puzzle.optimalSolution, puzzle.capacity)
    if (JSON.stringify(path) !== JSON.stringify(puzzle.solutionPath)) {
      throw new Error(`Solution path metrics mismatch: ${id}`)
    }
  }

  return {
    valid: true,
    puzzles: catalog.puzzles.length,
    typeCount: catalog.stratum.typeCount,
  }
}

import {
  CANONICAL_VERSION,
  ENCODING_VERSION,
  canonicalPuzzleKey,
  canonicalPuzzleKeyFromSequence,
  canonicalPuzzleSequence,
} from './canonical'
import { generateBalancedFullTubes } from './candidate'
import { CanonicalSequenceTrie } from './dedup'
import { analyzeMistakes } from './difficulty'
import { applyMove, calculatePour, isSolved } from './rules'
import { findMinimumEmptyTubes } from './generator'
import { deriveCandidateSeed, fingerprintConfig } from './rng'
import { analyzeSolutionPath } from './solver'
import type {
  Board,
  EmptyTubeAnalysis,
  MistakeAnalysis,
  Move,
  SolutionPathMetrics,
  SolverMetrics,
} from './types'
import { validateDifficultyV2 } from './validator'
import { GENERATOR_VERSION, RNG_VERSION, SOLVER_STATE_ENCODING_VERSION } from './version'

export interface ResearchPuzzle {
  id: string
  candidateIndex: number
  candidateSeed: string
  types: number
  capacity: number
  emptyTubes: number
  minimumRequiredEmptyTubes: number
  board: Board
  optimalSolution: Move[]
  canonicalKey: string
  solver: SolverMetrics & { optimalMoves: number }
  solutionPath: SolutionPathMetrics
  difficultyV2: MistakeAnalysis
  emptyTubeAnalysis: EmptyTubeAnalysis[]
}

export interface ResearchPool {
  version: 'research-pool-v1'
  generator: 'balanced-shuffle+bounded-a-star'
  types: number
  capacity: number
  reproducibility: {
    generatorVersion: string
    rngVersion: string
    canonicalVersion: string
    encodingVersion: string
    solverStateEncodingVersion: string
    batchSeed: string
    configFingerprint: string
  }
  attemptsScanned: number
  puzzles: ResearchPuzzle[]
}

export interface ResearchPoolOptions {
  types: number
  count?: number
  maxAttempts?: number
  capacity?: number
  maxEmptyTubes?: number
  maxVisitedStates?: number
  maxDepth?: number
  mistakeMaxVisitedStates?: number
  mistakeMaxDepthExtra?: number
  batchSeed?: string
}

export function generateResearchPool(options: ResearchPoolOptions): ResearchPool {
  const types = options.types
  const count = options.count ?? 100
  const maxAttempts = options.maxAttempts ?? 5_000
  const capacity = options.capacity ?? 4
  const maxEmptyTubes = options.maxEmptyTubes ?? 5
  const maxVisitedStates = options.maxVisitedStates ?? 100_000
  const maxDepth = options.maxDepth ?? 160
  const mistakeMaxVisitedStates = options.mistakeMaxVisitedStates ?? 50_000
  const mistakeMaxDepthExtra = options.mistakeMaxDepthExtra ?? 40
  const batchSeed = options.batchSeed ?? `water-sort:research:types-${types}:v0.2`

  if (!Number.isInteger(types) || types < 1 || types > 16) {
    throw new Error('types must be an integer in 1..16')
  }
  if (!Number.isInteger(count) || count < 1) throw new Error('count must be a positive integer')
  if (!Number.isInteger(maxAttempts) || maxAttempts < count) {
    throw new Error('maxAttempts must be an integer >= count')
  }

  const configFingerprint = fingerprintConfig({
    types,
    count,
    maxAttempts,
    capacity,
    maxEmptyTubes,
    maxVisitedStates,
    maxDepth,
    mistakeMaxVisitedStates,
    mistakeMaxDepthExtra,
  })

  const canonicalIndex = new CanonicalSequenceTrie()
  const puzzles: ResearchPuzzle[] = []
  let attemptsScanned = 0

  for (let attempt = 0; attempt < maxAttempts && puzzles.length < count; attempt += 1) {
    attemptsScanned = attempt + 1
    const candidateSeed = deriveCandidateSeed(batchSeed, 'research', `types-${types}`, attempt)
    const fullTubes = generateBalancedFullTubes(types, capacity, candidateSeed)

    const minimum = findMinimumEmptyTubes(fullTubes, {
      capacity,
      maxEmptyTubes,
      maxDepth,
      maxVisitedStates,
    })
    if (minimum.status !== 'exact') continue

    const canonicalSequence = canonicalPuzzleSequence(minimum.board)
    if (!canonicalIndex.add(canonicalSequence)) continue

    const optimalSolution = minimum.result.solution
    const difficultyV2 = analyzeMistakes(minimum.board, optimalSolution, {
      capacity,
      maxVisitedStates: mistakeMaxVisitedStates,
      maxDepthExtra: mistakeMaxDepthExtra,
    })

    puzzles.push({
      id: `ws-research-t${String(types).padStart(2, '0')}-c${String(attempt).padStart(6, '0')}`,
      candidateIndex: attempt,
      candidateSeed,
      types,
      capacity,
      emptyTubes: minimum.minimumRequiredEmptyTubes,
      minimumRequiredEmptyTubes: minimum.minimumRequiredEmptyTubes,
      board: minimum.board,
      optimalSolution,
      canonicalKey: canonicalPuzzleKeyFromSequence(canonicalSequence),
      solver: {
        optimalMoves: optimalSolution.length,
        ...minimum.result.metrics,
      },
      solutionPath: analyzeSolutionPath(minimum.board, optimalSolution, capacity),
      difficultyV2,
      emptyTubeAnalysis: minimum.analyses,
    })
  }

  if (puzzles.length < count) {
    throw new Error(`Only generated ${puzzles.length}/${count} research puzzles after ${maxAttempts} attempts`)
  }

  return {
    version: 'research-pool-v1',
    generator: 'balanced-shuffle+bounded-a-star',
    types,
    capacity,
    reproducibility: {
      generatorVersion: GENERATOR_VERSION,
      rngVersion: RNG_VERSION,
      canonicalVersion: CANONICAL_VERSION,
      encodingVersion: ENCODING_VERSION,
      solverStateEncodingVersion: SOLVER_STATE_ENCODING_VERSION,
      batchSeed,
      configFingerprint,
    },
    attemptsScanned,
    puzzles,
  }
}


export interface ResearchValidationSummary {
  valid: true
  puzzles: number
  types: number
  minimumEmptyDistribution: Record<string, number>
}

export function validateResearchPool(pool: ResearchPool): ResearchValidationSummary {
  if (pool.version !== 'research-pool-v1') {
    throw new Error(`Unsupported research pool version: ${pool.version}`)
  }
  if (!Number.isInteger(pool.types) || pool.types < 1 || pool.types > 16) {
    throw new Error('Invalid research pool type count')
  }
  if (!Number.isInteger(pool.capacity) || pool.capacity < 1 || pool.capacity > 4) {
    throw new Error('Invalid research pool capacity')
  }

  const ids = new Set<string>()
  const canonicalKeys = new Set<string>()
  const minimumEmptyDistribution: Record<string, number> = {}

  for (const puzzle of pool.puzzles) {
    if (ids.has(puzzle.id)) throw new Error(`Duplicate research puzzle id: ${puzzle.id}`)
    ids.add(puzzle.id)

    if (canonicalKeys.has(puzzle.canonicalKey)) {
      throw new Error(`Canonical research duplicate: ${puzzle.id}`)
    }
    canonicalKeys.add(puzzle.canonicalKey)

    if (puzzle.types !== pool.types || puzzle.capacity !== pool.capacity) {
      throw new Error(`Research puzzle scale mismatch: ${puzzle.id}`)
    }
    if (new Set(puzzle.board.flat()).size !== pool.types) {
      throw new Error(`Research puzzle type-count mismatch: ${puzzle.id}`)
    }
    if (canonicalPuzzleKey(puzzle.board) !== puzzle.canonicalKey) {
      throw new Error(`Invalid research canonical key: ${puzzle.id}`)
    }
    if (isSolved(puzzle.board, puzzle.capacity)) {
      throw new Error(`Research puzzle starts solved: ${puzzle.id}`)
    }

    const emptyTubes = puzzle.board.filter((tube) => tube.length === 0).length
    if (emptyTubes !== puzzle.emptyTubes
      || puzzle.emptyTubes !== puzzle.minimumRequiredEmptyTubes) {
      throw new Error(`Research minimum-empty mismatch: ${puzzle.id}`)
    }

    if (puzzle.emptyTubeAnalysis.length !== puzzle.minimumRequiredEmptyTubes) {
      throw new Error(`Incomplete research minimum-empty proof: ${puzzle.id}`)
    }
    for (let index = 0; index < puzzle.emptyTubeAnalysis.length; index += 1) {
      const analysis = puzzle.emptyTubeAnalysis[index]
      const expectedEmptyTubes = index + 1
      if (analysis.emptyTubes !== expectedEmptyTubes) {
        throw new Error(`Non-sequential research empty proof: ${puzzle.id}`)
      }
      const isMinimum = expectedEmptyTubes === puzzle.minimumRequiredEmptyTubes
      if (isMinimum ? analysis.status !== 'solved' : analysis.status !== 'unsolvable') {
        throw new Error(`Invalid research empty proof status: ${puzzle.id}`)
      }
    }

    const typeCounts = new Map<number, number>()
    for (const type of puzzle.board.flat()) typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)
    if ([...typeCounts.values()].some((count) => count !== puzzle.capacity)) {
      throw new Error(`Research type conservation failure: ${puzzle.id}`)
    }

    let board = puzzle.board.map((tube) => [...tube])
    for (const expectedMove of puzzle.optimalSolution) {
      const move = calculatePour(board, expectedMove.from, expectedMove.to, puzzle.capacity)
      if (JSON.stringify(move) !== JSON.stringify(expectedMove)) {
        throw new Error(`Invalid research saved move: ${puzzle.id}`)
      }
      board = applyMove(board, expectedMove)
    }

    if (!isSolved(board, puzzle.capacity)) {
      throw new Error(`Research solution does not finish: ${puzzle.id}`)
    }
    if (puzzle.optimalSolution.length !== puzzle.solver.optimalMoves) {
      throw new Error(`Research solution length mismatch: ${puzzle.id}`)
    }
    if (JSON.stringify(analyzeSolutionPath(puzzle.board, puzzle.optimalSolution, puzzle.capacity))
      !== JSON.stringify(puzzle.solutionPath)) {
      throw new Error(`Research solution-path mismatch: ${puzzle.id}`)
    }

    validateDifficultyV2(puzzle.id, puzzle.difficultyV2, puzzle.solver.optimalMoves)

    const key = String(puzzle.minimumRequiredEmptyTubes)
    minimumEmptyDistribution[key] = (minimumEmptyDistribution[key] ?? 0) + 1
  }

  return {
    valid: true,
    puzzles: pool.puzzles.length,
    types: pool.types,
    minimumEmptyDistribution,
  }
}

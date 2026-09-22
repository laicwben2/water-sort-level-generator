import {
  CANONICAL_VERSION,
  ENCODING_VERSION,
  canonicalPuzzleKeyFromSequence,
  canonicalPuzzleSequence,
} from './canonical'
import { generateBalancedFullTubes } from './candidate'
import { CanonicalSequenceTrie } from './dedup'
import { analyzeMistakes } from './difficulty'
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

import {
  CANONICAL_VERSION,
  ENCODING_VERSION,
  canonicalPuzzleKeyFromSequence,
  canonicalPuzzleSequence,
} from './canonical'
import { CanonicalSequenceTrie } from './dedup'
import { PROFILE_SETS, type DifficultyProfile, type ProfileName } from './profiles'
import {
  createRng,
  deriveCandidateSeed,
  fingerprintConfig,
  shuffle,
} from './rng'
import { analyzeSolutionPath, solveBoard } from './solver'
import type {
  AuditCatalog,
  AuditPuzzle,
  Board,
  Difficulty,
  EmptyTubeAnalysis,
  SolverResult,
} from './types'
import { GENERATOR_VERSION, RNG_VERSION } from './version'

export interface GenerateOptions {
  profileName?: ProfileName
  perDifficulty?: number
  maxAttempts?: number
  capacity?: number
  maxEmptyTubes?: number
  batchSeed?: string
}

export interface MinimumEmptySearchOptions {
  capacity: number
  maxEmptyTubes: number
  maxDepth: number
  maxVisitedStates: number
}

export type MinimumEmptySearchResult =
  | {
      status: 'exact'
      minimumRequiredEmptyTubes: number
      board: Board
      result: Extract<SolverResult, { status: 'solved' }>
      analyses: EmptyTubeAnalysis[]
    }
  | {
      status: 'unknown'
      reason: 'budget-exceeded' | 'max-empty-tubes-exhausted'
      analyses: EmptyTubeAnalysis[]
    }

function balancedBoard(types: number, capacity: number, random: () => number): Board {
  const layers = Array.from({ length: types }, (_, type) => Array(capacity).fill(type)).flat()
  const shuffled = shuffle(layers, random)
  return Array.from({ length: types }, (_, index) => (
    shuffled.slice(index * capacity, (index + 1) * capacity)
  ))
}

function summarizeResult(result: SolverResult, emptyTubes: number): EmptyTubeAnalysis {
  return {
    emptyTubes,
    status: result.status,
    ...(result.status === 'solved' ? { optimalMoves: result.solution.length } : {}),
    metrics: result.metrics,
  }
}

export function findMinimumEmptyTubes(
  fullTubes: Board,
  options: MinimumEmptySearchOptions,
): MinimumEmptySearchResult {
  const analyses: EmptyTubeAnalysis[] = []

  for (let emptyTubes = 1; emptyTubes <= options.maxEmptyTubes; emptyTubes += 1) {
    const board = [
      ...fullTubes.map((tube) => [...tube]),
      ...Array.from({ length: emptyTubes }, () => [] as number[]),
    ]

    const result = solveBoard(board, {
      capacity: options.capacity,
      maxDepth: options.maxDepth,
      maxVisitedStates: options.maxVisitedStates,
    })
    analyses.push(summarizeResult(result, emptyTubes))

    if (result.status === 'budget-exceeded') {
      return {
        status: 'unknown',
        reason: 'budget-exceeded',
        analyses,
      }
    }

    if (result.status === 'solved') {
      return {
        status: 'exact',
        minimumRequiredEmptyTubes: emptyTubes,
        board,
        result,
        analyses,
      }
    }
  }

  return {
    status: 'unknown',
    reason: 'max-empty-tubes-exhausted',
    analyses,
  }
}

function scoreDifficultyMatch(
  entry: {
    emptyTubes: number
    result: Extract<SolverResult, { status: 'solved' }>
    path: ReturnType<typeof analyzeSolutionPath>
  },
  profile: DifficultyProfile,
): number | undefined {
  if (entry.result.solution.length < profile.minMoves || entry.result.solution.length > profile.maxMoves) {
    return undefined
  }

  const decisionRatio = entry.result.solution.length === 0
    ? 0
    : entry.path.decisionSteps / entry.result.solution.length

  return Math.abs(entry.result.solution.length - profile.targetMoves)
    + Math.abs(decisionRatio - profile.targetDecisionRatio) * 4
    + Math.abs(entry.emptyTubes - 2) * 1.5
}

export function generateAuditCatalog(options: GenerateOptions = {}): AuditCatalog {
  const profileName = options.profileName ?? 'expanded'
  const perDifficulty = options.perDifficulty ?? 10
  const maxAttempts = options.maxAttempts ?? 2_000
  const capacity = options.capacity ?? 4
  const maxEmptyTubes = options.maxEmptyTubes ?? 5
  const batchSeed = options.batchSeed ?? 'water-sort:generator:v0.2:default'
  const profiles = PROFILE_SETS[profileName]
  const puzzles: AuditPuzzle[] = []
  const canonicalIndex = new CanonicalSequenceTrie()

  const configFingerprint = fingerprintConfig({
    profileName,
    perDifficulty,
    maxAttempts,
    capacity,
    maxEmptyTubes,
    profiles,
  })

  for (const [difficulty, profile] of Object.entries(profiles) as Array<[Difficulty, DifficultyProfile]>) {
    let accepted = 0

    for (let attempt = 0; attempt < maxAttempts && accepted < perDifficulty; attempt += 1) {
      const candidateSeed = deriveCandidateSeed(batchSeed, profileName, difficulty, attempt)
      const fullTubes = balancedBoard(profile.colors, capacity, createRng(candidateSeed))

      const minimum = findMinimumEmptyTubes(fullTubes, {
        capacity,
        maxEmptyTubes,
        maxDepth: profile.maxMoves + 12,
        maxVisitedStates: profile.maxVisitedStates,
      })
      if (minimum.status !== 'exact') continue

      const path = analyzeSolutionPath(minimum.board, minimum.result.solution, capacity)
      const score = scoreDifficultyMatch({
        emptyTubes: minimum.minimumRequiredEmptyTubes,
        result: minimum.result,
        path,
      }, profile)
      if (score === undefined) continue

      const canonicalSequence = canonicalPuzzleSequence(minimum.board)
      if (!canonicalIndex.add(canonicalSequence)) continue
      const canonicalKey = canonicalPuzzleKeyFromSequence(canonicalSequence)
      accepted += 1
      puzzles.push({
        id: `ws-${profileName}-${difficulty}-c${String(attempt).padStart(6, '0')}`,
        difficulty,
        candidateIndex: attempt,
        candidateSeed,
        capacity,
        emptyTubes: minimum.minimumRequiredEmptyTubes,
        minimumRequiredEmptyTubes: minimum.minimumRequiredEmptyTubes,
        board: minimum.board,
        optimalSolution: minimum.result.solution,
        canonicalKey,
        solver: {
          optimalMoves: minimum.result.solution.length,
          ...minimum.result.metrics,
        },
        solutionPath: path,
        emptyTubeAnalysis: minimum.analyses,
      })

      void score
    }

    if (accepted < perDifficulty) {
      throw new Error(`Only generated ${accepted}/${perDifficulty} ${difficulty} puzzles after ${maxAttempts} attempts`)
    }
  }

  return {
    version: 'audit-v2',
    generator: 'balanced-shuffle+bounded-a-star',
    profile: profileName,
    reproducibility: {
      generatorVersion: GENERATOR_VERSION,
      rngVersion: RNG_VERSION,
      canonicalVersion: CANONICAL_VERSION,
      encodingVersion: ENCODING_VERSION,
      batchSeed,
      configFingerprint,
    },
    puzzles,
  }
}

import {
  CANONICAL_VERSION,
  ENCODING_VERSION,
  canonicalPuzzleKeyFromSequence,
  canonicalPuzzleSequence,
} from './canonical'
import { generateBalancedFullTubes } from './candidate'
import { CanonicalSequenceTrie } from './dedup'
import { analyzeMistakesAlongOptimalPath } from './difficulty'
import { PROFILE_SETS, type DifficultyProfile, type ProfileName } from './profiles'
import {
  deriveCandidateSeed,
  deriveLevelId,
  fingerprintConfig,
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
import { GENERATOR_VERSION, RNG_VERSION, SOLVER_STATE_ENCODING_VERSION } from './version'

export interface GenerateOptions {
  profileName?: ProfileName
  perDifficulty?: number
  maxAttempts?: number
  capacity?: number
  maxEmptyTubes?: number
  batchSeed?: string
  analyzeMistakes?: boolean
  mistakeMaxVisitedStatesPerAlternative?: number
  mistakeMaxDepthPerAlternative?: number
  mistakeMaxPathStates?: number
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

function matchesCurrentDifficultyWindow(
  result: Extract<SolverResult, { status: 'solved' }>,
  profile: DifficultyProfile,
): boolean {
  return result.solution.length >= profile.minMoves
    && result.solution.length <= profile.maxMoves
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
    analyzeMistakes: options.analyzeMistakes ?? false,
    mistakeMaxVisitedStatesPerAlternative: options.mistakeMaxVisitedStatesPerAlternative ?? 20_000,
    mistakeMaxDepthPerAlternative: options.mistakeMaxDepthPerAlternative ?? 120,
    mistakeMaxPathStates: options.mistakeMaxPathStates ?? null,
  })

  for (const [difficulty, profile] of Object.entries(profiles) as Array<[Difficulty, DifficultyProfile]>) {
    let accepted = 0

    for (let attempt = 0; attempt < maxAttempts && accepted < perDifficulty; attempt += 1) {
      const candidateSeed = deriveCandidateSeed(batchSeed, profileName, difficulty, attempt)
      const fullTubes = generateBalancedFullTubes(profile.colors, capacity, candidateSeed)

      const minimum = findMinimumEmptyTubes(fullTubes, {
        capacity,
        maxEmptyTubes,
        maxDepth: profile.maxMoves + 12,
        maxVisitedStates: profile.maxVisitedStates,
      })
      if (minimum.status !== 'exact') continue

      const path = analyzeSolutionPath(minimum.board, minimum.result.solution, capacity)
      if (!matchesCurrentDifficultyWindow(minimum.result, profile)) continue

      const mistakeAnalysis = options.analyzeMistakes
        ? analyzeMistakesAlongOptimalPath(minimum.board, minimum.result.solution, {
            capacity,
            maxVisitedStatesPerAlternative: options.mistakeMaxVisitedStatesPerAlternative ?? 20_000,
            maxDepthPerAlternative: options.mistakeMaxDepthPerAlternative ?? 120,
            ...(options.mistakeMaxPathStates === undefined
              ? {}
              : { maxPathStates: options.mistakeMaxPathStates }),
          })
        : undefined

      const canonicalSequence = canonicalPuzzleSequence(minimum.board)
      if (!canonicalIndex.add(canonicalSequence)) continue
      const canonicalKey = canonicalPuzzleKeyFromSequence(canonicalSequence)
      accepted += 1
      puzzles.push({
        id: deriveLevelId(batchSeed, profileName, difficulty, capacity, attempt),
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
        ...(mistakeAnalysis ? { mistakeAnalysis } : {}),
        emptyTubeAnalysis: minimum.analyses,
      })
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
      solverStateEncodingVersion: SOLVER_STATE_ENCODING_VERSION,
      batchSeed,
      configFingerprint,
    },
    puzzles,
  }
}

import {
  CANONICAL_VERSION,
  ENCODING_VERSION,
  canonicalPuzzleKeyFromSequence,
  canonicalPuzzleSequence,
} from './canonical'
import { generateBalancedFullTubes } from './candidate'
import { CanonicalSequenceTrie } from './dedup'
import { findMinimumEmptyTubes } from './generator'
import { PUZZLE_ID_VERSION, derivePuzzleIdFromCanonicalKey } from './identity'
import {
  RESEARCH_GENERATOR_FAMILY,
  RESEARCH_PROOF_BUDGET,
  RESEARCH_PROOF_BUDGET_VERSION,
  researchFingerprintInput,
  researchStratumId,
} from './research-config'
import type { ResearchGenerationAttemptRecord } from './research-ledger'
import { isSolved } from './rules'
import { deriveResearchCandidateSeed, fingerprintConfig } from './rng'
import { analyzeSolutionPath } from './solver'
import { analyzeStructure } from './structure'
import type { ResearchCandidate, ResearchCandidateCatalog } from './types'
import { GENERATOR_VERSION, RNG_VERSION, SOLVER_STATE_ENCODING_VERSION } from './version'

export interface GenerateResearchCatalogOptions {
  typeCount: number
  acceptedCount?: number
  maxAttempts?: number
  capacity?: number
  batchSeed?: string
  onAttempt?: (record: ResearchGenerationAttemptRecord) => void
}

function assertPositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
}

export function generateResearchCandidateCatalog(
  options: GenerateResearchCatalogOptions,
): ResearchCandidateCatalog {
  const stratumId = researchStratumId(options.typeCount)
  const acceptedCount = options.acceptedCount ?? 100
  const maxAttempts = options.maxAttempts ?? Math.max(acceptedCount * 10, 1_000)
  const capacity = options.capacity ?? 4
  const batchSeed = options.batchSeed ?? `water-sort:research:v0.3:${stratumId}:default`

  assertPositiveSafeInteger(acceptedCount, 'acceptedCount')
  assertPositiveSafeInteger(maxAttempts, 'maxAttempts')
  assertPositiveSafeInteger(capacity, 'capacity')
  if (capacity > 4) throw new Error('research-candidates-v1 supports capacity <= 4')

  const configFingerprint = fingerprintConfig(researchFingerprintInput({
    stratumId,
    typeCount: options.typeCount,
    capacity,
    requestedAcceptedCount: acceptedCount,
    maxAttempts,
  }))

  const canonicalIndex = new CanonicalSequenceTrie()
  const puzzles: ResearchCandidate[] = []

  for (let attempt = 0; attempt < maxAttempts && puzzles.length < acceptedCount; attempt += 1) {
    const candidateSeed = deriveResearchCandidateSeed(
      batchSeed,
      RESEARCH_GENERATOR_FAMILY,
      stratumId,
      attempt,
    )
    const fullTubes = generateBalancedFullTubes(options.typeCount, capacity, candidateSeed)
    const minimum = findMinimumEmptyTubes(fullTubes, {
      capacity,
      maxEmptyTubes: RESEARCH_PROOF_BUDGET.maxEmptyTubes,
      maxDepth: RESEARCH_PROOF_BUDGET.maxDepth,
      maxVisitedStates: RESEARCH_PROOF_BUDGET.maxVisitedStates,
    })

    if (minimum.status !== 'exact') {
      options.onAttempt?.({
        stratumId,
        typeCount: options.typeCount,
        candidateIndex: attempt,
        candidateSeed,
        disposition: 'rejected',
        reasonCode: minimum.reason === 'budget-exceeded'
          ? 'MINIMUM_EMPTY_BUDGET_EXCEEDED'
          : 'MINIMUM_EMPTY_EXHAUSTED',
      })
      continue
    }

    if (isSolved(minimum.board, capacity)) {
      options.onAttempt?.({
        stratumId,
        typeCount: options.typeCount,
        candidateIndex: attempt,
        candidateSeed,
        disposition: 'rejected',
        reasonCode: 'STARTS_SOLVED',
        minimumRequiredEmptyTubes: minimum.minimumRequiredEmptyTubes,
        optimalMoves: minimum.result.solution.length,
      })
      continue
    }

    const canonicalSequence = canonicalPuzzleSequence(minimum.board)
    const canonicalKey = canonicalPuzzleKeyFromSequence(canonicalSequence)
    const puzzleId = derivePuzzleIdFromCanonicalKey(canonicalKey, capacity)

    if (!canonicalIndex.add(canonicalSequence)) {
      options.onAttempt?.({
        stratumId,
        typeCount: options.typeCount,
        candidateIndex: attempt,
        candidateSeed,
        disposition: 'rejected',
        reasonCode: 'CANONICAL_DUPLICATE',
        minimumRequiredEmptyTubes: minimum.minimumRequiredEmptyTubes,
        optimalMoves: minimum.result.solution.length,
        canonicalKey,
        puzzleId,
      })
      continue
    }

    const puzzle: ResearchCandidate = {
      puzzleId,
      stratumId,
      typeCount: options.typeCount,
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
      solutionPath: analyzeSolutionPath(minimum.board, minimum.result.solution, capacity),
      structure: analyzeStructure(minimum.board, capacity),
      emptyTubeAnalysis: minimum.analyses,
    }
    puzzles.push(puzzle)

    options.onAttempt?.({
      stratumId,
      typeCount: options.typeCount,
      candidateIndex: attempt,
      candidateSeed,
      disposition: 'accepted',
      reasonCode: 'ACCEPTED',
      minimumRequiredEmptyTubes: minimum.minimumRequiredEmptyTubes,
      optimalMoves: minimum.result.solution.length,
      canonicalKey,
      puzzleId,
    })
  }

  if (puzzles.length < acceptedCount) {
    throw new Error(
      `Only generated ${puzzles.length}/${acceptedCount} ${stratumId} research candidates after ${maxAttempts} attempts`,
    )
  }

  return {
    version: 'research-candidates-v1',
    generator: 'balanced-shuffle+bounded-a-star',
    generatorFamily: RESEARCH_GENERATOR_FAMILY,
    stratum: {
      id: stratumId,
      typeCount: options.typeCount,
    },
    generation: {
      capacity,
      requestedAcceptedCount: acceptedCount,
      maxAttempts,
      proofBudget: {
        version: RESEARCH_PROOF_BUDGET_VERSION,
        ...RESEARCH_PROOF_BUDGET,
      },
    },
    reproducibility: {
      generatorVersion: GENERATOR_VERSION,
      rngVersion: RNG_VERSION,
      canonicalVersion: CANONICAL_VERSION,
      encodingVersion: ENCODING_VERSION,
      solverStateEncodingVersion: SOLVER_STATE_ENCODING_VERSION,
      puzzleIdentityVersion: PUZZLE_ID_VERSION,
      proofBudgetVersion: RESEARCH_PROOF_BUDGET_VERSION,
      batchSeed,
      configFingerprint,
    },
    puzzles,
  }
}

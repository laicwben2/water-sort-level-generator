import { describe, expect, it } from 'vitest'
import { selectPlaytestCases } from '../src/playtest'
import type { ResearchPool, ResearchPuzzle } from '../src/research'

function fakePuzzle(index: number): ResearchPuzzle {
  const optimalMoves = 20 + (index % 5)
  const legalMoves = 2 + (index % 6)
  const badChoices = index % legalMoves
  const optimalAlternatives = Math.max(0, legalMoves - 1 - badChoices)
  const deadEndMoves = index % 4 === 0 ? 1 : 0
  const recoverableMistakes = Math.max(0, badChoices - deadEndMoves)

  return {
    id: `fixture-${String(index).padStart(2, '0')}`,
    candidateIndex: index,
    candidateSeed: `fixture-seed-${index}`,
    types: 7,
    capacity: 4,
    emptyTubes: 2,
    minimumRequiredEmptyTubes: 2,
    board: [],
    optimalSolution: [],
    canonicalKey: `fixture-key-${index}`,
    solver: {
      optimalMoves,
      exploredStates: 100 + index,
      visitedStates: 200 + index,
      generatedMoves: 300 + index,
      maxDepthReached: optimalMoves,
      averageBranching: 2 + index / 10,
    },
    solutionPath: {
      decisionSteps: optimalMoves,
      forcedSteps: 0,
      totalAlternativeMoves: optimalMoves * (legalMoves - 1),
      averageChoices: legalMoves + index / 20,
      maximumChoices: legalMoves + 1,
    },
    difficultyV2: {
      analyzedStates: 1,
      decisionStates: 1,
      forcedStates: 0,
      totalAlternativeMoves: legalMoves - 1,
      optimalAlternativeMoves,
      recoverableMistakes,
      deadEndMoves,
      unknownMoves: 0,
      knownNonOptimalMoves: recoverableMistakes + deadEndMoves,
      deadEndRatioKnown: recoverableMistakes + deadEndMoves === 0
        ? 0
        : deadEndMoves / (recoverableMistakes + deadEndMoves),
      averageRecoveryPenalty: recoverableMistakes === 0 ? 0 : 1,
      maxRecoveryPenalty: recoverableMistakes === 0 ? 0 : 1,
      highPenaltyMistakes: 0,
      states: [{
        pathIndex: 0,
        remainingOptimalMoves: optimalMoves,
        legalMoves,
        optimalAlternatives,
        recoverableMistakes,
        deadEndMoves,
        unknownMoves: 0,
        recoveryPenalties: Array(recoverableMistakes).fill(1),
        maxRecoveryPenalty: recoverableMistakes === 0 ? 0 : 1,
        alternatives: [],
      }],
    },
    emptyTubeAnalysis: [],
  }
}

function fakePool(): ResearchPool {
  return {
    version: 'research-pool-v1',
    generator: 'balanced-shuffle+bounded-a-star',
    types: 7,
    capacity: 4,
    reproducibility: {
      generatorVersion: 'test',
      rngVersion: 'test',
      canonicalVersion: 'test',
      encodingVersion: 'test',
      solverStateEncodingVersion: 'test',
      batchSeed: 'fixture-pool',
      configFingerprint: 'fixture',
    },
    attemptsScanned: 20,
    puzzles: Array.from({ length: 20 }, (_, index) => fakePuzzle(index)),
  }
}

describe('playtest selection', () => {
  it('selects twelve unique, deterministic, blinded cases', () => {
    const pool = fakePool()
    const first = selectPlaytestCases(pool, 'selection-test')
    const second = selectPlaytestCases(pool, 'selection-test')

    expect(first).toEqual(second)
    expect(first.cases).toHaveLength(12)
    expect(new Set(first.cases.map((entry) => entry.id)).size).toBe(12)
    expect(first.cases.map((entry) => entry.order).sort((a, b) => a - b))
      .toEqual(Array.from({ length: 12 }, (_, index) => index + 1))

    const roles = first.cases.map((entry) =>
      `${entry.reason.metric}:${entry.reason.direction}`)
    expect(new Set(roles).size).toBe(12)

    for (const entry of first.cases) {
      expect(entry.reason.rankWithinMetric).toBeGreaterThanOrEqual(1)
      expect(entry.puzzle.id).toBe(entry.id)
    }
  })
})

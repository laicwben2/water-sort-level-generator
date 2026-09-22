import { describe, expect, it } from 'vitest'
import {
  analyzeDifficultyV2,
  analyzeMistakeRecovery,
  analyzeOptimalPathDifficulty,
  analyzeStructuralDifficulty,
  selectDifficultyAnalysisSteps,
} from '../src/difficulty'
import { solveBoard } from '../src/solver'
import type { Board } from '../src/types'

describe('Difficulty Model v2', () => {
  it('keeps structural metrics invariant under type renaming and tube reordering', () => {
    const first: Board = [
      [0, 1, 0, 2],
      [2, 1, 2, 0],
      [1, 0, 1, 2],
      [],
      [],
    ]
    const second: Board = [
      [],
      [8, 4, 8, 7],
      [7, 4, 7, 8],
      [],
      [4, 8, 4, 7],
    ]

    expect(analyzeStructuralDifficulty(first, 4))
      .toEqual(analyzeStructuralDifficulty(second, 4))
  })

  it('records staging and same-type joins along an optimal solution', () => {
    const board: Board = [[0, 1], [0, 1], [], []]
    const result = solveBoard(board, { capacity: 2 })
    if (result.status !== 'solved') throw new Error('expected solved')

    const metrics = analyzeOptimalPathDifficulty(board, result.solution, 2)
    expect(metrics.optimalMoves).toBe(result.solution.length)
    expect(metrics.movesIntoEmptyTube + metrics.movesJoiningSameType)
      .toBe(result.solution.length)
    expect(metrics.stagingRatio).toBeGreaterThanOrEqual(0)
    expect(metrics.stagingRatio).toBeLessThanOrEqual(1)
  })

  it('classifies alternate optimal moves and a recoverable mistake', () => {
    const board: Board = [
      [0, 2],
      [2, 1],
      [0, 1],
      [],
      [],
    ]
    const result = solveBoard(board, { capacity: 2 })
    if (result.status !== 'solved') throw new Error('expected solved')

    const metrics = analyzeMistakeRecovery(board, result.solution, 2, {
      maxVisitedStatesPerAlternative: 10_000,
      maxDepthPerAlternative: 20,
      maxAnalyzedSteps: 1,
      maxAlternativesPerStep: 10,
      severeRecoveryThreshold: 2,
    })

    expect(metrics.optimalAlternativeCount).toBeGreaterThanOrEqual(1)
    expect(metrics.recoverableMistakeCount).toBeGreaterThanOrEqual(1)
    expect(metrics.maximumRecoveryPenalty).toBeGreaterThan(0)
    expect(metrics.unknownCount).toBe(0)
  })

  it('distinguishes a proven dead end from unknown', () => {
    const board: Board = [
      [0, 2],
      [2, 1],
      [0, 1],
      [],
    ]
    const result = solveBoard(board, { capacity: 2 })
    if (result.status !== 'solved') throw new Error('expected solved')

    const exact = analyzeMistakeRecovery(board, result.solution, 2, {
      maxVisitedStatesPerAlternative: 10_000,
      maxDepthPerAlternative: 20,
      maxAnalyzedSteps: 1,
      maxAlternativesPerStep: 10,
      severeRecoveryThreshold: 2,
    })
    expect(exact.deadEndCount).toBeGreaterThanOrEqual(1)
    expect(exact.unknownCount).toBe(0)

    const bounded = analyzeMistakeRecovery(board, result.solution, 2, {
      maxVisitedStatesPerAlternative: 1,
      maxDepthPerAlternative: 20,
      maxAnalyzedSteps: 1,
      maxAlternativesPerStep: 10,
      severeRecoveryThreshold: 2,
    })
    expect(bounded.unknownCount).toBeGreaterThanOrEqual(1)
    expect(bounded.knownCoverage).toBeLessThanOrEqual(exact.knownCoverage)
  })

  it('selects long-solution analysis steps deterministically across the path', () => {
    expect(selectDifficultyAnalysisSteps(50, 5)).toEqual([0, 12, 25, 37, 49])
    expect(selectDifficultyAnalysisSteps(3, 5)).toEqual([0, 1, 2])
    expect(selectDifficultyAnalysisSteps(50, 1)).toEqual([0])
  })

  it('builds the combined metric object without mistake analysis by default', () => {
    const board: Board = [[0, 1], [0, 1], [], []]
    const result = solveBoard(board, { capacity: 2 })
    if (result.status !== 'solved') throw new Error('expected solved')

    const metrics = analyzeDifficultyV2(board, result.solution, 2)
    expect(metrics.structural.typeCount).toBe(2)
    expect(metrics.optimalPath.optimalMoves).toBe(result.solution.length)
    expect(metrics.mistakeRecovery).toBeUndefined()
  })
})

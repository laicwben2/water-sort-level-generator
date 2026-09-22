import { describe, expect, it } from 'vitest'
import { generateResearchPool } from '../src/research'

describe('unlabeled research pools', () => {
  it('reproduces the same fixed-scale pool from the same seed', () => {
    const options = {
      types: 3,
      count: 2,
      maxAttempts: 200,
      capacity: 2,
      maxEmptyTubes: 3,
      maxVisitedStates: 20_000,
      maxDepth: 40,
      mistakeMaxVisitedStates: 10_000,
      mistakeMaxDepthExtra: 20,
      batchSeed: 'research-pool-test',
    } as const

    const first = generateResearchPool(options)
    const second = generateResearchPool(options)

    expect(first.version).toBe('research-pool-v1')
    expect(first.types).toBe(3)
    expect(first.puzzles).toHaveLength(2)
    expect(second.puzzles).toHaveLength(2)

    expect(first.puzzles.map((puzzle) => ({
      id: puzzle.id,
      candidateIndex: puzzle.candidateIndex,
      candidateSeed: puzzle.candidateSeed,
      canonicalKey: puzzle.canonicalKey,
      minimumRequiredEmptyTubes: puzzle.minimumRequiredEmptyTubes,
      optimalMoves: puzzle.solver.optimalMoves,
    }))).toEqual(second.puzzles.map((puzzle) => ({
      id: puzzle.id,
      candidateIndex: puzzle.candidateIndex,
      candidateSeed: puzzle.candidateSeed,
      canonicalKey: puzzle.canonicalKey,
      minimumRequiredEmptyTubes: puzzle.minimumRequiredEmptyTubes,
      optimalMoves: puzzle.solver.optimalMoves,
    })))

    for (const puzzle of first.puzzles) {
      expect(puzzle).not.toHaveProperty('difficulty')
      expect(puzzle.difficultyV2.analyzedStates).toBe(puzzle.solver.optimalMoves)
      expect(puzzle.optimalSolution).toHaveLength(puzzle.solver.optimalMoves)
    }
  })
})

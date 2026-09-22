import { describe, expect, it } from 'vitest'
import { findMinimumEmptyTubes } from '../src/generator'
import { createRng, deriveCandidateSeed, shuffle } from '../src/rng'
import type { Board } from '../src/types'

describe('deterministic generation foundation', () => {
  it('derives candidate RNG independently from previous candidates', () => {
    const seed7 = deriveCandidateSeed('batch-A', 'expanded', 'hard', 7)
    const seed8 = deriveCandidateSeed('batch-A', 'expanded', 'hard', 8)

    const direct = shuffle([0, 1, 2, 3, 4, 5], createRng(seed8))

    // Consume an unrelated candidate first. Candidate 8 must not depend on
    // how many random values candidate 7 happened to consume.
    const previous = createRng(seed7)
    for (let index = 0; index < 100; index += 1) previous()
    const afterPrevious = shuffle([0, 1, 2, 3, 4, 5], createRng(seed8))

    expect(afterPrevious).toEqual(direct)
    expect(deriveCandidateSeed('batch-A', 'expanded', 'hard', 8)).toBe(seed8)
  })

  it('proves an exact minimum of two empty tubes', () => {
    const fullTubes: Board = [
      [1, 3, 0, 1],
      [4, 2, 3, 4],
      [1, 4, 2, 4],
      [0, 0, 2, 3],
      [1, 0, 2, 3],
    ]

    const result = findMinimumEmptyTubes(fullTubes, {
      capacity: 4,
      maxEmptyTubes: 4,
      maxDepth: 40,
      maxVisitedStates: 20_000,
    })

    expect(result.status).toBe('exact')
    if (result.status !== 'exact') return
    expect(result.minimumRequiredEmptyTubes).toBe(2)
    expect(result.analyses.map((entry) => entry.status)).toEqual(['unsolvable', 'solved'])
  })

  it('never treats a solver budget cutoff as proof of a larger minimum', () => {
    const fullTubes: Board = [
      [0, 1],
      [1, 0],
    ]

    const result = findMinimumEmptyTubes(fullTubes, {
      capacity: 2,
      maxEmptyTubes: 3,
      maxDepth: 20,
      maxVisitedStates: 0,
    })

    expect(result).toMatchObject({
      status: 'unknown',
      reason: 'budget-exceeded',
    })
    expect(result.analyses).toHaveLength(1)
    expect(result.analyses[0].status).toBe('budget-exceeded')
  })
})

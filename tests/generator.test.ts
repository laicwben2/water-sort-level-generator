import { describe, expect, it } from 'vitest'
import { generateBalancedFullTubes } from '../src/candidate'
import { findMinimumEmptyTubes, generateAuditCatalog } from '../src/generator'
import { createRng, deriveCandidateSeed, deriveLevelId, shuffle } from '../src/rng'
import type { ProfileName } from '../src/profiles'
import { applyMove, calculatePour, isSolved } from '../src/rules'
import type { Board } from '../src/types'

describe('deterministic generation foundation', () => {
  it('rejects inherited object property names as unsupported profiles', () => {
    expect(() => generateAuditCatalog({ profileName: 'toString' as ProfileName }))
      .toThrow(/Unknown profile: toString/)
  })

  it('rejects counts that would return an empty or partial catalog', () => {
    expect(() => generateAuditCatalog({ perDifficulty: 0 })).toThrow(/perDifficulty must be a positive integer/)
    expect(() => generateAuditCatalog({ perDifficulty: 0.5 })).toThrow(/perDifficulty must be a positive integer/)
    expect(() => generateAuditCatalog({ maxAttempts: 0 })).toThrow(/maxAttempts must be a positive integer/)
    expect(() => generateAuditCatalog({ maxEmptyTubes: 0 })).toThrow(/maxEmptyTubes must be a positive integer/)
    expect(() => generateAuditCatalog({ analyzeMistakes: true, mistakeMaxPathStates: 0 }))
      .toThrow(/mistakeMaxPathStates must be a positive integer/)
  })

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

  it('gives different batches and capacities distinct stable level IDs', () => {
    const first = generateAuditCatalog({
      profileName: 'baseline',
      perDifficulty: 1,
      maxAttempts: 1_000,
      batchSeed: 'id-collision-A',
    })
    const second = generateAuditCatalog({
      profileName: 'baseline',
      perDifficulty: 1,
      maxAttempts: 1_000,
      batchSeed: 'id-collision-B',
    })

    const firstIds = new Set(first.puzzles.map((puzzle) => puzzle.id))
    expect(second.puzzles.every((puzzle) => !firstIds.has(puzzle.id))).toBe(true)
    for (const puzzle of first.puzzles) {
      expect(puzzle.id).toBe(deriveLevelId(
        first.reproducibility.batchSeed,
        first.profile,
        puzzle.difficulty,
        puzzle.capacity,
        puzzle.candidateIndex,
      ))
    }
    expect(deriveLevelId('a.b', 'baseline', 'easy', 4, 0))
      .not.toBe(deriveLevelId('a', 'baseline', 'easy', 4, 0))
    expect(deriveLevelId('a', 'baseline', 'easy', 4, 0))
      .not.toBe(deriveLevelId('a', 'baseline', 'easy', 3, 0))
  })

  it('reconstructs every accepted board from its candidate seed', () => {
    const catalog = generateAuditCatalog({
      profileName: 'baseline',
      perDifficulty: 1,
      maxAttempts: 1_000,
      batchSeed: 'test-candidate-reproduction',
    })

    for (const puzzle of catalog.puzzles) {
      const types = new Set(puzzle.board.flat()).size
      const fullTubes = generateBalancedFullTubes(types, puzzle.capacity, puzzle.candidateSeed)
      expect(puzzle.board).toEqual([
        ...fullTubes,
        ...Array.from({ length: puzzle.emptyTubes }, () => []),
      ])
    }
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

  it('agrees with independent reachability proof for a two-empty puzzle', () => {
    const fullTubes: Board = [[2, 1, 0], [2, 1, 0], [0, 1, 2]]

    function canSolveWith(emptyTubes: number): boolean {
      const start: Board = [
        ...fullTubes,
        ...Array.from({ length: emptyTubes }, () => []),
      ]
      const queue = [start]
      const visited = new Set([JSON.stringify(start)])
      for (let index = 0; index < queue.length; index += 1) {
        const board = queue[index]
        if (isSolved(board, 3)) return true
        for (let from = 0; from < board.length; from += 1) {
          for (let to = 0; to < board.length; to += 1) {
            const move = calculatePour(board, from, to, 3)
            if (!move) continue
            const next = applyMove(board, move)
            const key = JSON.stringify(next)
            if (visited.has(key)) continue
            visited.add(key)
            queue.push(next)
          }
        }
      }
      return false
    }

    expect(canSolveWith(1)).toBe(false)
    expect(canSolveWith(2)).toBe(true)

    const result = findMinimumEmptyTubes(fullTubes, {
      capacity: 3,
      maxEmptyTubes: 2,
      maxDepth: 40,
      maxVisitedStates: 100_000,
    })
    expect(result.status).toBe('exact')
    if (result.status === 'exact') {
      expect(result.minimumRequiredEmptyTubes).toBe(2)
      expect(result.analyses.map((entry) => entry.status)).toEqual(['unsolvable', 'solved'])
    }
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

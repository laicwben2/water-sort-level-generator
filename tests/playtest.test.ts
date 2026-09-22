import { describe, expect, it } from 'vitest'
import { selectPlaytestCases } from '../src/playtest'
import { generateResearchPool } from '../src/research'

describe('playtest selection', () => {
  it('selects twelve unique, deterministic, blinded cases', () => {
    const pool = generateResearchPool({
      types: 3,
      count: 12,
      maxAttempts: 500,
      capacity: 2,
      maxEmptyTubes: 3,
      maxVisitedStates: 20_000,
      maxDepth: 40,
      mistakeMaxVisitedStates: 10_000,
      mistakeMaxDepthExtra: 20,
      batchSeed: 'playtest-pool-test',
    })

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

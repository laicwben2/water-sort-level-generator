import { describe, expect, it } from 'vitest'
import { analyzeStructure } from '../src/structure'

describe('structure descriptors', () => {
  it('measures fragmentation, Type spread, and distinct initial next states', () => {
    const descriptors = analyzeStructure([
      [0, 1, 0, 1],
      [0, 0, 1, 1],
      [],
      [],
    ], 4)

    expect(descriptors.totalRuns).toBe(6)
    expect(descriptors.normalizedTotalRuns).toBe(6 / 8)
    expect(descriptors.allDistinctTubeCount).toBe(0)
    expect(descriptors.typeSpreadMean).toBe(2)
    expect(descriptors.typeSpreadMax).toBe(2)
    expect(descriptors.topDistinctTypeCount).toBe(1)
    expect(descriptors.initialDistinctNextStates).toBeGreaterThan(0)
  })

  it('counts fully distinct tubes without treating the metric as a difficulty label', () => {
    const descriptors = analyzeStructure([
      [0, 1, 2, 3],
      [3, 2, 1, 0],
      [],
    ], 4)

    expect(descriptors.totalRuns).toBe(8)
    expect(descriptors.normalizedTotalRuns).toBe(1)
    expect(descriptors.allDistinctTubeCount).toBe(2)
    expect(descriptors.typeSpreadMean).toBe(2)
    expect(descriptors.typeSpreadMax).toBe(2)
    expect(descriptors.topDistinctTypeCount).toBe(2)
  })

  it('returns finite zero-valued descriptors for an empty board', () => {
    expect(analyzeStructure([[], []], 4)).toEqual({
      totalRuns: 0,
      normalizedTotalRuns: 0,
      allDistinctTubeCount: 0,
      typeSpreadMean: 0,
      typeSpreadMax: 0,
      topDistinctTypeCount: 0,
      initialDistinctNextStates: 0,
    })
  })
})

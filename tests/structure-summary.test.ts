import { describe, expect, it } from 'vitest'
import { summarizeStructurePopulation } from '../src/structure-summary'
import type { AuditPuzzle, StructureDescriptors } from '../src/types'

function puzzle(sourceBucket: 'easy' | 'medium', structure: StructureDescriptors): AuditPuzzle {
  return {
    id: `fixture-${sourceBucket}-${structure.totalRuns}`,
    difficulty: sourceBucket,
    sourceBucket,
    candidateIndex: 0,
    candidateSeed: 'fixture',
    capacity: 4,
    emptyTubes: 1,
    minimumRequiredEmptyTubes: 1,
    board: [[0, 0, 0, 0], []],
    optimalSolution: [],
    canonicalKey: 'fixture',
    solver: {
      optimalMoves: 0,
      exploredStates: 1,
      visitedStates: 1,
      generatedMoves: 0,
      maxDepthReached: 0,
      averageBranching: 0,
    },
    solutionPath: {
      decisionSteps: 0,
      forcedSteps: 0,
      totalAlternativeMoves: 0,
      averageChoices: 0,
      maximumChoices: 0,
    },
    structure,
    emptyTubeAnalysis: [],
  }
}

describe('structure population summary', () => {
  it('reports distributions and correlations by source bucket', () => {
    const first: StructureDescriptors = {
      totalRuns: 4,
      normalizedTotalRuns: 0.5,
      allDistinctTubeCount: 0,
      typeSpreadMean: 1,
      typeSpreadMax: 1,
      initialDistinctNextStates: 1,
    }
    const second: StructureDescriptors = {
      totalRuns: 8,
      normalizedTotalRuns: 1,
      allDistinctTubeCount: 2,
      typeSpreadMean: 2,
      typeSpreadMax: 2,
      initialDistinctNextStates: 3,
    }

    const summary = summarizeStructurePopulation([
      puzzle('easy', first),
      puzzle('medium', second),
    ])

    expect(summary.overall.count).toBe(2)
    expect(summary.overall.descriptors.totalRuns.mean).toBe(6)
    expect(summary.overall.descriptors.totalRuns.p50).toBe(4)
    expect(summary.overall.descriptors.totalRuns.p90).toBe(8)
    expect(summary.overall.correlations.totalRuns.normalizedTotalRuns).toBe(1)
    expect(summary.bySourceBucket.easy?.count).toBe(1)
    expect(summary.bySourceBucket.medium?.count).toBe(1)
  })

  it('returns null correlation when a descriptor has no variance', () => {
    const structure: StructureDescriptors = {
      totalRuns: 4,
      normalizedTotalRuns: 0.5,
      allDistinctTubeCount: 0,
      typeSpreadMean: 1,
      typeSpreadMax: 1,
      initialDistinctNextStates: 1,
    }
    const summary = summarizeStructurePopulation([
      puzzle('easy', structure),
      puzzle('medium', structure),
    ])

    expect(summary.overall.correlations.totalRuns.typeSpreadMean).toBeNull()
    expect(summary.overall.correlations.totalRuns.totalRuns).toBe(1)
  })
})

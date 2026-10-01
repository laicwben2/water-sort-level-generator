import { describe, expect, it } from 'vitest'
import { generateResearchCandidateCatalog } from '../src/research-generator'
import { summarizeResearchGenerationAttempts, type ResearchGenerationAttemptRecord } from '../src/research-ledger'
import { validateResearchCandidateCatalog } from '../src/research-validator'
import { deriveResearchCandidateSeed } from '../src/rng'

describe('neutral Type-count research generation', () => {
  it('generates a research catalog without a difficulty label', () => {
    const records: ResearchGenerationAttemptRecord[] = []
    const catalog = generateResearchCandidateCatalog({
      typeCount: 4,
      acceptedCount: 3,
      maxAttempts: 100,
      batchSeed: 'research-test-t4',
      onAttempt: (record) => records.push(record),
    })

    expect(catalog.version).toBe('research-candidates-v1')
    expect(catalog.generatorFamily).toBe('uniform-v1')
    expect(catalog.stratum).toEqual({ id: 'types-4', typeCount: 4 })
    expect(catalog.generation).toEqual({
      capacity: 4,
      requestedAcceptedCount: 3,
      maxAttempts: 100,
      proofBudget: {
        version: 'research-proof-200k-d200-e5-v1',
        maxVisitedStates: 200_000,
        maxDepth: 200,
        maxEmptyTubes: 5,
      },
    })
    expect(catalog.puzzles).toHaveLength(3)
    expect(validateResearchCandidateCatalog(catalog)).toEqual({
      valid: true,
      puzzles: 3,
      typeCount: 4,
    })

    for (const puzzle of catalog.puzzles) {
      expect(puzzle.typeCount).toBe(4)
      expect(puzzle.stratumId).toBe('types-4')
      expect(puzzle).not.toHaveProperty('difficulty')
      expect(puzzle.structure.topDistinctTypeCount).toBeGreaterThanOrEqual(1)
      expect(puzzle.structure.topDistinctTypeCount).toBeLessThanOrEqual(4)
    }

    const yieldReport = summarizeResearchGenerationAttempts(records)
    expect(yieldReport.stratumId).toBe('types-4')
    expect(yieldReport.typeCount).toBe(4)
    expect(yieldReport.accepted).toBe(3)
    expect(yieldReport.attempted).toBeGreaterThanOrEqual(3)
  })

  it('derives research candidate seeds independently of legacy difficulty buckets', () => {
    const first = deriveResearchCandidateSeed('batch', 'uniform-v1', 'types-8', 7)
    const second = deriveResearchCandidateSeed('batch', 'uniform-v1', 'types-8', 7)
    const otherType = deriveResearchCandidateSeed('batch', 'uniform-v1', 'types-9', 7)

    expect(first).toBe(second)
    expect(first).not.toBe(otherType)
  })

  it('is deterministic for the same research configuration', () => {
    const options = {
      typeCount: 4,
      acceptedCount: 2,
      maxAttempts: 100,
      batchSeed: 'research-deterministic',
    } as const

    const first = generateResearchCandidateCatalog(options)
    const second = generateResearchCandidateCatalog(options)

    expect(second).toEqual(first)
  })

  it('rejects unsupported Type counts before generation', () => {
    expect(() => generateResearchCandidateCatalog({
      typeCount: 1,
      acceptedCount: 1,
    })).toThrow(/2\.\.16/)

    expect(() => generateResearchCandidateCatalog({
      typeCount: 17,
      acceptedCount: 1,
    })).toThrow(/2\.\.16/)
  })

  it('rejects opaque or inconsistent run configuration metadata', () => {
    const catalog = generateResearchCandidateCatalog({
      typeCount: 4,
      acceptedCount: 2,
      maxAttempts: 100,
      batchSeed: 'research-run-config',
    })

    catalog.reproducibility.configFingerprint = '00000000'
    expect(() => validateResearchCandidateCatalog(catalog))
      .toThrow(/config fingerprint mismatch/i)

    const capacityMismatch = generateResearchCandidateCatalog({
      typeCount: 4,
      acceptedCount: 1,
      maxAttempts: 100,
      batchSeed: 'research-capacity-config',
    })
    capacityMismatch.generation.capacity = 3
    expect(() => validateResearchCandidateCatalog(capacityMismatch))
      .toThrow(/config fingerprint mismatch|capacity mismatch/i)
  })

  it('requires the catalog puzzle count to match the declared stopping target', () => {
    const catalog = generateResearchCandidateCatalog({
      typeCount: 4,
      acceptedCount: 2,
      maxAttempts: 100,
      batchSeed: 'research-count-contract',
    })

    catalog.puzzles.pop()
    expect(() => validateResearchCandidateCatalog(catalog))
      .toThrow(/accepted puzzle count mismatch/i)
  })

  it('detects research catalog provenance corruption', () => {
    const catalog = generateResearchCandidateCatalog({
      typeCount: 4,
      acceptedCount: 1,
      maxAttempts: 100,
      batchSeed: 'research-corruption',
    })

    catalog.puzzles[0].candidateSeed = 'wrong'
    expect(() => validateResearchCandidateCatalog(catalog))
      .toThrow(/candidate seed mismatch/i)
  })
})

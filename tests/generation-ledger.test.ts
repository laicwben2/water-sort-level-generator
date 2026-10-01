import { describe, expect, it } from 'vitest'
import {
  summarizeGenerationAttempts,
  type GenerationAttemptRecord,
} from '../src/generation-ledger'
import { generateAuditCatalog } from '../src/generator'

describe('generation ledger and yield report', () => {
  it('summarizes attempts from the closed reason-code set', () => {
    const records: GenerationAttemptRecord[] = [
      {
        sourceBucket: 'easy',
        candidateIndex: 0,
        candidateSeed: 'a',
        disposition: 'accepted',
        reasonCode: 'ACCEPTED',
      },
      {
        sourceBucket: 'easy',
        candidateIndex: 1,
        candidateSeed: 'b',
        disposition: 'rejected',
        reasonCode: 'LEGACY_MOVE_WINDOW',
      },
      {
        sourceBucket: 'hard',
        candidateIndex: 0,
        candidateSeed: 'c',
        disposition: 'rejected',
        reasonCode: 'MINIMUM_EMPTY_BUDGET_EXCEEDED',
      },
    ]

    const report = summarizeGenerationAttempts(records)
    expect(report.attempted).toBe(3)
    expect(report.accepted).toBe(1)
    expect(report.rejected).toBe(2)
    expect(report.byReason.ACCEPTED).toBe(1)
    expect(report.byReason.LEGACY_MOVE_WINDOW).toBe(1)
    expect(report.bySourceBucket.easy.attempted).toBe(2)
    expect(report.bySourceBucket.hard.byReason.MINIMUM_EMPTY_BUDGET_EXCEEDED).toBe(1)
  })

  it('emits exactly one attempt record for every candidate actually tried', () => {
    const records: GenerationAttemptRecord[] = []
    const catalog = generateAuditCatalog({
      profileName: 'baseline',
      perDifficulty: 1,
      maxAttempts: 1_000,
      batchSeed: 'test-generation-ledger',
      acceptanceMode: 'technical-validity',
      onAttempt: (record) => records.push(record),
    })

    expect(records.filter((record) => record.disposition === 'accepted')).toHaveLength(catalog.puzzles.length)
    expect(records.every((record) => record.reasonCode.length > 0)).toBe(true)

    for (const bucket of ['easy', 'medium', 'hard'] as const) {
      const attemptedIndices = records
        .filter((record) => record.sourceBucket === bucket)
        .map((record) => record.candidateIndex)
      expect(attemptedIndices).toEqual(
        Array.from({ length: attemptedIndices.length }, (_, index) => index),
      )
    }
  })
})

import type { SourceBucket } from './types'

export type GenerationDisposition = 'accepted' | 'rejected'

export type GenerationReasonCode =
  | 'ACCEPTED'
  | 'MINIMUM_EMPTY_BUDGET_EXCEEDED'
  | 'MINIMUM_EMPTY_EXHAUSTED'
  | 'STARTS_SOLVED'
  | 'LEGACY_MOVE_WINDOW'
  | 'CANONICAL_DUPLICATE'

export interface GenerationAttemptRecord {
  sourceBucket: SourceBucket
  candidateIndex: number
  candidateSeed: string
  disposition: GenerationDisposition
  reasonCode: GenerationReasonCode
  minimumRequiredEmptyTubes?: number
  optimalMoves?: number
  canonicalKey?: string
  puzzleId?: string
}

export interface GenerationYieldBucket {
  attempted: number
  accepted: number
  rejected: number
  byReason: Record<GenerationReasonCode, number>
}

export interface GenerationYieldReport extends GenerationYieldBucket {
  bySourceBucket: Record<SourceBucket, GenerationYieldBucket>
}

const REASONS: GenerationReasonCode[] = [
  'ACCEPTED',
  'MINIMUM_EMPTY_BUDGET_EXCEEDED',
  'MINIMUM_EMPTY_EXHAUSTED',
  'STARTS_SOLVED',
  'LEGACY_MOVE_WINDOW',
  'CANONICAL_DUPLICATE',
]

function emptyReasonCounts(): Record<GenerationReasonCode, number> {
  return Object.fromEntries(REASONS.map((reason) => [reason, 0])) as Record<GenerationReasonCode, number>
}

function emptyBucket(): GenerationYieldBucket {
  return {
    attempted: 0,
    accepted: 0,
    rejected: 0,
    byReason: emptyReasonCounts(),
  }
}

function addRecord(bucket: GenerationYieldBucket, record: GenerationAttemptRecord): void {
  bucket.attempted += 1
  bucket.byReason[record.reasonCode] += 1
  if (record.disposition === 'accepted') bucket.accepted += 1
  else bucket.rejected += 1
}

export function summarizeGenerationAttempts(
  records: readonly GenerationAttemptRecord[],
): GenerationYieldReport {
  const report: GenerationYieldReport = {
    ...emptyBucket(),
    bySourceBucket: {
      easy: emptyBucket(),
      medium: emptyBucket(),
      hard: emptyBucket(),
    },
  }

  for (const record of records) {
    addRecord(report, record)
    addRecord(report.bySourceBucket[record.sourceBucket], record)
  }

  return report
}

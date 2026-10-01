import type { GenerationReasonCode } from './generation-ledger'
import type { SolverMetrics, StructureDescriptors } from './types'

export type ResearchGenerationReasonCode = Exclude<
  GenerationReasonCode,
  'LEGACY_MOVE_WINDOW'
>

export interface ResearchGenerationAttemptRecord {
  stratumId: string
  typeCount: number
  candidateIndex: number
  candidateSeed: string
  disposition: 'accepted' | 'rejected'
  reasonCode: ResearchGenerationReasonCode
  minimumRequiredEmptyTubes?: number
  optimalMoves?: number
  canonicalKey?: string
  puzzleId?: string
  preProofStructure?: StructureDescriptors
  lastProofEmptyTubes?: number
  lastProofMetrics?: SolverMetrics
}

export interface ResearchGenerationYieldReport {
  stratumId: string
  typeCount: number
  attempted: number
  accepted: number
  rejected: number
  byReason: Record<ResearchGenerationReasonCode, number>
}

const REASONS: ResearchGenerationReasonCode[] = [
  'ACCEPTED',
  'MINIMUM_EMPTY_BUDGET_EXCEEDED',
  'MINIMUM_EMPTY_EXHAUSTED',
  'STARTS_SOLVED',
  'CANONICAL_DUPLICATE',
]

export function summarizeResearchGenerationAttempts(
  records: readonly ResearchGenerationAttemptRecord[],
): ResearchGenerationYieldReport {
  if (records.length === 0) {
    throw new Error('Research generation yield requires at least one attempt')
  }

  const stratumId = records[0].stratumId
  const typeCount = records[0].typeCount
  const byReason = Object.fromEntries(REASONS.map((reason) => [reason, 0])) as
    Record<ResearchGenerationReasonCode, number>

  let accepted = 0
  for (const record of records) {
    if (record.stratumId !== stratumId || record.typeCount !== typeCount) {
      throw new Error('Research yield records must belong to one stratum')
    }
    byReason[record.reasonCode] += 1
    if (record.disposition === 'accepted') accepted += 1
  }

  return {
    stratumId,
    typeCount,
    attempted: records.length,
    accepted,
    rejected: records.length - accepted,
    byReason,
  }
}

export interface ResearchGenerationYieldArtifact extends ResearchGenerationYieldReport {
  version: 'research-yield-v1'
  batchSeed: string
  configFingerprint: string
  proofBudgetVersion: string
  attempts: ResearchGenerationAttemptRecord[]
}

export function createResearchGenerationYieldArtifact(
  report: ResearchGenerationYieldReport,
  context: {
    batchSeed: string
    configFingerprint: string
    proofBudgetVersion: string
  },
  attempts: readonly ResearchGenerationAttemptRecord[],
): ResearchGenerationYieldArtifact {
  return {
    version: 'research-yield-v1',
    batchSeed: context.batchSeed,
    configFingerprint: context.configFingerprint,
    proofBudgetVersion: context.proofBudgetVersion,
    attempts: attempts.map((record) => ({ ...record })),
    ...report,
  }
}

export const RESEARCH_GENERATOR_FAMILY = 'uniform-v1' as const
export const RESEARCH_PROOF_BUDGET_VERSION = 'research-proof-200k-d200-e5-v1' as const

export const RESEARCH_PROOF_BUDGET = {
  maxVisitedStates: 200_000,
  maxDepth: 200,
  maxEmptyTubes: 5,
} as const

export function researchStratumId(typeCount: number): string {
  if (!Number.isSafeInteger(typeCount) || typeCount < 2 || typeCount > 16) {
    throw new Error('typeCount must be an integer in 2..16')
  }
  return `types-${typeCount}`
}

export interface ResearchRunConfigInput {
  stratumId: string
  typeCount: number
  capacity: number
  requestedAcceptedCount: number
  maxAttempts: number
}

export function researchFingerprintInput(config: ResearchRunConfigInput) {
  return {
    version: 'research-candidates-v1',
    generatorFamily: RESEARCH_GENERATOR_FAMILY,
    stratumId: config.stratumId,
    typeCount: config.typeCount,
    capacity: config.capacity,
    requestedAcceptedCount: config.requestedAcceptedCount,
    maxAttempts: config.maxAttempts,
    proofBudgetVersion: RESEARCH_PROOF_BUDGET_VERSION,
    proofBudget: RESEARCH_PROOF_BUDGET,
  } as const
}

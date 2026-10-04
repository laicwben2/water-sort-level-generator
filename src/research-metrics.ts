import type { MistakeRecoveryMetrics } from './types'

/** Necessary arithmetic invariants, not a substitute for solver certification. */
export function validateRecoveryTotals(m: MistakeRecoveryMetrics): void {
  for (const n of [m.recoverableMistakeCount, m.recoveryPenaltyTotal, m.maximumRecoveryPenalty, m.severeRecoveryCount, m.config.severeRecoveryThreshold]) {
    if (n !== undefined && (!Number.isSafeInteger(n) || n < 0)) throw new Error('Invalid recovery integer')
  }
  if (m.config.severeRecoveryThreshold < 1) throw new Error('Invalid severe recovery threshold')
  const count = BigInt(m.recoverableMistakeCount), max = BigInt(m.maximumRecoveryPenalty), severe = BigInt(m.severeRecoveryCount)
  const threshold = BigInt(m.config.severeRecoveryThreshold)
  if (severe > count || (count === 0n && (max !== 0n || severe !== 0n))
    || (count > 0n && max < 1n) || (max < threshold && severe !== 0n)
    || (max >= threshold && count > 0n && severe < 1n)) throw new Error('Contradictory recovery maximum/severe counts')
  if (m.recoveryPenaltyTotal !== undefined) {
    const total = BigInt(m.recoveryPenaltyTotal)
    const lower = severe * threshold + (count - severe)
    const upper = severe * max + (count - severe) * (max < threshold ? max : threshold - 1n)
    if (total < count || total < max || total > count * max || total < lower || total > upper) throw new Error('Contradictory recovery penalty total')
  }
}

import { isDeepStrictEqual } from 'node:util'
import { digest, RESEARCH_VERSION, type LocalPuzzle, type LocalShard } from './shard'
import { validateRecoveryTotals } from './research-metrics'
import type { MistakeAnalysisConfig } from './types'
import { DEFAULT_MISTAKE_ANALYSIS_CONFIG } from './difficulty'

export interface ResearchRecord { candidateIndex: number; canonicalKey: string; research: LocalPuzzle['research'] }
export interface ResearchArtifact {
  formatVersion: 'local-research-v1' | 'local-research-v2'
  sourceShardDigest: string
  config: MistakeAnalysisConfig
  records: ResearchRecord[]
  selection?: { candidateIndices: number[] }
  digest: string
}
export function validateAnalysisConfig(config: MistakeAnalysisConfig): void {
  if (!config || Object.keys(config).sort().join() !== Object.keys(DEFAULT_MISTAKE_ANALYSIS_CONFIG).sort().join()) throw new Error('Unsupported analysis config')
  for (const [key, n] of Object.entries(config)) if (!Number.isSafeInteger(n) || n < 1) throw new Error(`Invalid analysis config: ${key}`)
}
export function validateResearchArtifact(input: unknown, source?: LocalShard): asserts input is ResearchArtifact {
  if (!input || typeof input !== 'object') throw new Error('Malformed research artifact')
  const a = input as ResearchArtifact
  if (!['local-research-v1', 'local-research-v2'].includes(a.formatVersion)) throw new Error('Unsupported research format')
  const allowed = ['formatVersion', 'sourceShardDigest', 'config', 'records', 'digest', ...(a.formatVersion === 'local-research-v2' ? ['selection'] : [])]
  if (Object.keys(a).sort().join() !== allowed.sort().join()) throw new Error('Unsupported research fields')
  validateAnalysisConfig(a.config)
  if (!/^[a-f0-9]{64}$/.test(a.sourceShardDigest) || !Array.isArray(a.records)) throw new Error('Invalid research source/records')
  if (source && source.digest !== a.sourceShardDigest) throw new Error('Research source digest mismatch')
  const puzzles = source ? new Map(source.acceptedPuzzles.map(p => [p.candidateIndex, p])) : undefined
  let previous = -1
  for (const r of a.records) {
    if (!r || Object.keys(r).sort().join() !== ['candidateIndex','canonicalKey','research'].sort().join()
      || !Number.isSafeInteger(r.candidateIndex) || r.candidateIndex <= previous || typeof r.canonicalKey !== 'string' || !r.canonicalKey.startsWith('tube-order-v2:tube64-v1:')) throw new Error('Invalid/duplicate/unordered research record')
    previous = r.candidateIndex
    if (!r.research || Object.keys(r.research).sort().join() !== ['analysisVersion','complete','structural','optimalPath','mistakeRecovery'].sort().join()) throw new Error('Research fields mismatch')
    for (const metrics of [r.research.structural, r.research.optimalPath]) {
      if (!metrics || typeof metrics !== 'object') throw new Error('Missing research metrics')
      for (const n of Object.values(metrics)) if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw new Error('Invalid research metric number')
    }
    const m = r.research?.mistakeRecovery
    if (!m || r.research.analysisVersion !== RESEARCH_VERSION || !isDeepStrictEqual(m.config, a.config)) throw new Error(`Research config/version mismatch at ${r.candidateIndex}`)
    for (const [key,n] of Object.entries(m)) if (key !== 'config' && (typeof n !== 'number' || !Number.isFinite(n) || n < 0)) throw new Error(`Invalid research metric ${key}`)
    const counts = ['analyzedSteps','skippedSteps','eligibleAlternatives','analyzedAlternatives','skippedAlternatives','equivalentOptimalSuccessorsExcluded','optimalAlternativeCount','recoverableMistakeCount','deadEndCount','unknownCount','knownAlternativeCount','wrongMoveCount','recoveryPenaltyTotal','maximumRecoveryPenalty','severeRecoveryCount'] as const
    if (Object.keys(m).sort().join() !== ['config',...counts,'analyzedCoverage','knownCoverage','deadEndRatio','averageRecoveryPenalty'].sort().join()) throw new Error('Research metric fields mismatch')
    for (const key of counts) if (!Number.isSafeInteger(m[key])) throw new Error(`Invalid research count ${key}`)
    const known = m.optimalAlternativeCount + m.recoverableMistakeCount + m.deadEndCount, wrong = m.recoverableMistakeCount + m.deadEndCount
    if (known !== m.knownAlternativeCount || wrong !== m.wrongMoveCount || known + m.unknownCount !== m.analyzedAlternatives
      || m.analyzedAlternatives + m.skippedAlternatives !== m.eligibleAlternatives || m.analyzedSteps > a.config.maxAnalyzedSteps
      || m.analyzedAlternatives > m.analyzedSteps * a.config.maxAlternativesPerStep) throw new Error('Research count accounting mismatch')
    const ratios = [m.analyzedCoverage,m.knownCoverage,m.deadEndRatio,m.averageRecoveryPenalty]
    const expected = [m.eligibleAlternatives ? m.analyzedAlternatives/m.eligibleAlternatives : 1,m.eligibleAlternatives ? known/m.eligibleAlternatives : 1,wrong ? m.deadEndCount/wrong : 0,m.recoverableMistakeCount ? m.recoveryPenaltyTotal!/m.recoverableMistakeCount : 0]
    if (!isDeepStrictEqual(ratios,expected) || r.research.complete !== (m.skippedSteps === 0 && m.skippedAlternatives === 0 && m.unknownCount === 0)) throw new Error('Research coverage mismatch')
    validateRecoveryTotals(m)
    if (puzzles) {
      const p = puzzles.get(r.candidateIndex)
      if (!p || p.canonicalKey !== r.canonicalKey || !isDeepStrictEqual(p.research.structural, r.research.structural)
        || !isDeepStrictEqual(p.research.optimalPath,r.research.optimalPath) || m.analyzedSteps+m.skippedSteps !== p.optimalSolution.length) throw new Error(`Research source record mismatch at ${r.candidateIndex}`)
    }
  }
  if (a.formatVersion === 'local-research-v2' && (!a.selection || Object.keys(a.selection).join() !== 'candidateIndices' || !isDeepStrictEqual(a.selection.candidateIndices, a.records.map(r=>r.candidateIndex)))) throw new Error('Research selection mismatch')
  if (source && a.formatVersion === 'local-research-v1' && !isDeepStrictEqual(a.records.map(r=>r.candidateIndex),source.acceptedPuzzles.map(p=>p.candidateIndex))) throw new Error('Incomplete v1 research artifact')
  const {digest: stored, ...payload} = a
  if (stored !== digest(payload)) throw new Error('Research digest mismatch')
}

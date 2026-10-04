import { createHash } from 'node:crypto'
import { CANONICAL_VERSION, ENCODING_VERSION, canonicalPuzzleKey, canonicalPuzzleSequence } from './canonical'
import { generateBalancedFullTubes } from './candidate'
import { analyzeDifficultyV2, DEFAULT_MISTAKE_ANALYSIS_CONFIG } from './difficulty'
import { findMinimumEmptyTubes } from './generator'
import { deriveCandidateSeed } from './rng'
import { isSolved } from './rules'
import type { AuditPuzzle, Board, DifficultyV2Metrics, EmptyTubeAnalysis, MistakeAnalysisConfig, MistakeRecoveryMetrics } from './types'
import { validateAuditCatalog } from './validator'
import { GENERATOR_VERSION, RNG_VERSION, RULES_VERSION, SOLVER_STATE_ENCODING_VERSION } from './version'

export const LOCAL_GENERATOR_VERSION = 'local-global-index-v1+generator-0.2.0'
export const RESEARCH_VERSION = 'workload-trap-recovery-v1'
export const SHARD_FORMAT = 'local-shard-v1'
export interface LocalConfig {
  colors: number[]
  capacity: number
  maxEmptyTubes: number
  maxDepth: number
  maxVisitedStates: number
  mistakeAnalysis: MistakeAnalysisConfig
}
export const DEFAULT_LOCAL_CONFIG: LocalConfig = {
  colors: [5, 6, 7], capacity: 4, maxEmptyTubes: 5, maxDepth: 100,
  maxVisitedStates: 100_000, mistakeAnalysis: { ...DEFAULT_MISTAKE_ANALYSIS_CONFIG },
}
export type LocalPuzzle = Omit<AuditPuzzle, 'difficulty' | 'difficultyV2'> & {
  normalizedRepresentation: string[]
  research: DifficultyV2Metrics & { mistakeRecovery: MistakeRecoveryMetrics & { knownAlternativeCount: number; wrongMoveCount: number; recoveryPenaltyTotal: number }; analysisVersion: typeof RESEARCH_VERSION; complete: boolean }
}
export interface CandidateResult {
  candidateIndex: number
  candidateSeed: string
  rawCandidate: Board
  status: 'accepted' | 'quality-rejected' | 'unknown'
  reason?: 'starts-solved' | 'budget-exceeded' | 'max-empty-tubes-exhausted'
  emptyTubeAnalysis: EmptyTubeAnalysis[]
  puzzle?: LocalPuzzle
}
export interface CandidateRange { startIndex: number; endIndex: number }
export interface LocalShard {
  formatVersion: typeof SHARD_FORMAT
  rulesVersion: typeof RULES_VERSION
  reproducibility: {
    generatorVersion: string; rngVersion: string; canonicalVersion: string
    encodingVersion: string; solverStateEncodingVersion: string; analysisVersion: string
    seedNamespace: string; configFingerprintVersion: string; serializationVersion: string
    batchSeed: string; configFingerprint: string
  }
  config: LocalConfig
  startIndex: number
  endIndex: number
  ranges: CandidateRange[]
  candidatesProcessed: number
  candidates: CandidateResult[]
  acceptedPuzzles: LocalPuzzle[]
  duplicates: Array<{ candidateIndex: number; retainedCandidateIndex: number; canonicalKey: string }>
  summary: { accepted: number; duplicate: number; qualityRejected: number; unknown: number; analysisIncomplete: number }
  digest: string
}

// Code-unit ordering, independent of locale. Only JSON data can enter artifacts.
export function serialize(value: unknown): string {
  function ordered(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(ordered)
    if (input !== null && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, item]) => [key, ordered(item)]))
    }
    if (typeof input === 'number' && !Number.isFinite(input)) throw new Error('Non-finite JSON number')
    if (input === undefined || typeof input === 'bigint' || typeof input === 'function') throw new Error('Non-JSON value')
    return input
  }
  return `${JSON.stringify(ordered(value), null, 2)}\n`
}
export function digest(value: unknown): string {
  return createHash('sha256').update(serialize(value), 'utf8').digest('hex')
}
function shardDigest(shard: LocalShard): string {
  const { digest: _digest, ...payload } = shard
  return digest(payload)
}
function integer(value: unknown, name: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a safe integer in ${minimum}..${maximum}`)
  }
}
export function validateRange(startIndex: number, endIndex: number): void {
  integer(startIndex, 'startIndex', 0)
  integer(endIndex, 'endIndex', startIndex, Number.MAX_SAFE_INTEGER - 1)
  integer(endIndex - startIndex + 1, 'range length', 1)
}
export function validateConfig(config: LocalConfig): void {
  if (!config || !Array.isArray(config.colors) || config.colors.length === 0) throw new Error('Missing colors')
  for (const color of config.colors) integer(color, 'colors', 2, 16)
  if (new Set(config.colors).size !== config.colors.length) throw new Error('Repeated colors configuration')
  integer(config.capacity, 'capacity', 1, 4)
  integer(config.maxEmptyTubes, 'maxEmptyTubes', 1, 16)
  integer(config.maxDepth, 'maxDepth', 1)
  integer(config.maxVisitedStates, 'maxVisitedStates', 1)
  if (!config.mistakeAnalysis) throw new Error('Missing mistakeAnalysis')
  for (const field of Object.keys(DEFAULT_MISTAKE_ANALYSIS_CONFIG) as Array<keyof MistakeAnalysisConfig>) {
    integer(config.mistakeAnalysis[field], field, 1)
  }
  if (Object.keys(config).sort().join() !== Object.keys(DEFAULT_LOCAL_CONFIG).sort().join()
      || Object.keys(config.mistakeAnalysis).sort().join() !== Object.keys(DEFAULT_MISTAKE_ANALYSIS_CONFIG).sort().join()) {
    throw new Error('Unsupported configuration fields')
  }
}
function versions(batchSeed: string, config: LocalConfig): LocalShard['reproducibility'] {
  return {
    generatorVersion: LOCAL_GENERATOR_VERSION, rngVersion: RNG_VERSION,
    canonicalVersion: CANONICAL_VERSION, encodingVersion: ENCODING_VERSION,
    solverStateEncodingVersion: SOLVER_STATE_ENCODING_VERSION, analysisVersion: RESEARCH_VERSION,
    seedNamespace: 'local-v1', configFingerprintVersion: 'sha256-canonical-json-v1',
    serializationVersion: 'sorted-json-lf-v1', batchSeed, configFingerprint: digest(config),
  }
}
export function analyzeLocalPuzzle(puzzle: Pick<LocalPuzzle, 'board' | 'optimalSolution' | 'capacity'>, config: MistakeAnalysisConfig): LocalPuzzle['research'] {
  const metrics = analyzeDifficultyV2(puzzle.board, puzzle.optimalSolution, puzzle.capacity, config)
  const mistake = metrics.mistakeRecovery!
  return {
    analysisVersion: RESEARCH_VERSION,
    complete: mistake.skippedSteps === 0 && mistake.skippedAlternatives === 0 && mistake.unknownCount === 0,
    ...metrics,
    mistakeRecovery: { ...mistake, knownAlternativeCount: mistake.knownAlternativeCount!, wrongMoveCount: mistake.wrongMoveCount!, recoveryPenaltyTotal: mistake.recoveryPenaltyTotal! },
  }
}
export function generateLocalCandidate(candidateIndex: number, batchSeed: string, config: LocalConfig): CandidateResult {
  integer(candidateIndex, 'candidateIndex', 0)
  validateConfig(config)
  const colors = config.colors[candidateIndex % config.colors.length]
  const candidateSeed = deriveCandidateSeed(batchSeed, 'local-v1', `types-${colors}`, candidateIndex)
  const rawCandidate = generateBalancedFullTubes(colors, config.capacity, candidateSeed)
  const minimum = findMinimumEmptyTubes(rawCandidate, config)
  const base = { candidateIndex, candidateSeed, rawCandidate, emptyTubeAnalysis: minimum.analyses }
  if (minimum.status === 'unknown') return { ...base, status: 'unknown', reason: minimum.reason }
  if (isSolved(minimum.board, config.capacity)) return { ...base, status: 'quality-rejected', reason: 'starts-solved' }
  const research = analyzeLocalPuzzle({ board: minimum.board, optimalSolution: minimum.result.solution, capacity: config.capacity }, config.mistakeAnalysis)
  const { optimalMoves: _moves, movesIntoEmptyTube: _empty, movesJoiningSameType: _joins, stagingRatio: _ratio, ...path } = research.optimalPath
  const puzzle: LocalPuzzle = {
    id: `ws-local-v1-c${String(candidateIndex).padStart(6, '0')}`,
    candidateIndex, candidateSeed, capacity: config.capacity,
    emptyTubes: minimum.minimumRequiredEmptyTubes,
    minimumRequiredEmptyTubes: minimum.minimumRequiredEmptyTubes,
    board: minimum.board, optimalSolution: minimum.result.solution,
    canonicalKey: canonicalPuzzleKey(minimum.board),
    normalizedRepresentation: canonicalPuzzleSequence(minimum.board).map(value => value.toString(16).padStart(16, '0')),
    solver: { optimalMoves: minimum.result.solution.length, ...minimum.result.metrics },
    solutionPath: path, emptyTubeAnalysis: minimum.analyses, research,
  }
  return { ...base, status: 'accepted', puzzle }
}

function assemble(candidates: CandidateResult[], ranges: CandidateRange[], batchSeed: string, config: LocalConfig): LocalShard {
  const sorted = [...candidates].sort((a, b) => a.candidateIndex - b.candidateIndex)
  const sortedRanges: CandidateRange[] = []
  for (const range of [...ranges].sort((a, b) => a.startIndex - b.startIndex)) {
    const previous = sortedRanges.at(-1)
    if (previous && range.startIndex <= previous.endIndex) throw new Error('Overlapping candidate ranges')
    if (previous && range.startIndex === previous.endIndex + 1) previous.endIndex = range.endIndex
    else sortedRanges.push({ ...range })
  }
  const acceptedPuzzles: LocalPuzzle[] = []
  const duplicates: LocalShard['duplicates'] = []
  const winners = new Map<string, number>()
  for (const candidate of sorted) {
    if (candidate.status !== 'accepted') continue
    const puzzle = candidate.puzzle!
    const winner = winners.get(puzzle.canonicalKey)
    if (winner !== undefined) duplicates.push({ candidateIndex: candidate.candidateIndex, retainedCandidateIndex: winner, canonicalKey: puzzle.canonicalKey })
    else { winners.set(puzzle.canonicalKey, candidate.candidateIndex); acceptedPuzzles.push(puzzle) }
  }
  const shard: LocalShard = {
    formatVersion: SHARD_FORMAT, rulesVersion: RULES_VERSION, reproducibility: versions(batchSeed, config),
    config: structuredClone(config), startIndex: sortedRanges[0].startIndex,
    endIndex: sortedRanges.at(-1)!.endIndex, ranges: sortedRanges,
    candidatesProcessed: sorted.length, candidates: sorted, acceptedPuzzles, duplicates,
    summary: {
      accepted: acceptedPuzzles.length, duplicate: duplicates.length,
      qualityRejected: sorted.filter(c => c.status === 'quality-rejected').length,
      unknown: sorted.filter(c => c.status === 'unknown').length,
      analysisIncomplete: sorted.filter(c => c.puzzle && !c.puzzle.research.complete).length,
    }, digest: '',
  }
  shard.digest = shardDigest(shard)
  return shard
}
export function generateLocalShard(options: CandidateRange & { batchSeed: string; config?: LocalConfig; onCandidate?: (candidate: CandidateResult) => void }): LocalShard {
  validateRange(options.startIndex, options.endIndex)
  if (typeof options.batchSeed !== 'string' || !options.batchSeed.trim()) throw new Error('Missing seed')
  const config = structuredClone(options.config ?? DEFAULT_LOCAL_CONFIG)
  validateConfig(config)
  const candidates: CandidateResult[] = []
  for (let index = options.startIndex; index <= options.endIndex; index += 1) {
    const candidate = generateLocalCandidate(index, options.batchSeed, config)
    candidates.push(candidate)
    options.onCandidate?.(structuredClone(candidate))
  }
  return assemble(candidates, [{ startIndex: options.startIndex, endIndex: options.endIndex }], options.batchSeed, config)
}

function checkKeys(value: object, required: string[], optional: string[] = []): void {
  const keys = Object.keys(value)
  if (required.some(key => !keys.includes(key)) || keys.some(key => !required.includes(key) && !optional.includes(key))) throw new Error('Unsupported or missing fields')
}

function checkMetricNumbers(value: unknown): void {
  if (value === null || typeof value !== 'object') throw new Error('Malformed metrics')
  for (const item of Object.values(value)) {
    if (typeof item === 'object') checkMetricNumbers(item)
    else if (typeof item !== 'number' || !Number.isFinite(item) || item < 0) throw new Error('Invalid metric')
  }
}
function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (serialize(actual) !== serialize(expected)) throw new Error(message)
}

// This validates saved proof metadata and replay, never repeats expensive solves.
export function validateLocalShard(input: unknown): asserts input is LocalShard {
  if (!input || typeof input !== 'object') throw new Error('Malformed shard')
  const shard = input as LocalShard
  if (shard.formatVersion !== SHARD_FORMAT || shard.rulesVersion !== RULES_VERSION) throw new Error('Unsupported format/rules version')
  validateConfig(shard.config)
  if (typeof shard.reproducibility?.batchSeed !== 'string' || !shard.reproducibility.batchSeed.trim()) throw new Error('Missing seed')
  assertEqual(shard.reproducibility, versions(shard.reproducibility.batchSeed, shard.config), 'Reproducibility mismatch')
  if (!Array.isArray(shard.ranges) || shard.ranges.length === 0 || !Array.isArray(shard.candidates)) throw new Error('Missing ranges/candidates')
  let offset = 0
  let previousEnd = -2
  for (const range of shard.ranges) {
    validateRange(range.startIndex, range.endIndex)
    if (range.startIndex <= previousEnd + 1) throw new Error('Overlapping, unordered or unnormalized ranges')
    previousEnd = range.endIndex
    for (let index = range.startIndex; index <= range.endIndex; index += 1) {
      const candidate = shard.candidates[offset++]
      if (!candidate || candidate.candidateIndex !== index) throw new Error('Missing/duplicate/unordered candidate index')
      checkKeys(candidate, ['candidateIndex', 'candidateSeed', 'rawCandidate', 'status', 'emptyTubeAnalysis'], ['reason', 'puzzle'])
      const colors = shard.config.colors[index % shard.config.colors.length]
      const expectedSeed = deriveCandidateSeed(shard.reproducibility.batchSeed, 'local-v1', `types-${colors}`, index)
      if (candidate.candidateSeed !== expectedSeed) throw new Error('Candidate seed mismatch')
      assertEqual(candidate.rawCandidate, generateBalancedFullTubes(colors, shard.config.capacity, expectedSeed), 'Raw candidate mismatch')
      const analyses = candidate.emptyTubeAnalysis
      if (!Array.isArray(analyses) || analyses.length < 1 || analyses.length > shard.config.maxEmptyTubes) throw new Error('Malformed proof')
      for (let step = 0; step < analyses.length; step += 1) {
        const proof = analyses[step]
        if (proof.emptyTubes !== step + 1 || !['solved', 'unsolvable', 'budget-exceeded'].includes(proof.status)) throw new Error('Malformed proof status')
        if (step < analyses.length - 1 && proof.status !== 'unsolvable') throw new Error('Inexact minimum proof')
        checkKeys(proof, ['emptyTubes', 'status', 'metrics'], proof.status === 'solved' ? ['optimalMoves'] : [])
        checkKeys(proof.metrics, ['exploredStates', 'visitedStates', 'generatedMoves', 'maxDepthReached', 'averageBranching'])
        checkMetricNumbers(proof.metrics)
        if (proof.status === 'solved') integer(proof.optimalMoves, 'optimalMoves', 0, shard.config.maxDepth)
        if (proof.metrics.averageBranching !== (proof.metrics.exploredStates === 0 ? 0 : proof.metrics.generatedMoves / proof.metrics.exploredStates)) throw new Error('Solver ratio mismatch')
        for (const key of ['exploredStates', 'visitedStates', 'generatedMoves', 'maxDepthReached'] as const) integer(proof.metrics[key], key, 0)
        if (proof.metrics.visitedStates > shard.config.maxVisitedStates || proof.metrics.maxDepthReached > shard.config.maxDepth) throw new Error('Proof exceeds configured budget')
      }
      const last = analyses.at(-1)!
      if (candidate.status === 'unknown') {
        if (candidate.puzzle !== undefined || (candidate.reason === 'budget-exceeded' ? last.status !== 'budget-exceeded'
          : candidate.reason !== 'max-empty-tubes-exhausted' || last.status !== 'unsolvable' || analyses.length !== shard.config.maxEmptyTubes)) throw new Error('Invalid UNKNOWN semantics')
      } else if (candidate.status === 'quality-rejected') {
        if (candidate.puzzle !== undefined || candidate.reason !== 'starts-solved' || last.status !== 'solved'
          || !isSolved([...candidate.rawCandidate, []], shard.config.capacity) || last.optimalMoves !== 0) throw new Error('Invalid quality rejection')
      } else if (candidate.status === 'accepted') {
        const puzzle = candidate.puzzle
        if (!puzzle || candidate.reason !== undefined || last.status !== 'solved') throw new Error('Missing accepted puzzle')
        if (puzzle.candidateIndex !== index || puzzle.candidateSeed !== expectedSeed || puzzle.capacity !== shard.config.capacity
          || puzzle.id !== `ws-local-v1-c${String(index).padStart(6, '0')}`) throw new Error('Puzzle identity mismatch')
        checkKeys(puzzle, ['id', 'candidateIndex', 'candidateSeed', 'capacity', 'emptyTubes', 'minimumRequiredEmptyTubes', 'board', 'optimalSolution', 'canonicalKey', 'normalizedRepresentation', 'solver', 'solutionPath', 'emptyTubeAnalysis', 'research'])
        checkKeys(puzzle.research, ['analysisVersion', 'complete', 'structural', 'optimalPath', 'mistakeRecovery'])
        for (const key of ['typeTubeSpreadTotal', 'blockingDepthTotal', 'blockingSegmentCount'] as const) integer(puzzle.research.structural[key], key, 0)
        assertEqual(puzzle.board, [...candidate.rawCandidate, ...Array.from({ length: analyses.length }, () => [])], 'Board differs from proof')
        assertEqual(puzzle.emptyTubeAnalysis, analyses, 'Proof metadata mismatch')
        assertEqual(puzzle.solver, { optimalMoves: puzzle.optimalSolution.length, ...last.metrics }, 'Solver metrics mismatch')
        if (last.optimalMoves !== puzzle.optimalSolution.length) throw new Error('Proof move length mismatch')
        assertEqual(puzzle.normalizedRepresentation, canonicalPuzzleSequence(puzzle.board).map(v => v.toString(16).padStart(16, '0')), 'Normalization mismatch')
        if (!puzzle.research || puzzle.research.analysisVersion !== RESEARCH_VERSION) throw new Error('Research version mismatch')
        const mistake = puzzle.research.mistakeRecovery
        if (!mistake) throw new Error('Missing mistake analysis')
        checkKeys(mistake, ['config', 'analyzedSteps', 'skippedSteps', 'eligibleAlternatives', 'analyzedAlternatives', 'skippedAlternatives', 'equivalentOptimalSuccessorsExcluded', 'optimalAlternativeCount', 'recoverableMistakeCount', 'deadEndCount', 'unknownCount', 'knownAlternativeCount', 'wrongMoveCount', 'recoveryPenaltyTotal', 'analyzedCoverage', 'knownCoverage', 'deadEndRatio', 'averageRecoveryPenalty', 'maximumRecoveryPenalty', 'severeRecoveryCount'])
        checkMetricNumbers(mistake)
        assertEqual(mistake.config, shard.config.mistakeAnalysis, 'Analysis config mismatch')
        for (const key of ['analyzedSteps', 'skippedSteps', 'eligibleAlternatives', 'analyzedAlternatives', 'skippedAlternatives',
          'equivalentOptimalSuccessorsExcluded', 'optimalAlternativeCount', 'recoverableMistakeCount', 'deadEndCount', 'unknownCount',
          'knownAlternativeCount', 'wrongMoveCount', 'recoveryPenaltyTotal', 'maximumRecoveryPenalty', 'severeRecoveryCount'] as const) integer(mistake[key], key, 0)
        const known = mistake.optimalAlternativeCount + mistake.recoverableMistakeCount + mistake.deadEndCount
        const wrong = mistake.recoverableMistakeCount + mistake.deadEndCount
        if (mistake.knownAlternativeCount !== known || mistake.wrongMoveCount !== wrong
            || mistake.analyzedSteps + mistake.skippedSteps !== puzzle.optimalSolution.length
            || mistake.analyzedSteps > shard.config.mistakeAnalysis.maxAnalyzedSteps
            || mistake.analyzedAlternatives > mistake.analyzedSteps * shard.config.mistakeAnalysis.maxAlternativesPerStep
            || mistake.severeRecoveryCount > mistake.recoverableMistakeCount
            || mistake.maximumRecoveryPenalty > mistake.recoveryPenaltyTotal) throw new Error('Research raw counts mismatch')
        assertEqual([mistake.analyzedCoverage, mistake.knownCoverage, mistake.deadEndRatio, mistake.averageRecoveryPenalty], [
          mistake.eligibleAlternatives === 0 ? 1 : mistake.analyzedAlternatives / mistake.eligibleAlternatives,
          mistake.eligibleAlternatives === 0 ? 1 : known / mistake.eligibleAlternatives,
          wrong === 0 ? 0 : mistake.deadEndCount / wrong,
          mistake.recoverableMistakeCount === 0 ? 0 : mistake.recoveryPenaltyTotal / mistake.recoverableMistakeCount,
        ], 'Research ratio reporting mismatch')
        if (puzzle.research.complete !== (mistake.skippedSteps === 0 && mistake.skippedAlternatives === 0 && mistake.unknownCount === 0)) throw new Error('Invalid analysis completeness')
        validateAuditCatalog({
          version: 'audit-v2', generator: 'balanced-shuffle+bounded-a-star', profile: 'local-validation',
          reproducibility: { ...shard.reproducibility, generatorVersion: GENERATOR_VERSION },
          // Historical label only satisfies the legacy validator's type; never enters stored shards.
          puzzles: [{ ...puzzle, difficulty: 'easy', difficultyV2: {
            structural: puzzle.research.structural, optimalPath: puzzle.research.optimalPath, mistakeRecovery: mistake,
          } }],
        })
      } else throw new Error('Invalid candidate outcome')
    }
  }
  if (offset !== shard.candidates.length) throw new Error('Extra candidates outside range')
  const rebuilt = assemble(shard.candidates, shard.ranges, shard.reproducibility.batchSeed, shard.config)
  assertEqual(shard, rebuilt, 'Shard structure, projection, summary or digest mismatch')
}
export function mergeLocalShards(inputs: unknown[]): LocalShard {
  if (inputs.length === 0) throw new Error('No shards supplied')
  inputs.forEach(validateLocalShard)
  const shards = inputs as LocalShard[]
  const first = shards[0]
  for (const shard of shards.slice(1)) {
    assertEqual(shard.reproducibility, first.reproducibility, 'Shard metadata mismatch')
    assertEqual(shard.config, first.config, 'Shard configuration mismatch')
  }
  return assemble(shards.flatMap(s => s.candidates), shards.flatMap(s => s.ranges), first.reproducibility.batchSeed, first.config)
}
export function compareLocalShards(first: unknown, second: unknown): { identical: true; candidatesMatched: number; digest: string } {
  validateLocalShard(first); validateLocalShard(second)
  assertEqual(first, second, 'Deterministic shard mismatch')
  return { identical: true, candidatesMatched: first.candidatesProcessed, digest: first.digest }
}

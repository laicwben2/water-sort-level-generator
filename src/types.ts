export type ColorId = number
export type Tube = ColorId[]
export type Board = Tube[]
export type Difficulty = 'easy' | 'medium' | 'hard'
export type SourceBucket = Difficulty
export type GenerationAcceptanceMode = 'legacy-difficulty-window' | 'technical-validity'

export interface Move {
  from: number
  to: number
  color: ColorId
  amount: number
}

export interface SolverMetrics {
  exploredStates: number
  visitedStates: number
  generatedMoves: number
  maxDepthReached: number
  averageBranching: number
}

export interface SolutionPathMetrics {
  decisionSteps: number
  forcedSteps: number
  totalAlternativeMoves: number
  averageChoices: number
  maximumChoices: number
}


export interface MistakeAnalysisMetrics {
  analyzedStates: number
  decisionStates: number
  alternatives: number
  optimalEquivalentAlternatives: number
  recoverableAlternatives: number
  deadEndAlternatives: number
  unknownAlternatives: number
  analysisCoverage: number
  alternativesPerAnalyzedState: number
  wrongMoveDensity: number
  deadEndDensity: number
  deadEndRisk: number
  averageRecoveryPenalty: number
  p50RecoveryPenalty: number
  p90RecoveryPenalty: number
  maxRecoveryPenalty: number
}

export type SolverResult =
  | { status: 'solved'; solution: Move[]; metrics: SolverMetrics }
  | { status: 'unsolvable'; metrics: SolverMetrics }
  | { status: 'budget-exceeded'; metrics: SolverMetrics }

export interface EmptyTubeAnalysis {
  emptyTubes: number
  status: SolverResult['status']
  optimalMoves?: number
  metrics: SolverMetrics
}

export interface AuditPuzzle {
  /** Legacy provenance-derived level ID retained for compatibility. */
  id: string
  /** Stable structural puzzle identity. New catalogs emit this; historical audit-v2 files may omit it. */
  puzzleId?: string
  /** Consumer-compatible label. It is not treated as calibrated human difficulty during authoring migration. */
  difficulty: Difficulty
  /** Immutable generation provenance bucket used to reconstruct candidate seed/profile behavior. */
  sourceBucket?: SourceBucket
  candidateIndex: number
  candidateSeed: string
  capacity: number
  emptyTubes: number
  minimumRequiredEmptyTubes: number
  board: Board
  optimalSolution: Move[]
  canonicalKey: string
  solver: SolverMetrics & { optimalMoves: number }
  solutionPath: SolutionPathMetrics
  mistakeAnalysis?: MistakeAnalysisMetrics
  emptyTubeAnalysis: EmptyTubeAnalysis[]
}

export interface AuditCatalog {
  version: 'audit-v2'
  generator: 'balanced-shuffle+bounded-a-star'
  profile: string
  reproducibility: {
    generatorVersion: string
    rngVersion: string
    canonicalVersion: string
    encodingVersion: string
    solverStateEncodingVersion: string
    /** Puzzle identity derivation version. Optional for historical audit-v2 compatibility. */
    puzzleIdentityVersion?: string
    /** Candidate acceptance policy. Optional for historical audit-v2 compatibility. */
    acceptanceMode?: GenerationAcceptanceMode
    batchSeed: string
    configFingerprint: string
  }
  puzzles: AuditPuzzle[]
}

export interface RuntimeLevel {
  id: string
  difficulty: Difficulty
  capacity: number
  board: Board
  metadata?: {
    optimalMoves?: number
  }
}

export interface RuntimeLevelPack {
  formatVersion: 1
  rulesVersion: 'classic-v1'
  packId: string
  generatedBy: 'water-sort-level-generator'
  levels: RuntimeLevel[]
}

export interface SolutionArtifactEntry {
  id: string
  optimalMoves: number
  optimalSolution: Move[]
}

export interface SolutionArtifact {
  formatVersion: 1
  rulesVersion: 'classic-v1'
  generatedBy: 'water-sort-level-generator'
  solutions: SolutionArtifactEntry[]
}

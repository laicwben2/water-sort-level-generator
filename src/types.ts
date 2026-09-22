export type ColorId = number
export type Tube = ColorId[]
export type Board = Tube[]
export type Difficulty = 'easy' | 'medium' | 'hard'

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


export interface StructuralDifficultyMetrics {
  typeCount: number
  tubeCount: number
  initialEmptyTubes: number
  initialSegments: number
  fragmentationExcess: number
  averageTypeTubeSpread: number
  maximumTypeTubeSpread: number
  averageBuriedDepth: number
  maximumBuriedDepth: number
  mixedTubeCount: number
  monochromeFullTubeCount: number
}

export interface OptimalPathDifficultyMetrics extends SolutionPathMetrics {
  optimalMoves: number
  movesIntoEmptyTube: number
  movesJoiningSameType: number
  stagingRatio: number
}

export interface MistakeAnalysisConfig {
  maxVisitedStatesPerAlternative: number
  maxDepthPerAlternative: number
  maxAnalyzedSteps: number
  maxAlternativesPerStep: number
  severeRecoveryThreshold: number
}

export interface MistakeRecoveryMetrics {
  config: MistakeAnalysisConfig
  analyzedSteps: number
  skippedSteps: number
  eligibleAlternatives: number
  analyzedAlternatives: number
  skippedAlternatives: number
  equivalentOptimalSuccessorsExcluded: number
  optimalAlternativeCount: number
  recoverableMistakeCount: number
  deadEndCount: number
  unknownCount: number
  analyzedCoverage: number
  knownCoverage: number
  deadEndRatio: number
  averageRecoveryPenalty: number
  maximumRecoveryPenalty: number
  severeRecoveryCount: number
}

export interface DifficultyV2Metrics {
  structural: StructuralDifficultyMetrics
  optimalPath: OptimalPathDifficultyMetrics
  mistakeRecovery?: MistakeRecoveryMetrics
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
  id: string
  difficulty: Difficulty
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
  emptyTubeAnalysis: EmptyTubeAnalysis[]
  difficultyV2?: DifficultyV2Metrics
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

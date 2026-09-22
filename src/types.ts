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

export type SolverResult =
  | { status: 'solved'; solution: Move[]; metrics: SolverMetrics }
  | { status: 'unsolvable'; metrics: SolverMetrics }
  | { status: 'budget-exceeded'; metrics: SolverMetrics }

export interface MoveLocalFeatures {
  destination: 'empty' | 'same-type'
  joinsSameType: boolean
  movedAmount: number
  sourceBecomesEmpty: boolean
  targetBecomesComplete: boolean
  segmentDelta: number
}

export type AlternativeMoveAnalysis =
  | {
      move: Move
      features: MoveLocalFeatures
      status: 'optimal-alternative'
      nextOptimalMoves: number
      recoveryPenalty: 0
    }
  | {
      move: Move
      features: MoveLocalFeatures
      status: 'recoverable-mistake'
      nextOptimalMoves: number
      recoveryPenalty: number
    }
  | {
      move: Move
      features: MoveLocalFeatures
      status: 'dead-end'
    }
  | {
      move: Move
      features: MoveLocalFeatures
      status: 'unknown'
    }

export interface MistakeStateAnalysis {
  pathIndex: number
  remainingOptimalMoves: number
  legalMoves: number
  optimalAlternatives: number
  recoverableMistakes: number
  deadEndMoves: number
  unknownMoves: number
  recoveryPenalties: number[]
  maxRecoveryPenalty: number
  alternatives: AlternativeMoveAnalysis[]
}

export interface MistakeAnalysis {
  analyzedStates: number
  decisionStates: number
  forcedStates: number
  totalAlternativeMoves: number
  optimalAlternativeMoves: number
  recoverableMistakes: number
  deadEndMoves: number
  unknownMoves: number
  knownNonOptimalMoves: number
  deadEndRatioKnown: number
  averageRecoveryPenalty: number
  maxRecoveryPenalty: number
  highPenaltyMistakes: number
  states: MistakeStateAnalysis[]
}

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
  difficultyV2: MistakeAnalysis
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

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

export interface EmptyTubeAnalysis {
  emptyTubes: number
  status: SolverResult['status']
  minimumMoves?: number
  metrics: SolverMetrics
}

export interface AuditPuzzle {
  id: string
  difficulty: Difficulty
  sourceSeed: string
  capacity: number
  emptyTubes: number
  board: Board
  solution: Move[]
  canonicalKey: string
  solver: SolverMetrics & { minimumMoves: number }
  solutionPath: SolutionPathMetrics
  emptyTubeAnalysis: EmptyTubeAnalysis[]
}

export interface AuditCatalog {
  version: string
  generator: 'balanced-shuffle+bounded-a-star'
  profile: string
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

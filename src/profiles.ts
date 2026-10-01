import type { Difficulty } from './types'

export interface DifficultyProfile {
  colors: number
  /** Legacy source-bucket target retained for historical research compatibility. */
  targetMoves: number
  /** Legacy acceptance window; ignored in technical-validity mode. */
  minMoves: number
  /** Legacy acceptance window; ignored in technical-validity mode. */
  maxMoves: number
  /** Solver resource budget, deliberately separate from the legacy move window. */
  proofMaxDepth: number
  targetDecisionRatio: number
  maxVisitedStates: number
}

export type ProfileName = 'baseline' | 'expanded'
export type ProfileSet = Record<Difficulty, DifficultyProfile>

export const PROFILE_SETS: Record<ProfileName, ProfileSet> = {
  baseline: {
    easy: { colors: 4, targetMoves: 12, minMoves: 7, maxMoves: 24, proofMaxDepth: 36, targetDecisionRatio: 0.45, maxVisitedStates: 20_000 },
    medium: { colors: 5, targetMoves: 20, minMoves: 11, maxMoves: 34, proofMaxDepth: 46, targetDecisionRatio: 0.6, maxVisitedStates: 40_000 },
    hard: { colors: 6, targetMoves: 30, minMoves: 15, maxMoves: 50, proofMaxDepth: 62, targetDecisionRatio: 0.7, maxVisitedStates: 75_000 },
  },
  expanded: {
    easy: { colors: 5, targetMoves: 17, minMoves: 11, maxMoves: 30, proofMaxDepth: 42, targetDecisionRatio: 0.5, maxVisitedStates: 50_000 },
    medium: { colors: 6, targetMoves: 23, minMoves: 15, maxMoves: 40, proofMaxDepth: 52, targetDecisionRatio: 0.65, maxVisitedStates: 75_000 },
    hard: { colors: 7, targetMoves: 30, minMoves: 19, maxMoves: 54, proofMaxDepth: 66, targetDecisionRatio: 0.75, maxVisitedStates: 100_000 },
  },
}

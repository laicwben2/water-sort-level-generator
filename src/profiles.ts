import type { Difficulty } from './types'

export interface DifficultyProfile {
  colors: number
  targetMoves: number
  minMoves: number
  maxMoves: number
  targetDecisionRatio: number
  maxVisitedStates: number
}

export type ProfileName = 'baseline' | 'expanded'
export type ProfileSet = Record<Difficulty, DifficultyProfile>

export const PROFILE_SETS: Record<ProfileName, ProfileSet> = {
  baseline: {
    easy: { colors: 4, targetMoves: 12, minMoves: 7, maxMoves: 24, targetDecisionRatio: 0.45, maxVisitedStates: 20_000 },
    medium: { colors: 5, targetMoves: 20, minMoves: 11, maxMoves: 34, targetDecisionRatio: 0.6, maxVisitedStates: 40_000 },
    hard: { colors: 6, targetMoves: 30, minMoves: 15, maxMoves: 50, targetDecisionRatio: 0.7, maxVisitedStates: 75_000 },
  },
  expanded: {
    easy: { colors: 5, targetMoves: 17, minMoves: 11, maxMoves: 30, targetDecisionRatio: 0.5, maxVisitedStates: 50_000 },
    medium: { colors: 6, targetMoves: 23, minMoves: 15, maxMoves: 40, targetDecisionRatio: 0.65, maxVisitedStates: 75_000 },
    hard: { colors: 7, targetMoves: 30, minMoves: 19, maxMoves: 54, targetDecisionRatio: 0.75, maxVisitedStates: 100_000 },
  },
}

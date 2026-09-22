import { canonicalPuzzleKey } from './canonical'
import { PROFILE_SETS, type DifficultyProfile, type ProfileName } from './profiles'
import { createRng, shuffle } from './rng'
import { analyzeSolutionPath, solveBoard } from './solver'
import type { AuditCatalog, AuditPuzzle, Board, Difficulty, EmptyTubeAnalysis, SolverResult } from './types'

export interface GenerateOptions {
  profileName?: ProfileName
  perDifficulty?: number
  maxAttempts?: number
  capacity?: number
  maxEmptyTubes?: number
}

function balancedBoard(colors: number, capacity: number, random: () => number): Board {
  const layers = Array.from({ length: colors }, (_, color) => Array(capacity).fill(color)).flat()
  const shuffled = shuffle(layers, random)
  return Array.from({ length: colors }, (_, index) => (
    shuffled.slice(index * capacity, (index + 1) * capacity)
  ))
}

function summarizeResult(result: SolverResult, emptyTubes: number): EmptyTubeAnalysis {
  return {
    emptyTubes,
    status: result.status,
    ...(result.status === 'solved' ? { minimumMoves: result.solution.length } : {}),
    metrics: result.metrics,
  }
}

function selectDifficultyMatch(
  solvedResults: Array<{
    board: Board
    emptyTubes: number
    result: Extract<SolverResult, { status: 'solved' }>
    path: ReturnType<typeof analyzeSolutionPath>
  }>,
  profile: DifficultyProfile,
) {
  return solvedResults
    .filter(({ result }) => result.solution.length >= profile.minMoves && result.solution.length <= profile.maxMoves)
    .map((entry) => {
      const decisionRatio = entry.result.solution.length === 0
        ? 0
        : entry.path.decisionSteps / entry.result.solution.length
      return {
        ...entry,
        score: Math.abs(entry.result.solution.length - profile.targetMoves)
          + Math.abs(decisionRatio - profile.targetDecisionRatio) * 4
          + Math.abs(entry.emptyTubes - 2) * 1.5,
      }
    })
    .sort((first, second) => first.score - second.score
      || first.emptyTubes - second.emptyTubes
      || second.result.metrics.exploredStates - first.result.metrics.exploredStates)[0]
}

export function generateAuditCatalog(options: GenerateOptions = {}): AuditCatalog {
  const profileName = options.profileName ?? 'expanded'
  const perDifficulty = options.perDifficulty ?? 10
  const maxAttempts = options.maxAttempts ?? 2_000
  const capacity = options.capacity ?? 4
  const maxEmptyTubes = options.maxEmptyTubes ?? 3
  const profiles = PROFILE_SETS[profileName]
  const puzzles: AuditPuzzle[] = []
  const canonicalKeys = new Set<string>()

  for (const [difficulty, profile] of Object.entries(profiles) as Array<[Difficulty, DifficultyProfile]>) {
    let accepted = 0

    for (let attempt = 0; attempt < maxAttempts && accepted < perDifficulty; attempt += 1) {
      const sourceSeed = `water-sort:generator:v1:${profileName}:${difficulty}:candidate:${attempt}`
      const fullTubes = balancedBoard(profile.colors, capacity, createRng(sourceSeed))
      const analyses: EmptyTubeAnalysis[] = []
      const solvedResults: Array<{
        board: Board
        emptyTubes: number
        result: Extract<SolverResult, { status: 'solved' }>
        path: ReturnType<typeof analyzeSolutionPath>
      }> = []

      for (let emptyTubes = 1; emptyTubes <= maxEmptyTubes; emptyTubes += 1) {
        const board = [
          ...fullTubes.map((tube) => [...tube]),
          ...Array.from({ length: emptyTubes }, () => [] as number[]),
        ]
        const result = solveBoard(board, {
          capacity,
          maxDepth: profile.maxMoves + 12,
          maxVisitedStates: profile.maxVisitedStates,
        })
        analyses.push(summarizeResult(result, emptyTubes))
        if (result.status === 'solved') {
          solvedResults.push({
            board,
            emptyTubes,
            result,
            path: analyzeSolutionPath(board, result.solution, capacity),
          })
        }
      }

      const selected = selectDifficultyMatch(solvedResults, profile)
      if (!selected) continue
      const canonicalKey = canonicalPuzzleKey(selected.board)
      if (canonicalKeys.has(canonicalKey)) continue

      canonicalKeys.add(canonicalKey)
      accepted += 1
      puzzles.push({
        id: `ws-${profileName}-${difficulty}-c${String(attempt).padStart(6, '0')}`,
        difficulty,
        sourceSeed,
        capacity,
        emptyTubes: selected.emptyTubes,
        board: selected.board,
        solution: selected.result.solution,
        canonicalKey,
        solver: {
          minimumMoves: selected.result.solution.length,
          ...selected.result.metrics,
        },
        solutionPath: selected.path,
        emptyTubeAnalysis: analyses,
      })
    }

    if (accepted < perDifficulty) {
      throw new Error(`Only generated ${accepted}/${perDifficulty} ${difficulty} puzzles after ${maxAttempts} attempts`)
    }
  }

  return {
    version: 'audit-v1',
    generator: 'balanced-shuffle+bounded-a-star',
    profile: profileName,
    puzzles,
  }
}

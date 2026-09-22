import { canonicalPuzzleKey } from './canonical'
import { applyMove, calculatePour, isSolved } from './rules'
import { analyzeSolutionPath } from './solver'
import type { AuditCatalog } from './types'

export interface ValidationSummary {
  valid: true
  puzzles: number
  byDifficulty: Record<string, number>
}

export function validateAuditCatalog(catalog: AuditCatalog): ValidationSummary {
  const ids = new Set<string>()
  const canonicalKeys = new Set<string>()
  const byDifficulty: Record<string, number> = {}

  for (const puzzle of catalog.puzzles) {
    if (ids.has(puzzle.id)) throw new Error(`Duplicate puzzle id: ${puzzle.id}`)
    ids.add(puzzle.id)

    if (canonicalKeys.has(puzzle.canonicalKey)) throw new Error(`Canonical duplicate: ${puzzle.id}`)
    canonicalKeys.add(puzzle.canonicalKey)

    if (canonicalPuzzleKey(puzzle.board) !== puzzle.canonicalKey) {
      throw new Error(`Invalid canonical key: ${puzzle.id}`)
    }
    if (isSolved(puzzle.board, puzzle.capacity)) throw new Error(`Starts solved: ${puzzle.id}`)
    if (puzzle.board.filter((tube) => tube.length === 0).length !== puzzle.emptyTubes) {
      throw new Error(`Empty tube mismatch: ${puzzle.id}`)
    }
    if (!puzzle.board.every((tube) => tube.length === 0 || tube.length === puzzle.capacity)) {
      throw new Error(`Non-classic occupancy: ${puzzle.id}`)
    }

    const colorCounts = new Map<number, number>()
    for (const color of puzzle.board.flat()) colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1)
    if ([...colorCounts.values()].some((count) => count !== puzzle.capacity)) {
      throw new Error(`Color conservation failure: ${puzzle.id}`)
    }

    let board = puzzle.board.map((tube) => [...tube])
    for (const expectedMove of puzzle.solution) {
      const move = calculatePour(board, expectedMove.from, expectedMove.to, puzzle.capacity)
      if (JSON.stringify(move) !== JSON.stringify(expectedMove)) {
        throw new Error(`Invalid saved move: ${puzzle.id}`)
      }
      board = applyMove(board, expectedMove)
    }

    if (!isSolved(board, puzzle.capacity)) throw new Error(`Solution does not finish: ${puzzle.id}`)
    if (puzzle.solution.length !== puzzle.solver.minimumMoves) {
      throw new Error(`Solution length mismatch: ${puzzle.id}`)
    }
    if (JSON.stringify(analyzeSolutionPath(puzzle.board, puzzle.solution, puzzle.capacity))
      !== JSON.stringify(puzzle.solutionPath)) {
      throw new Error(`Solution path metrics mismatch: ${puzzle.id}`)
    }

    byDifficulty[puzzle.difficulty] = (byDifficulty[puzzle.difficulty] ?? 0) + 1
  }

  return { valid: true, puzzles: catalog.puzzles.length, byDifficulty }
}

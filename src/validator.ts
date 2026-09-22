import { CANONICAL_VERSION, ENCODING_VERSION, canonicalPuzzleKey } from './canonical'
import { applyMove, calculatePour, isSolved } from './rules'
import { analyzeSolutionPath } from './solver'
import type { AuditCatalog } from './types'
import { GENERATOR_VERSION, RNG_VERSION } from './version'

export interface ValidationSummary {
  valid: true
  puzzles: number
  byDifficulty: Record<string, number>
}

export function validateAuditCatalog(catalog: AuditCatalog): ValidationSummary {
  if (catalog.version !== 'audit-v2') throw new Error(`Unsupported audit version: ${catalog.version}`)
  if (catalog.reproducibility.generatorVersion !== GENERATOR_VERSION) {
    throw new Error('Generator version mismatch')
  }
  if (catalog.reproducibility.rngVersion !== RNG_VERSION) throw new Error('RNG version mismatch')
  if (catalog.reproducibility.canonicalVersion !== CANONICAL_VERSION) {
    throw new Error('Canonical version mismatch')
  }
  if (catalog.reproducibility.encodingVersion !== ENCODING_VERSION) {
    throw new Error('Encoding version mismatch')
  }

  const ids = new Set<string>()
  const canonicalKeys = new Set<string>()
  const byDifficulty: Record<string, number> = {}

  for (const puzzle of catalog.puzzles) {
    if (ids.has(puzzle.id)) throw new Error(`Duplicate puzzle id: ${puzzle.id}`)
    ids.add(puzzle.id)

    if (!Number.isInteger(puzzle.candidateIndex) || puzzle.candidateIndex < 0) {
      throw new Error(`Invalid candidate index: ${puzzle.id}`)
    }
    if (!puzzle.candidateSeed) throw new Error(`Missing candidate seed: ${puzzle.id}`)

    if (canonicalKeys.has(puzzle.canonicalKey)) throw new Error(`Canonical duplicate: ${puzzle.id}`)
    canonicalKeys.add(puzzle.canonicalKey)

    if (canonicalPuzzleKey(puzzle.board) !== puzzle.canonicalKey) {
      throw new Error(`Invalid canonical key: ${puzzle.id}`)
    }
    if (isSolved(puzzle.board, puzzle.capacity)) throw new Error(`Starts solved: ${puzzle.id}`)
    if (puzzle.emptyTubes !== puzzle.minimumRequiredEmptyTubes) {
      throw new Error(`Minimum empty tube mismatch: ${puzzle.id}`)
    }
    if (puzzle.board.filter((tube) => tube.length === 0).length !== puzzle.emptyTubes) {
      throw new Error(`Empty tube mismatch: ${puzzle.id}`)
    }
    if (!puzzle.board.every((tube) => tube.length === 0 || tube.length === puzzle.capacity)) {
      throw new Error(`Non-classic occupancy: ${puzzle.id}`)
    }

    if (puzzle.emptyTubeAnalysis.length !== puzzle.minimumRequiredEmptyTubes) {
      throw new Error(`Incomplete minimum-empty proof: ${puzzle.id}`)
    }
    for (let index = 0; index < puzzle.emptyTubeAnalysis.length; index += 1) {
      const analysis = puzzle.emptyTubeAnalysis[index]
      const expectedEmptyTubes = index + 1
      if (analysis.emptyTubes !== expectedEmptyTubes) {
        throw new Error(`Non-sequential empty-tube proof: ${puzzle.id}`)
      }
      const isMinimum = expectedEmptyTubes === puzzle.minimumRequiredEmptyTubes
      if (isMinimum && analysis.status !== 'solved') {
        throw new Error(`Minimum empty-tube result must be solved: ${puzzle.id}`)
      }
      if (!isMinimum && analysis.status !== 'unsolvable') {
        throw new Error(`Smaller empty-tube count must be proven unsolvable: ${puzzle.id}`)
      }
    }

    const colorCounts = new Map<number, number>()
    for (const color of puzzle.board.flat()) colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1)
    if ([...colorCounts.values()].some((count) => count !== puzzle.capacity)) {
      throw new Error(`Color conservation failure: ${puzzle.id}`)
    }

    let board = puzzle.board.map((tube) => [...tube])
    for (const expectedMove of puzzle.optimalSolution) {
      const move = calculatePour(board, expectedMove.from, expectedMove.to, puzzle.capacity)
      if (JSON.stringify(move) !== JSON.stringify(expectedMove)) {
        throw new Error(`Invalid saved move: ${puzzle.id}`)
      }
      board = applyMove(board, expectedMove)
    }

    if (!isSolved(board, puzzle.capacity)) throw new Error(`Solution does not finish: ${puzzle.id}`)
    if (puzzle.optimalSolution.length !== puzzle.solver.optimalMoves) {
      throw new Error(`Solution length mismatch: ${puzzle.id}`)
    }
    if (JSON.stringify(analyzeSolutionPath(puzzle.board, puzzle.optimalSolution, puzzle.capacity))
      !== JSON.stringify(puzzle.optimalSolutionPath)) {
      throw new Error(`Solution path metrics mismatch: ${puzzle.id}`)
    }

    byDifficulty[puzzle.difficulty] = (byDifficulty[puzzle.difficulty] ?? 0) + 1
  }

  return { valid: true, puzzles: catalog.puzzles.length, byDifficulty }
}

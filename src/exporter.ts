import type { AuditCatalog, RuntimeLevelPack } from './types'

export function exportRuntimePack(catalog: AuditCatalog, packId: string): RuntimeLevelPack {
  if (!packId.trim()) throw new Error('packId must not be empty')

  return {
    formatVersion: 1,
    rulesVersion: 'classic-v1',
    packId,
    generatedBy: 'water-sort-level-generator',
    levels: catalog.puzzles.map((puzzle) => ({
      id: puzzle.id,
      difficulty: puzzle.difficulty,
      capacity: puzzle.capacity,
      board: puzzle.board.map((tube) => [...tube]),
      metadata: {
        optimalMoves: puzzle.solver.minimumMoves,
      },
    })),
  }
}

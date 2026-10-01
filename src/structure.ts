import { canonicalStateKey } from './canonical'
import { applyMove, calculatePour } from './rules'
import type { Board, StructureDescriptors } from './types'

function runCount(tube: readonly number[]): number {
  if (tube.length === 0) return 0
  let runs = 1
  for (let index = 1; index < tube.length; index += 1) {
    if (tube[index] !== tube[index - 1]) runs += 1
  }
  return runs
}

export function analyzeStructure(
  board: Board,
  capacity = 4,
): StructureDescriptors {
  const nonEmptyTubes = board.filter((tube) => tube.length > 0)
  const totalTokens = nonEmptyTubes.reduce((sum, tube) => sum + tube.length, 0)
  const totalRuns = nonEmptyTubes.reduce((sum, tube) => sum + runCount(tube), 0)

  const allDistinctTubeCount = nonEmptyTubes.filter((tube) =>
    new Set(tube).size === tube.length,
  ).length

  const spread = new Map<number, number>()
  for (const tube of nonEmptyTubes) {
    for (const type of new Set(tube)) {
      spread.set(type, (spread.get(type) ?? 0) + 1)
    }
  }
  const spreadValues = [...spread.values()]
  const typeSpreadMean = spreadValues.length === 0
    ? 0
    : spreadValues.reduce((sum, value) => sum + value, 0) / spreadValues.length
  const typeSpreadMax = spreadValues.length === 0 ? 0 : Math.max(...spreadValues)

  const nextStates = new Set<string>()
  for (let from = 0; from < board.length; from += 1) {
    for (let to = 0; to < board.length; to += 1) {
      const move = calculatePour(board, from, to, capacity)
      if (!move) continue
      nextStates.add(canonicalStateKey(applyMove(board, move)))
    }
  }

  return {
    totalRuns,
    normalizedTotalRuns: totalTokens === 0 ? 0 : totalRuns / totalTokens,
    allDistinctTubeCount,
    typeSpreadMean,
    typeSpreadMax,
    initialDistinctNextStates: nextStates.size,
  }
}

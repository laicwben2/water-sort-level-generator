import type { Board } from './types'

function encodeTube(tube: readonly number[], colorMap?: ReadonlyMap<number, number>): string {
  return tube.map((color) => colorMap?.get(color) ?? color).join(',')
}

function encodeSortedTubes(board: Board, colorMap?: ReadonlyMap<number, number>): string {
  return board.map((tube) => encodeTube(tube, colorMap)).sort().join('|')
}

export function canonicalStateKey(board: Board): string {
  return encodeSortedTubes(board)
}

function visitPermutations<T>(values: T[], visit: (permutation: T[]) => void): void {
  function permute(start: number) {
    if (start === values.length) {
      visit(values)
      return
    }
    for (let index = start; index < values.length; index += 1) {
      ;[values[start], values[index]] = [values[index], values[start]]
      permute(start + 1)
      ;[values[start], values[index]] = [values[index], values[start]]
    }
  }
  permute(0)
}

export function canonicalPuzzleKey(board: Board): string {
  const colors = [...new Set(board.flat())].sort((a, b) => a - b)
  let best: string | undefined

  visitPermutations(colors, (permutation) => {
    const colorMap = new Map(permutation.map((color, canonicalColor) => [color, canonicalColor]))
    const candidate = encodeSortedTubes(board, colorMap)
    if (best === undefined || candidate < best) best = candidate
  })

  return best ?? encodeSortedTubes(board)
}

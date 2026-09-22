import type { Board, Move, Tube } from './types'

export const DEFAULT_CAPACITY = 4

export function topColor(tube: Tube): number | undefined {
  return tube[tube.length - 1]
}

export function topRunLength(tube: Tube): number {
  if (tube.length === 0) return 0
  const color = topColor(tube)
  let count = 0
  for (let index = tube.length - 1; index >= 0 && tube[index] === color; index -= 1) count += 1
  return count
}

export function calculatePour(board: Board, from: number, to: number, capacity = DEFAULT_CAPACITY): Move | null {
  if (from === to || from < 0 || to < 0 || from >= board.length || to >= board.length) return null
  const source = board[from]
  const target = board[to]
  if (source.length === 0 || target.length >= capacity) return null
  const color = topColor(source)!
  const targetColor = topColor(target)
  if (targetColor !== undefined && targetColor !== color) return null
  const amount = Math.min(topRunLength(source), capacity - target.length)
  return amount > 0 ? { from, to, color, amount } : null
}

export function applyMove(board: Board, move: Move): Board {
  const next = board.map((tube) => [...tube])
  const removed = next[move.from].splice(-move.amount)
  if (removed.length !== move.amount || removed.some((color) => color !== move.color)) {
    throw new Error('Move does not match board state')
  }
  next[move.to].push(...removed)
  return next
}

export function isUniform(tube: Tube): boolean {
  return tube.every((color) => color === tube[0])
}

export function isSolved(board: Board, capacity = DEFAULT_CAPACITY): boolean {
  return board.every((tube) => tube.length === 0 || (tube.length === capacity && isUniform(tube)))
}

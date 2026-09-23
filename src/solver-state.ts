import type { Board, Move } from './types'

export const SOLVER_STATE_ENCODING_VERSION = 'packed-tube20-v1' as const
export const MAX_SOLVER_TYPES = 16
export const MAX_SOLVER_CAPACITY = 4

const CELL_BITS = 5
const CELL_MASK = 0b1_1111
const TUBE_BITS = MAX_SOLVER_CAPACITY * CELL_BITS
const TUBE_MASK = (1 << TUBE_BITS) - 1

export type PackedBoard = Uint32Array

function assertCapacity(capacity: number) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_SOLVER_CAPACITY) {
    throw new Error(`packed solver supports capacity 1..${MAX_SOLVER_CAPACITY}, got ${capacity}`)
  }
}

function assertType(type: number) {
  if (!Number.isInteger(type) || type < 0 || type >= MAX_SOLVER_TYPES) {
    throw new Error(`packed solver supports type IDs 0..${MAX_SOLVER_TYPES - 1}, got ${type}`)
  }
}

function storedCell(type: number): number {
  assertType(type)
  return type + 1
}

function decodeStored(value: number): number {
  return value - 1
}

export function packTube(tube: readonly number[], capacity = MAX_SOLVER_CAPACITY): number {
  assertCapacity(capacity)
  if (tube.length > capacity) throw new Error('tube exceeds capacity')

  let code = 0
  for (let index = 0; index < tube.length; index += 1) {
    code |= storedCell(tube[index]) << (index * CELL_BITS)
  }
  return code >>> 0
}

export function unpackTube(code: number, capacity = MAX_SOLVER_CAPACITY): number[] {
  assertCapacity(capacity)
  const tube: number[] = []
  for (let index = 0; index < capacity; index += 1) {
    const stored = (code >>> (index * CELL_BITS)) & CELL_MASK
    if (stored === 0) break
    tube.push(decodeStored(stored))
  }
  return tube
}

export function packBoard(board: Board, capacity = MAX_SOLVER_CAPACITY): PackedBoard {
  assertCapacity(capacity)
  return Uint32Array.from(board, (tube) => packTube(tube, capacity))
}

export function unpackBoard(board: PackedBoard, capacity = MAX_SOLVER_CAPACITY): Board {
  return Array.from(board, (tube) => unpackTube(tube, capacity))
}

export function tubeLength(code: number, capacity = MAX_SOLVER_CAPACITY): number {
  assertCapacity(capacity)
  for (let index = capacity - 1; index >= 0; index -= 1) {
    if (((code >>> (index * CELL_BITS)) & CELL_MASK) !== 0) return index + 1
  }
  return 0
}

export function topType(code: number, capacity = MAX_SOLVER_CAPACITY): number | undefined {
  const length = tubeLength(code, capacity)
  if (length === 0) return undefined
  const stored = (code >>> ((length - 1) * CELL_BITS)) & CELL_MASK
  return decodeStored(stored)
}

export function topRunLengthPacked(code: number, capacity = MAX_SOLVER_CAPACITY): number {
  const length = tubeLength(code, capacity)
  if (length === 0) return 0
  const topStored = (code >>> ((length - 1) * CELL_BITS)) & CELL_MASK
  let count = 0
  for (let index = length - 1; index >= 0; index -= 1) {
    const stored = (code >>> (index * CELL_BITS)) & CELL_MASK
    if (stored !== topStored) break
    count += 1
  }
  return count
}

export function packedStateKey(board: PackedBoard): bigint {
  const sorted = Array.from(board).sort((a, b) => a - b)
  let key = BigInt(board.length)
  for (const tube of sorted) key = (key << BigInt(TUBE_BITS)) | BigInt(tube & TUBE_MASK)
  return key
}

export function packedIsSolved(board: PackedBoard, capacity = MAX_SOLVER_CAPACITY): boolean {
  assertCapacity(capacity)

  for (const tube of board) {
    const length = tubeLength(tube, capacity)
    if (length === 0) continue
    if (length !== capacity) return false

    const first = tube & CELL_MASK
    for (let index = 1; index < capacity; index += 1) {
      if (((tube >>> (index * CELL_BITS)) & CELL_MASK) !== first) return false
    }
  }
  return true
}

export function packedTypeCount(board: PackedBoard, capacity = MAX_SOLVER_CAPACITY): number {
  let mask = 0
  for (const tube of board) {
    const length = tubeLength(tube, capacity)
    for (let index = 0; index < length; index += 1) {
      const stored = (tube >>> (index * CELL_BITS)) & CELL_MASK
      mask |= 1 << decodeStored(stored)
    }
  }

  let count = 0
  for (let bits = mask >>> 0; bits !== 0; bits >>>= 1) count += bits & 1
  return count
}

export function packedHeuristic(
  board: PackedBoard,
  typeCount: number,
  capacity = MAX_SOLVER_CAPACITY,
): number {
  let segments = 0

  for (const tube of board) {
    const length = tubeLength(tube, capacity)
    let previous = 0
    for (let index = 0; index < length; index += 1) {
      const stored = (tube >>> (index * CELL_BITS)) & CELL_MASK
      if (index === 0 || stored !== previous) segments += 1
      previous = stored
    }
  }

  return Math.max(0, segments - typeCount)
}

export function calculatePackedPour(
  board: PackedBoard,
  from: number,
  to: number,
  capacity = MAX_SOLVER_CAPACITY,
): Move | null {
  assertCapacity(capacity)
  if (from === to || from < 0 || to < 0 || from >= board.length || to >= board.length) return null

  const source = board[from]
  const target = board[to]
  const sourceLength = tubeLength(source, capacity)
  const targetLength = tubeLength(target, capacity)
  if (sourceLength === 0 || targetLength >= capacity) return null

  const color = topType(source, capacity)!
  const targetColor = topType(target, capacity)
  if (targetColor !== undefined && targetColor !== color) return null

  const amount = Math.min(topRunLengthPacked(source, capacity), capacity - targetLength)
  return amount > 0 ? { from, to, color, amount } : null
}

export function applyPackedMove(
  board: PackedBoard,
  move: Move,
  capacity = MAX_SOLVER_CAPACITY,
): PackedBoard {
  const source = board[move.from]
  const target = board[move.to]
  const sourceLength = tubeLength(source, capacity)
  const targetLength = tubeLength(target, capacity)
  if (move.amount < 1 || move.amount > sourceLength || targetLength + move.amount > capacity) {
    throw new Error('Move exceeds packed board bounds')
  }

  const sourceTop = topType(source, capacity)
  if (sourceTop !== move.color) throw new Error('Move color does not match packed source')

  const next = new Uint32Array(board)
  const newSourceLength = sourceLength - move.amount
  const sourceMask = newSourceLength === 0
    ? 0
    : (1 << (newSourceLength * CELL_BITS)) - 1
  next[move.from] = source & sourceMask

  let nextTarget = target
  const stored = storedCell(move.color)
  for (let index = 0; index < move.amount; index += 1) {
    nextTarget |= stored << ((targetLength + index) * CELL_BITS)
  }
  next[move.to] = nextTarget >>> 0
  return next
}

export function listPackedTransitions(
  board: PackedBoard,
  capacity = MAX_SOLVER_CAPACITY,
): Array<{ move: Move; board: PackedBoard; key: bigint }> {
  assertCapacity(capacity)
  const currentKey = packedStateKey(board)
  const seenNextStates = new Set<bigint>()
  const transitions: Array<{ move: Move; board: PackedBoard; key: bigint; joinsColor: number }> = []

  for (let from = 0; from < board.length; from += 1) {
    if (tubeLength(board[from], capacity) === 0) continue
    const seenTargets = new Set<number>()

    for (let to = 0; to < board.length; to += 1) {
      const targetCode = board[to]
      if (seenTargets.has(targetCode)) continue

      const move = calculatePackedPour(board, from, to, capacity)
      if (!move) continue
      seenTargets.add(targetCode)

      const nextBoard = applyPackedMove(board, move, capacity)
      const key = packedStateKey(nextBoard)
      if (key === currentKey || seenNextStates.has(key)) continue
      seenNextStates.add(key)

      transitions.push({
        move,
        board: nextBoard,
        key,
        joinsColor: topType(targetCode, capacity) === move.color ? 1 : 0,
      })
    }
  }

  transitions.sort((first, second) =>
    second.joinsColor - first.joinsColor
    || second.move.amount - first.move.amount
    || first.move.from - second.move.from
    || first.move.to - second.move.to)

  return transitions.map(({ joinsColor: _joinsColor, ...transition }) => transition)
}

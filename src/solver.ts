import { canonicalStateKey } from './canonical'
import { applyMove, calculatePour, isSolved, topColor } from './rules'
import type { Board, Move, SolutionPathMetrics, SolverMetrics, SolverResult } from './types'

export interface SolverOptions {
  capacity?: number
  maxVisitedStates?: number
  maxDepth?: number
}

interface SearchNode {
  board: Board
  depth: number
  estimate: number
  key: string
  parentId?: number
  move?: Move
}

class MinHeap {
  private values: Array<{ nodeId: number; priority: number; depth: number }> = []

  get size() { return this.values.length }

  push(value: { nodeId: number; priority: number; depth: number }) {
    this.values.push(value)
    let index = this.values.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (!this.before(this.values[index], this.values[parent])) break
      ;[this.values[index], this.values[parent]] = [this.values[parent], this.values[index]]
      index = parent
    }
  }

  pop() {
    const first = this.values[0]
    const last = this.values.pop()
    if (!first || !last || this.values.length === 0) return first
    this.values[0] = last
    let index = 0
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      let smallest = index
      if (left < this.values.length && this.before(this.values[left], this.values[smallest])) smallest = left
      if (right < this.values.length && this.before(this.values[right], this.values[smallest])) smallest = right
      if (smallest === index) break
      ;[this.values[index], this.values[smallest]] = [this.values[smallest], this.values[index]]
      index = smallest
    }
    return first
  }

  private before(
    first: { nodeId: number; priority: number; depth: number },
    second: { nodeId: number; priority: number; depth: number },
  ) {
    return first.priority < second.priority
      || (first.priority === second.priority && first.depth > second.depth)
      || (first.priority === second.priority && first.depth === second.depth && first.nodeId < second.nodeId)
  }
}

function heuristic(board: Board): number {
  let segments = 0
  for (const tube of board) {
    for (let layer = 0; layer < tube.length; layer += 1) {
      if (layer === 0 || tube[layer] !== tube[layer - 1]) segments += 1
    }
  }
  return Math.max(0, segments - new Set(board.flat()).size)
}

export function listLegalMoves(board: Board, capacity = 4): Move[] {
  const moves: Move[] = []
  const currentKey = canonicalStateKey(board)
  const seenNextStates = new Set<string>()

  for (let from = 0; from < board.length; from += 1) {
    if (board[from].length === 0) continue
    const seenTargets = new Set<string>()
    for (let to = 0; to < board.length; to += 1) {
      const targetSignature = board[to].join(',')
      if (seenTargets.has(targetSignature)) continue
      const move = calculatePour(board, from, to, capacity)
      if (!move) continue
      seenTargets.add(targetSignature)
      const nextKey = canonicalStateKey(applyMove(board, move))
      if (nextKey === currentKey || seenNextStates.has(nextKey)) continue
      seenNextStates.add(nextKey)
      moves.push(move)
    }
  }

  return moves.sort((first, second) => {
    const firstJoinsColor = topColor(board[first.to]) === first.color ? 1 : 0
    const secondJoinsColor = topColor(board[second.to]) === second.color ? 1 : 0
    return secondJoinsColor - firstJoinsColor
      || second.amount - first.amount
      || first.from - second.from
      || first.to - second.to
  })
}

export function analyzeSolutionPath(initialBoard: Board, solution: readonly Move[], capacity = 4): SolutionPathMetrics {
  let board = initialBoard.map((tube) => [...tube])
  let decisionSteps = 0
  let forcedSteps = 0
  let totalChoices = 0
  let maximumChoices = 0

  for (const move of solution) {
    const choices = listLegalMoves(board, capacity).length
    totalChoices += choices
    maximumChoices = Math.max(maximumChoices, choices)
    if (choices <= 1) forcedSteps += 1
    else decisionSteps += 1
    board = applyMove(board, move)
  }

  return {
    decisionSteps,
    forcedSteps,
    totalAlternativeMoves: Math.max(0, totalChoices - solution.length),
    averageChoices: solution.length === 0 ? 0 : totalChoices / solution.length,
    maximumChoices,
  }
}

function metrics(exploredStates: number, visitedStates: number, generatedMoves: number, maxDepthReached: number): SolverMetrics {
  return {
    exploredStates,
    visitedStates,
    generatedMoves,
    maxDepthReached,
    averageBranching: exploredStates === 0 ? 0 : generatedMoves / exploredStates,
  }
}

function reconstructSolution(nodes: SearchNode[], solvedNodeId: number): Move[] {
  const solution: Move[] = []
  let nodeId: number | undefined = solvedNodeId
  while (nodeId !== undefined) {
    const currentNode: SearchNode = nodes[nodeId]
    if (currentNode.move) solution.push(currentNode.move)
    nodeId = currentNode.parentId
  }
  return solution.reverse()
}

export function solveBoard(board: Board, options: SolverOptions = {}): SolverResult {
  const capacity = options.capacity ?? 4
  const maxVisitedStates = options.maxVisitedStates ?? 100_000
  const maxDepth = options.maxDepth ?? 100
  const startBoard = board.map((tube) => [...tube])
  const startKey = canonicalStateKey(startBoard)
  const nodes: SearchNode[] = [{ board: startBoard, depth: 0, estimate: heuristic(startBoard), key: startKey }]
  const queue = new MinHeap()
  const bestDepth = new Map([[startKey, 0]])
  queue.push({ nodeId: 0, priority: nodes[0].estimate, depth: 0 })

  let exploredStates = 0
  let generatedMoves = 0
  let maxDepthReached = 0
  let depthCutoffReached = false

  while (queue.size > 0) {
    if (exploredStates >= maxVisitedStates) {
      return { status: 'budget-exceeded', metrics: metrics(exploredStates, bestDepth.size, generatedMoves, maxDepthReached) }
    }

    const queued = queue.pop()!
    const node = nodes[queued.nodeId]
    if (bestDepth.get(node.key) !== node.depth) continue
    exploredStates += 1
    maxDepthReached = Math.max(maxDepthReached, node.depth)

    if (isSolved(node.board, capacity)) {
      return {
        status: 'solved',
        solution: reconstructSolution(nodes, queued.nodeId),
        metrics: metrics(exploredStates, bestDepth.size, generatedMoves, maxDepthReached),
      }
    }

    if (node.depth >= maxDepth) {
      depthCutoffReached = true
      continue
    }

    const legalMoves = listLegalMoves(node.board, capacity)
    generatedMoves += legalMoves.length
    for (const move of legalMoves) {
      const nextBoard = applyMove(node.board, move)
      const nextDepth = node.depth + 1
      const key = canonicalStateKey(nextBoard)
      if ((bestDepth.get(key) ?? Number.POSITIVE_INFINITY) <= nextDepth) continue
      bestDepth.set(key, nextDepth)
      const next: SearchNode = {
        board: nextBoard,
        depth: nextDepth,
        estimate: nextDepth + heuristic(nextBoard),
        key,
        parentId: queued.nodeId,
        move,
      }
      const nodeId = nodes.push(next) - 1
      queue.push({ nodeId, priority: next.estimate, depth: nextDepth })
    }
  }

  const finalMetrics = metrics(exploredStates, bestDepth.size, generatedMoves, maxDepthReached)
  return depthCutoffReached
    ? { status: 'budget-exceeded', metrics: finalMetrics }
    : { status: 'unsolvable', metrics: finalMetrics }
}

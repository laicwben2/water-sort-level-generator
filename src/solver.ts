import {
  applyPackedMove,
  listPackedTransitions,
  packBoard,
  packedHeuristic,
  packedIsSolved,
  packedStateKey,
  packedTypeCount,
  type PackedBoard,
} from './solver-state'
import { applyMove } from './rules'
import type { Board, Move, SolutionPathMetrics, SolverMetrics, SolverResult } from './types'

export interface SolverOptions {
  capacity?: number
  maxVisitedStates?: number
  maxDepth?: number
}

interface SearchNode {
  board: PackedBoard
  depth: number
  estimate: number
  key: bigint
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

export function listLegalMoves(board: Board, capacity = 4): Move[] {
  return listPackedTransitions(packBoard(board, capacity), capacity).map(({ move }) => move)
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
  const startBoard = packBoard(board, capacity)
  const typeCount = packedTypeCount(startBoard, capacity)
  const startKey = packedStateKey(startBoard)
  const nodes: SearchNode[] = [{
    board: startBoard,
    depth: 0,
    estimate: packedHeuristic(startBoard, typeCount, capacity),
    key: startKey,
  }]
  const queue = new MinHeap()
  const bestDepth = new Map<bigint, number>([[startKey, 0]])
  queue.push({ nodeId: 0, priority: nodes[0].estimate, depth: 0 })

  let exploredStates = 0
  let generatedMoves = 0
  let maxDepthReached = 0
  let depthCutoffReached = false

  if (maxVisitedStates < 1) {
    return {
      status: 'budget-exceeded',
      metrics: metrics(0, bestDepth.size, 0, 0),
    }
  }

  while (queue.size > 0) {
    const queued = queue.pop()!
    const node = nodes[queued.nodeId]
    if (bestDepth.get(node.key) !== node.depth) continue
    exploredStates += 1
    maxDepthReached = Math.max(maxDepthReached, node.depth)

    if (packedIsSolved(node.board, capacity)) {
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

    const transitions = listPackedTransitions(node.board, capacity)
    generatedMoves += transitions.length
    for (const transition of transitions) {
      const nextDepth = node.depth + 1
      if ((bestDepth.get(transition.key) ?? Number.POSITIVE_INFINITY) <= nextDepth) continue
      if (!bestDepth.has(transition.key) && bestDepth.size >= maxVisitedStates) {
        return {
          status: 'budget-exceeded',
          metrics: metrics(exploredStates, bestDepth.size, generatedMoves, maxDepthReached),
        }
      }
      bestDepth.set(transition.key, nextDepth)
      const next: SearchNode = {
        board: transition.board,
        depth: nextDepth,
        estimate: nextDepth + packedHeuristic(transition.board, typeCount, capacity),
        key: transition.key,
        parentId: queued.nodeId,
        move: transition.move,
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

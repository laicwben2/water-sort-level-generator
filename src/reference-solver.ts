import { applyMove, calculatePour, isSolved } from './rules'
import type { Board, Move, SolverMetrics, SolverResult } from './types'

export interface ReferenceSolverOptions {
  capacity?: number
  maxVisitedStates?: number
  maxDepth?: number
}

interface ReferenceNode {
  board: Board
  depth: number
  parentId?: number
  move?: Move
}

function exactOrderedBoardKey(board: Board): string {
  // Intentionally simple and independent from production SKey/canonical code.
  // Reference BFS does not remove tube-order symmetry.
  return JSON.stringify(board)
}

function metrics(
  exploredStates: number,
  visitedStates: number,
  generatedMoves: number,
  maxDepthReached: number,
): SolverMetrics {
  return {
    exploredStates,
    visitedStates,
    generatedMoves,
    maxDepthReached,
    averageBranching: exploredStates === 0 ? 0 : generatedMoves / exploredStates,
  }
}

function reconstructSolution(nodes: ReferenceNode[], solvedNodeId: number): Move[] {
  const solution: Move[] = []
  let nodeId: number | undefined = solvedNodeId

  while (nodeId !== undefined) {
    const node = nodes[nodeId]
    if (node.move) solution.push(node.move)
    nodeId = node.parentId
  }

  return solution.reverse()
}

function assertNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`)
  }
}

export function solveBoardReference(
  initialBoard: Board,
  options: ReferenceSolverOptions = {},
): SolverResult {
  const capacity = options.capacity ?? 4
  const maxVisitedStates = options.maxVisitedStates ?? 100_000
  const maxDepth = options.maxDepth ?? 100
  assertNonNegativeSafeInteger(maxVisitedStates, 'maxVisitedStates')
  assertNonNegativeSafeInteger(maxDepth, 'maxDepth')

  if (maxVisitedStates < 1) {
    return {
      status: 'budget-exceeded',
      metrics: metrics(0, 0, 0, 0),
    }
  }

  const start = initialBoard.map((tube) => [...tube])
  const nodes: ReferenceNode[] = [{ board: start, depth: 0 }]
  const queue: number[] = [0]
  let queueIndex = 0
  const visited = new Set<string>([exactOrderedBoardKey(start)])

  let exploredStates = 0
  let generatedMoves = 0
  let maxDepthReached = 0
  let depthCutoffReached = false

  while (queueIndex < queue.length) {
    const nodeId = queue[queueIndex]
    queueIndex += 1
    const node = nodes[nodeId]
    exploredStates += 1
    maxDepthReached = Math.max(maxDepthReached, node.depth)

    if (isSolved(node.board, capacity)) {
      return {
        status: 'solved',
        solution: reconstructSolution(nodes, nodeId),
        metrics: metrics(exploredStates, visited.size, generatedMoves, maxDepthReached),
      }
    }

    if (node.depth >= maxDepth) {
      depthCutoffReached = true
      continue
    }

    for (let from = 0; from < node.board.length; from += 1) {
      for (let to = 0; to < node.board.length; to += 1) {
        const move = calculatePour(node.board, from, to, capacity)
        if (!move) continue
        generatedMoves += 1

        const nextBoard = applyMove(node.board, move)
        const key = exactOrderedBoardKey(nextBoard)
        if (visited.has(key)) continue
        if (visited.size >= maxVisitedStates) {
          return {
            status: 'budget-exceeded',
            metrics: metrics(exploredStates, visited.size, generatedMoves, maxDepthReached),
          }
        }

        visited.add(key)
        const nextId = nodes.push({
          board: nextBoard,
          depth: node.depth + 1,
          parentId: nodeId,
          move,
        }) - 1
        queue.push(nextId)
      }
    }
  }

  const finalMetrics = metrics(exploredStates, visited.size, generatedMoves, maxDepthReached)
  return depthCutoffReached
    ? { status: 'budget-exceeded', metrics: finalMetrics }
    : { status: 'unsolvable', metrics: finalMetrics }
}

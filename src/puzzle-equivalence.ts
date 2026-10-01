import type { Board, Tube } from './types'

function localPattern(tube: readonly number[]): string {
  const mapping = new Map<number, number>()
  return tube.map((type) => {
    let normalized = mapping.get(type)
    if (normalized === undefined) {
      normalized = mapping.size
      mapping.set(type, normalized)
    }
    return normalized
  }).join(',')
}

function typeCount(board: Board): number {
  return new Set(board.flat()).size
}

interface TubeCandidate {
  firstIndex: number
  candidateSecondIndices: number[]
}

function tryMatchTube(
  first: Tube,
  second: Tube,
  forward: Map<number, number>,
  reverse: Map<number, number>,
): Array<[number, number]> | null {
  if (first.length !== second.length) return null
  const added: Array<[number, number]> = []

  for (let index = 0; index < first.length; index += 1) {
    const firstType = first[index]
    const secondType = second[index]
    const mappedForward = forward.get(firstType)
    const mappedReverse = reverse.get(secondType)

    if (mappedForward !== undefined) {
      if (mappedForward !== secondType) return null
      continue
    }
    if (mappedReverse !== undefined) return null

    forward.set(firstType, secondType)
    reverse.set(secondType, firstType)
    added.push([firstType, secondType])
  }

  return added
}

function rollback(
  added: readonly [number, number][],
  forward: Map<number, number>,
  reverse: Map<number, number>,
): void {
  for (let index = added.length - 1; index >= 0; index -= 1) {
    const [firstType, secondType] = added[index]
    forward.delete(firstType)
    reverse.delete(secondType)
  }
}

export function arePuzzlesEquivalent(first: Board, second: Board): boolean {
  if (first.length !== second.length) return false
  if (typeCount(first) !== typeCount(second)) return false

  const secondPatterns = second.map(localPattern)
  const candidates: TubeCandidate[] = first.map((tube, firstIndex) => {
    const pattern = localPattern(tube)
    return {
      firstIndex,
      candidateSecondIndices: secondPatterns.flatMap((otherPattern, secondIndex) =>
        otherPattern === pattern && second[secondIndex].length === tube.length
          ? [secondIndex]
          : []),
    }
  })

  if (candidates.some((candidate) => candidate.candidateSecondIndices.length === 0)) {
    return false
  }

  // Most constrained tube first. This is only a search-order optimization;
  // equivalence semantics come solely from the bijection checks below.
  candidates.sort((firstCandidate, secondCandidate) =>
    firstCandidate.candidateSecondIndices.length - secondCandidate.candidateSecondIndices.length
    || second[firstCandidate.candidateSecondIndices[0]].length - second[secondCandidate.candidateSecondIndices[0]].length
    || firstCandidate.firstIndex - secondCandidate.firstIndex)

  const usedSecond = new Set<number>()
  const forward = new Map<number, number>()
  const reverse = new Map<number, number>()

  function search(depth: number): boolean {
    if (depth === candidates.length) return true
    const candidate = candidates[depth]
    const firstTube = first[candidate.firstIndex]

    for (const secondIndex of candidate.candidateSecondIndices) {
      if (usedSecond.has(secondIndex)) continue

      const added = tryMatchTube(firstTube, second[secondIndex], forward, reverse)
      if (added === null) continue

      usedSecond.add(secondIndex)
      if (search(depth + 1)) return true
      usedSecond.delete(secondIndex)
      rollback(added, forward, reverse)
    }

    return false
  }

  return search(0)
}

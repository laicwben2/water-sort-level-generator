import type { AuditPuzzle, SourceBucket, StructureDescriptors } from './types'

export const STRUCTURE_DESCRIPTOR_NAMES = [
  'totalRuns',
  'normalizedTotalRuns',
  'allDistinctTubeCount',
  'typeSpreadMean',
  'typeSpreadMax',
  'topDistinctTypeCount',
  'initialDistinctNextStates',
] as const

export type StructureDescriptorName = typeof STRUCTURE_DESCRIPTOR_NAMES[number]

export interface NumericDistributionSummary {
  count: number
  min: number
  mean: number
  p50: number
  p90: number
  max: number
}

export interface StructurePopulationGroup {
  count: number
  descriptors: Record<StructureDescriptorName, NumericDistributionSummary>
  correlations: Record<StructureDescriptorName, Record<StructureDescriptorName, number | null>>
}

export interface StructurePopulationSummary {
  overall: StructurePopulationGroup
  bySourceBucket: Partial<Record<SourceBucket, StructurePopulationGroup>>
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0
  const rank = Math.max(0, Math.ceil(fraction * sorted.length) - 1)
  return sorted[rank]
}

function summarizeValues(values: readonly number[]): NumericDistributionSummary {
  if (values.length === 0) {
    return { count: 0, min: 0, mean: 0, p50: 0, p90: 0, max: 0 }
  }
  const sorted = [...values].sort((first, second) => first - second)
  return {
    count: values.length,
    min: sorted[0],
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    max: sorted[sorted.length - 1],
  }
}

function correlation(first: readonly number[], second: readonly number[]): number | null {
  if (first.length !== second.length || first.length < 2) return null
  const firstMean = first.reduce((sum, value) => sum + value, 0) / first.length
  const secondMean = second.reduce((sum, value) => sum + value, 0) / second.length

  let covariance = 0
  let firstSquares = 0
  let secondSquares = 0
  for (let index = 0; index < first.length; index += 1) {
    const firstDelta = first[index] - firstMean
    const secondDelta = second[index] - secondMean
    covariance += firstDelta * secondDelta
    firstSquares += firstDelta * firstDelta
    secondSquares += secondDelta * secondDelta
  }

  if (firstSquares === 0 || secondSquares === 0) return null
  return covariance / Math.sqrt(firstSquares * secondSquares)
}

export function summarizeStructureDescriptors(structures: readonly StructureDescriptors[]): StructurePopulationGroup {
  const values = Object.fromEntries(
    STRUCTURE_DESCRIPTOR_NAMES.map((name) => [name, structures.map((structure) => structure[name])]),
  ) as Record<StructureDescriptorName, number[]>

  const descriptors = Object.fromEntries(
    STRUCTURE_DESCRIPTOR_NAMES.map((name) => [name, summarizeValues(values[name])]),
  ) as Record<StructureDescriptorName, NumericDistributionSummary>

  const correlations = Object.fromEntries(
    STRUCTURE_DESCRIPTOR_NAMES.map((first) => [
      first,
      Object.fromEntries(
        STRUCTURE_DESCRIPTOR_NAMES.map((second) => [
          second,
          first === second && values[first].length > 0
            ? 1
            : correlation(values[first], values[second]),
        ]),
      ),
    ]),
  ) as Record<StructureDescriptorName, Record<StructureDescriptorName, number | null>>

  return {
    count: structures.length,
    descriptors,
    correlations,
  }
}

export function summarizeStructurePopulation(
  puzzles: readonly AuditPuzzle[],
): StructurePopulationSummary {
  const withStructure = puzzles.filter(
    (puzzle): puzzle is AuditPuzzle & { structure: StructureDescriptors } => puzzle.structure !== undefined,
  )

  const byBucket = new Map<SourceBucket, StructureDescriptors[]>()
  for (const puzzle of withStructure) {
    const sourceBucket = puzzle.sourceBucket ?? puzzle.difficulty
    const bucket = byBucket.get(sourceBucket) ?? []
    bucket.push(puzzle.structure)
    byBucket.set(sourceBucket, bucket)
  }

  return {
    overall: summarizeStructureDescriptors(withStructure.map((puzzle) => puzzle.structure)),
    bySourceBucket: Object.fromEntries(
      [...byBucket.entries()].map(([bucket, structures]) => [bucket, summarizeStructureDescriptors(structures)]),
    ),
  }
}

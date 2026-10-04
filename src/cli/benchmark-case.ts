import { performance } from 'node:perf_hooks'
import { generateBalancedFullTubes } from '../candidate'
import { findMinimumEmptyTubes } from '../generator'
import { deriveCandidateSeed } from '../rng'
import { parseCliOptions, positiveIntArg, stringArg } from './args'
import {safeIntArg} from './local'

parseCliOptions(['types','candidate-index','capacity','max-empty','max-states','max-depth','seed'],'Single benchmark case: --types=N --candidate-index=N [--capacity=N --max-empty=N --max-states=N --max-depth=N --seed=SEED]')

const types = positiveIntArg('types', 6)
const candidateIndex = safeIntArg('candidate-index',0)
const capacity = positiveIntArg('capacity', 4)
const maxEmptyTubes = positiveIntArg('max-empty', 5)
const maxVisitedStates = positiveIntArg('max-states', 100_000)
const maxDepth = positiveIntArg('max-depth', 160)
const batchSeed = stringArg('seed', 'water-sort:benchmark:v0.2')!

const candidateSeed = deriveCandidateSeed(batchSeed, 'benchmark', `types-${types}`, candidateIndex)
const fullTubes = generateBalancedFullTubes(types, capacity, candidateSeed)

const startedAt = performance.now()
const result = findMinimumEmptyTubes(fullTubes, {
  capacity,
  maxEmptyTubes,
  maxDepth,
  maxVisitedStates,
})
const elapsedMs = performance.now() - startedAt
const usage = process.resourceUsage()
const memory = process.memoryUsage()

const exploredStates = result.analyses.reduce((sum, analysis) => sum + analysis.metrics.exploredStates, 0)
const generatedMoves = result.analyses.reduce((sum, analysis) => sum + analysis.metrics.generatedMoves, 0)
const peakVisitedStates = result.analyses.reduce(
  (maximum, analysis) => Math.max(maximum, analysis.metrics.visitedStates),
  0,
)

console.log(JSON.stringify({
  types,
  candidateIndex,
  candidateSeed,
  capacity,
  maxEmptyTubes,
  maxVisitedStates,
  maxDepth,
  status: result.status,
  ...(result.status === 'exact'
    ? {
        minimumRequiredEmptyTubes: result.minimumRequiredEmptyTubes,
        optimalMoves: result.result.solution.length,
      }
    : { reason: result.reason }),
  elapsedMs,
  maxRssMb: usage.maxRSS / 1024,
  rssEndMb: memory.rss / 1024 / 1024,
  heapUsedEndMb: memory.heapUsed / 1024 / 1024,
  exploredStates,
  peakVisitedStates,
  generatedMoves,
  analyses: result.analyses,
}))

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { generateResearchPool } from '../research'
import { positiveIntArg, stringArg } from './args'

const types = positiveIntArg('types', 7)
const count = positiveIntArg('count', 100)
const maxAttempts = positiveIntArg('max-attempts', 5_000)
const capacity = positiveIntArg('capacity', 4)
const maxEmptyTubes = positiveIntArg('max-empty', 5)
const maxVisitedStates = positiveIntArg('max-states', 100_000)
const maxDepth = positiveIntArg('max-depth', 160)
const mistakeMaxVisitedStates = positiveIntArg('mistake-max-states', 50_000)
const mistakeMaxDepthExtra = positiveIntArg('mistake-depth-extra', 40)
const batchSeed = stringArg('seed', `water-sort:research:types-${types}:v0.2`)!
const outputPath = resolve(stringArg('output', `data/research/types-${types}-v0.2.json`)!)

const pool = generateResearchPool({
  types,
  count,
  maxAttempts,
  capacity,
  maxEmptyTubes,
  maxVisitedStates,
  maxDepth,
  mistakeMaxVisitedStates,
  mistakeMaxDepthExtra,
  batchSeed,
})

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(pool, null, 2)}\n`)

console.log(JSON.stringify({
  output: outputPath,
  types: pool.types,
  puzzles: pool.puzzles.length,
  attemptsScanned: pool.attemptsScanned,
  batchSeed,
}, null, 2))

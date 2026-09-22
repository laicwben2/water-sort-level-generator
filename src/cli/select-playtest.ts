import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { selectPlaytestCases } from '../playtest'
import type { ResearchPool } from '../research'
import { validateResearchPool } from '../research'
import { stringArg } from './args'

const inputPath = resolve(stringArg('input', 'data/research/types7-v0.2.json')!)
const outputPath = resolve(stringArg('output', 'data/output/playtest-types7-v0.2.json')!)
const selectionSeed = stringArg('seed', 'water-sort-playtest-v0.2')!

const pool = JSON.parse(await readFile(inputPath, 'utf8')) as ResearchPool
validateResearchPool(pool)
const selection = selectPlaytestCases(pool, selectionSeed)

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(selection, null, 2)}\n`)

console.log(JSON.stringify({
  output: outputPath,
  types: selection.types,
  cases: selection.cases.map((entry) => ({
    order: entry.order,
    id: entry.id,
    reason: entry.reason,
  })),
}, null, 2))

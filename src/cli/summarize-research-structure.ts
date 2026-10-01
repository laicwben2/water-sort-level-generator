import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { summarizeStructureDescriptors } from '../structure-summary'
import type { ResearchCandidateCatalog } from '../types'
import { validateResearchCandidateCatalog } from '../research-validator'
import { stringArg } from './args'

const inputPath = resolve(stringArg('input') ?? 'data/audit/research-types-4.json')
const outputPath = resolve(stringArg('output') ?? 'data/output/research-structure-summary.json')
const catalog = JSON.parse(await readFile(inputPath, 'utf8')) as ResearchCandidateCatalog
validateResearchCandidateCatalog(catalog)

const summary = {
  version: 'research-structure-summary-v1',
  stratum: catalog.stratum,
  population: summarizeStructureDescriptors(catalog.puzzles.map((puzzle) => puzzle.structure)),
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify({
  input: inputPath,
  output: outputPath,
  stratum: catalog.stratum,
  puzzles: catalog.puzzles.length,
}, null, 2))

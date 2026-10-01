import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { summarizeStructurePopulation } from '../structure-summary'
import type { AuditCatalog } from '../types'
import { validateAuditCatalog } from '../validator'
import { stringArg } from './args'

const inputPath = resolve(stringArg('input') ?? 'data/audit/catalog-expanded.json')
const outputPath = resolve(stringArg('output') ?? 'data/output/structure-summary.json')

const catalog = JSON.parse(await readFile(inputPath, 'utf8')) as AuditCatalog
validateAuditCatalog(catalog)

const summary = summarizeStructurePopulation(catalog.puzzles)
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`)

console.log(JSON.stringify({
  input: inputPath,
  output: outputPath,
  puzzlesWithStructure: summary.overall.count,
}, null, 2))

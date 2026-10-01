import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ResearchCandidateCatalog } from '../types'
import { validateResearchCandidateCatalog } from '../research-validator'
import { stringArg } from './args'

const inputPath = resolve(stringArg('file') ?? 'data/audit/research-types-4.json')
const catalog = JSON.parse(await readFile(inputPath, 'utf8')) as ResearchCandidateCatalog
const summary = validateResearchCandidateCatalog(catalog)
console.log(JSON.stringify({ input: inputPath, ...summary }, null, 2))

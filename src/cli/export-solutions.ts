import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { exportSolutionArtifact } from '../exporter'
import type { AuditCatalog } from '../types'
import { validateAuditCatalog } from '../validator'
import { stringArg } from './args'

const inputPath = resolve(stringArg('input', 'data/audit/catalog-expanded.json')!)
const outputPath = resolve(stringArg('output', 'data/output/solutions-v1.json')!)

const catalog = JSON.parse(await readFile(inputPath, 'utf8')) as AuditCatalog
validateAuditCatalog(catalog)
const artifact = exportSolutionArtifact(catalog)

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
console.log(JSON.stringify({
  output: outputPath,
  solutions: artifact.solutions.length,
}, null, 2))

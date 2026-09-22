import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { exportRuntimePack } from '../exporter'
import type { AuditCatalog } from '../types'
import { validateAuditCatalog } from '../validator'
import { stringArg } from './args'

const input = stringArg('input')
if (!input) throw new Error('Usage: npm run export:runtime -- --input=data/audit/catalog.json --pack-id=production-v1')

const output = resolve(stringArg('output', 'data/output/levels-v1.json')!)
const packId = stringArg('pack-id', 'development-v1')!
const catalog = JSON.parse(await readFile(resolve(input), 'utf8')) as AuditCatalog
validateAuditCatalog(catalog)

const pack = exportRuntimePack(catalog, packId)
await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(pack, null, 2)}\n`)
console.log(JSON.stringify({ output, packId, levels: pack.levels.length }, null, 2))

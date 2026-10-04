import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { AuditCatalog } from '../types'
import { validateAuditCatalog } from '../validator'
import { stringArg } from './args'
import { SHARD_FORMAT, validateLocalShard } from '../shard'

const input = stringArg('file')
if (!input) throw new Error('Usage: npm run validate -- --file=data/audit/catalog.json')

const path = resolve(input)
const catalog: unknown = JSON.parse(await readFile(path, 'utf8'))
if ((catalog as unknown as { formatVersion?: string }).formatVersion === SHARD_FORMAT) {
  validateLocalShard(catalog)
  console.log(JSON.stringify({ file: path, valid: true, candidatesProcessed: catalog.candidatesProcessed, summary: catalog.summary }, null, 2))
} else console.log(JSON.stringify({ file: path, ...validateAuditCatalog(catalog as AuditCatalog) }, null, 2))

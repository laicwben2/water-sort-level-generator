import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { AuditCatalog } from '../types'
import { validateAuditCatalog } from '../validator'
import { parseCliOptions, stringArg } from './args'
import { SHARD_FORMAT, validateLocalShard } from '../shard'
import { validateResearchArtifact } from '../research'

parseCliOptions(['file', 'source'], 'Validate: --file=ARTIFACT [--source=SOURCE_SHARD for research identity checks]')
const input = stringArg('file')
if (!input) throw new Error('Usage: npm run validate -- --file=data/audit/catalog.json')

const path = resolve(input)
const catalog: unknown = JSON.parse(await readFile(path, 'utf8'))
if (!catalog || typeof catalog !== 'object') throw new Error('Malformed artifact')
const format = (catalog as { formatVersion?: string }).formatVersion
if (format === 'local-research-v1' || format === 'local-research-v2') {
  const sourcePath = stringArg('source')
  const source: unknown = sourcePath ? JSON.parse(await readFile(resolve(sourcePath), 'utf8')) : undefined
  if (source !== undefined) validateLocalShard(source)
  validateResearchArtifact(catalog, source)
  console.log(JSON.stringify({file:path, valid:true, sourceVerified:source !== undefined, records:catalog.records.length}))
} else if (format === SHARD_FORMAT) {
  validateLocalShard(catalog)
  console.log(JSON.stringify({ file: path, valid: true, candidatesProcessed: catalog.candidatesProcessed, summary: catalog.summary }, null, 2))
} else console.log(JSON.stringify({ file: path, ...validateAuditCatalog(catalog as AuditCatalog) }, null, 2))

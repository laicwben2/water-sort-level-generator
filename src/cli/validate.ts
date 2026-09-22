import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { AuditCatalog } from '../types'
import { validateAuditCatalog } from '../validator'
import { stringArg } from './args'

const input = stringArg('file')
if (!input) throw new Error('Usage: npm run validate -- --file=data/audit/catalog.json')

const path = resolve(input)
const catalog = JSON.parse(await readFile(path, 'utf8')) as AuditCatalog
console.log(JSON.stringify({ file: path, ...validateAuditCatalog(catalog) }, null, 2))

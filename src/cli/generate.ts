import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { generateAuditCatalog } from '../generator'
import { PROFILE_SETS, type ProfileName } from '../profiles'
import { validateAuditCatalog } from '../validator'
import { positiveIntArg, stringArg } from './args'

const profileName = (stringArg('profile', 'expanded') ?? 'expanded') as ProfileName
if (!(profileName in PROFILE_SETS)) throw new Error('--profile must be baseline or expanded')

const perDifficulty = positiveIntArg('count', 10)
const maxAttempts = positiveIntArg('max-attempts', 2_000)
const outputPath = resolve(stringArg('output', `data/audit/catalog-${profileName}.json`)!)

const catalog = generateAuditCatalog({ profileName, perDifficulty, maxAttempts })
const summary = validateAuditCatalog(catalog)

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`)
console.log(JSON.stringify({ output: outputPath, profile: profileName, ...summary }, null, 2))

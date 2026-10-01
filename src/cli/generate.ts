import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { generateAuditCatalog } from '../generator'
import { PROFILE_SETS, type ProfileName } from '../profiles'
import type { GenerationAcceptanceMode } from '../types'
import { validateAuditCatalog } from '../validator'
import { booleanArg, positiveIntArg, stringArg } from './args'

const profileName = (stringArg('profile', 'expanded') ?? 'expanded') as ProfileName
if (!Object.hasOwn(PROFILE_SETS, profileName)) throw new Error('--profile must be baseline or expanded')

const perDifficulty = positiveIntArg('count', 10)
const maxAttempts = positiveIntArg('max-attempts', 2_000)
const outputPath = resolve(stringArg('output', `data/audit/catalog-${profileName}.json`)!)
const batchSeed = stringArg('seed', 'water-sort:generator:v0.2:default')!
const analyzeMistakes = booleanArg('analyze-mistakes', false)
const acceptanceMode = (stringArg('acceptance', 'legacy-difficulty-window')
  ?? 'legacy-difficulty-window') as GenerationAcceptanceMode
if (!['legacy-difficulty-window', 'technical-validity'].includes(acceptanceMode)) {
  throw new Error('--acceptance must be legacy-difficulty-window or technical-validity')
}
const mistakeMaxVisitedStatesPerAlternative = positiveIntArg('mistake-max-states', 20_000)
const mistakeMaxDepthPerAlternative = positiveIntArg('mistake-max-depth', 120)
const mistakeMaxPathStatesRaw = stringArg('mistake-max-path-states')
const mistakeMaxPathStates = mistakeMaxPathStatesRaw === undefined
  ? undefined
  : positiveIntArg('mistake-max-path-states', 1)

const catalog = generateAuditCatalog({
  profileName,
  perDifficulty,
  maxAttempts,
  batchSeed,
  analyzeMistakes,
  acceptanceMode,
  mistakeMaxVisitedStatesPerAlternative,
  mistakeMaxDepthPerAlternative,
  ...(mistakeMaxPathStates === undefined ? {} : { mistakeMaxPathStates }),
})
const summary = validateAuditCatalog(catalog)

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`)
console.log(JSON.stringify({ output: outputPath, profile: profileName, batchSeed, acceptanceMode, analyzeMistakes, ...summary }, null, 2))

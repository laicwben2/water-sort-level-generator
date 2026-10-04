import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { generateAuditCatalog } from '../generator'
import { PROFILE_SETS, type ProfileName } from '../profiles'
import { validateAuditCatalog } from '../validator'
import { parseCliOptions, positiveIntArg, stringArg } from './args'
import { assertNewOutput, localConfigArgs, runLocalGeneration, safeIntArg } from './local'

const rangeOptions = ['seed', 'start-index', 'end-index', 'output', 'colors', 'capacity', 'max-empty', 'max-depth', 'max-states', 'analysis-max-states', 'analysis-max-depth', 'analysis-max-steps', 'analysis-max-alternatives', 'severe-penalty']
const legacyOptions = ['seed', 'profile', 'count', 'max-attempts', 'output', 'overwrite']
parseCliOptions([...rangeOptions, ...legacyOptions], 'Generate local candidates: --seed=SEED --start-index=N --end-index=N --output=FILE [--colors=5,6,7]. End inclusive. Legacy: --profile=baseline|expanded --count=N (per difficulty) --max-attempts=N --output=FILE [--overwrite=true]. Existing outputs are protected by default.')

if (process.argv.slice(2).some(arg => /^--(start|end)-index(?:=|$)/.test(arg))) {
  const allowed = new Set(rangeOptions)
  const seen = new Set<string>()
  for (const arg of process.argv.slice(2)) {
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (!match || !allowed.has(match[1]) || seen.has(match[1])) throw new Error(`Unsupported, malformed or repeated range option: ${arg}`)
    seen.add(match[1])
  }
  await runLocalGeneration({
    startIndex: safeIntArg('start-index'), endIndex: safeIntArg('end-index'),
    batchSeed: stringArg('seed', 'water-sort:local-v1:default')!,
    output: stringArg('output', 'output/shard.json')!, config: localConfigArgs(),
  })
} else {
  for (const arg of process.argv.slice(2)) if (!legacyOptions.includes(arg.slice(2).split('=')[0])) throw new Error(`Range option requires --start-index and --end-index: ${arg}`)
  const profileName = (stringArg('profile', 'expanded') ?? 'expanded') as ProfileName
  if (!(profileName in PROFILE_SETS)) throw new Error('--profile must be baseline or expanded')

  const perDifficulty = positiveIntArg('count', 10)
  const maxAttempts = positiveIntArg('max-attempts', 2_000)
  const outputPath = resolve(stringArg('output', `data/audit/catalog-${profileName}.json`)!)
  const batchSeed = stringArg('seed', 'water-sort:generator:v0.2:default')!
  const overwrite = stringArg('overwrite')
  if (overwrite !== undefined && overwrite !== 'true') throw new Error('--overwrite only accepts true')
  if (!overwrite) await assertNewOutput(outputPath)

  const catalog = generateAuditCatalog({ profileName, perDifficulty, maxAttempts, batchSeed })
  const summary = validateAuditCatalog(catalog)

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, { flag: overwrite ? 'w' : 'wx' })
  console.log(JSON.stringify({ output: outputPath, profile: profileName, batchSeed, ...summary }, null, 2))
}

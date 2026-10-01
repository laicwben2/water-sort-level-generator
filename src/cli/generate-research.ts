import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { summarizeResearchGenerationAttempts, type ResearchGenerationAttemptRecord } from '../research-ledger'
import { generateResearchCandidateCatalog } from '../research-generator'
import { validateResearchCandidateCatalog } from '../research-validator'
import { positiveIntArg, stringArg } from './args'

const typeCount = positiveIntArg('types', 4)
const acceptedCount = positiveIntArg('count', 100)
const maxAttempts = positiveIntArg('max-attempts', Math.max(acceptedCount * 10, 1000))
const capacity = positiveIntArg('capacity', 4)
const batchSeed = stringArg('seed', `water-sort:research:v0.3:types-${typeCount}:default`)!
const outputPath = resolve(stringArg('output', `data/audit/research-types-${typeCount}.json`)!)
const yieldOutputRaw = stringArg('yield-output')
const yieldOutputPath = yieldOutputRaw === undefined ? undefined : resolve(yieldOutputRaw)

const records: ResearchGenerationAttemptRecord[] = []
const catalog = generateResearchCandidateCatalog({
  typeCount,
  acceptedCount,
  maxAttempts,
  capacity,
  batchSeed,
  ...(yieldOutputPath === undefined
    ? {}
    : { onAttempt: (record: ResearchGenerationAttemptRecord) => records.push(record) }),
})
const summary = validateResearchCandidateCatalog(catalog)

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`)

if (yieldOutputPath !== undefined) {
  await mkdir(dirname(yieldOutputPath), { recursive: true })
  await writeFile(
    yieldOutputPath,
    `${JSON.stringify(summarizeResearchGenerationAttempts(records), null, 2)}\n`,
  )
}

console.log(JSON.stringify({
  output: outputPath,
  ...(yieldOutputPath === undefined ? {} : { yieldOutput: yieldOutputPath }),
  batchSeed,
  ...summary,
}, null, 2))

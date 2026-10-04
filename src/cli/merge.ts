import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { mergeLocalShards, serialize } from '../shard'
import { parseCliOptions, stringArg } from './args'
import { assertNewOutput, requireLocalRuntime, writeArtifact } from './local'

const paths = parseCliOptions(['output'], 'Merge: shard-a.json shard-b.json --output=merged.json. Overlaps and incompatible inputs are rejected.', true)
requireLocalRuntime()
if (!paths.length) throw new Error('Usage: npm run merge -- shard-a.json shard-b.json --output=merged.json')
const output = resolve(stringArg('output', 'output/merged.json')!)
await assertNewOutput(output)
const inputs = await Promise.all(paths.map(async path => JSON.parse(await readFile(resolve(path), 'utf8')) as unknown))
const merged = mergeLocalShards(inputs)
await writeArtifact(output, merged)
console.log(serialize({ output, ranges: merged.ranges, candidatesProcessed: merged.candidatesProcessed, summary: merged.summary, digest: merged.digest }))

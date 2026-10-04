import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { mergeLocalShards, serialize } from '../shard'
import { stringArg } from './args'
import { assertNewOutput, requireLocalRuntime, writeArtifact } from './local'

requireLocalRuntime()
const paths = process.argv.slice(2).filter(arg => !arg.startsWith('--'))
const unknownFlags = process.argv.slice(2).filter(arg => arg.startsWith('--') && !arg.startsWith('--output='))
if (unknownFlags.length) throw new Error(`Unsupported merge option: ${unknownFlags[0]}`)
if (!paths.length) throw new Error('Usage: npm run merge -- shard-a.json shard-b.json --output=merged.json')
const output = resolve(stringArg('output', 'output/merged.json')!)
await assertNewOutput(output)
const inputs = await Promise.all(paths.map(async path => JSON.parse(await readFile(resolve(path), 'utf8')) as unknown))
const merged = mergeLocalShards(inputs)
await writeArtifact(output, merged)
console.log(serialize({ output, ranges: merged.ranges, candidatesProcessed: merged.candidatesProcessed, summary: merged.summary, digest: merged.digest }))

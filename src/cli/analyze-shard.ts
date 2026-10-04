import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { analyzeLocalPuzzle, digest, serialize, validateLocalShard } from '../shard'
import { stringArg } from './args'
import { assertNewOutput, localConfigArgs, requireLocalRuntime, writeArtifact } from './local'

requireLocalRuntime()
const input = stringArg('input')
if (!input) throw new Error('Usage: npm run analyze:shard -- --input=shard.json --output=research.json [--analysis-max-states=25000]')
const output = resolve(stringArg('output', 'output/research.json')!)
await assertNewOutput(output)
const shard: unknown = JSON.parse(await readFile(input, 'utf8'))
validateLocalShard(shard)
const config = localConfigArgs().mistakeAnalysis
const records = shard.acceptedPuzzles.map(puzzle => ({ candidateIndex: puzzle.candidateIndex, canonicalKey: puzzle.canonicalKey, research: analyzeLocalPuzzle(puzzle, config) }))
const payload = { formatVersion: 'local-research-v1', sourceShardDigest: shard.digest, config, records }
await writeArtifact(output, { ...payload, digest: digest(payload) })
console.log(serialize({ output, puzzles: records.length }))

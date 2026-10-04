import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { analyzeLocalPuzzle, digest, serialize, validateLocalShard } from '../shard'
import { parseCliOptions, stringArg } from './args'
import { assertNewOutput, localConfigArgs, requireLocalRuntime, writeArtifact } from './local'

parseCliOptions(['input', 'output', 'analysis-max-states', 'analysis-max-depth', 'analysis-max-steps', 'analysis-max-alternatives', 'severe-penalty'], 'Reanalyze stored puzzles: --input=SHARD --output=RESEARCH [--analysis-max-states=25000 --analysis-max-depth=100 --analysis-max-steps=20 --analysis-max-alternatives=6 --severe-penalty=5]. All budgets must be positive safe integers.')
requireLocalRuntime()
const input = stringArg('input')
if (!input) throw new Error('Usage: npm run analyze:shard -- --input=shard.json --output=research.json [--analysis-max-states=25000]')
const output = resolve(stringArg('output', 'output/research.json')!)
const config = localConfigArgs().mistakeAnalysis
await assertNewOutput(output)
const shard: unknown = JSON.parse(await readFile(input, 'utf8'))
validateLocalShard(shard)
const records = shard.acceptedPuzzles.map(puzzle => ({ candidateIndex: puzzle.candidateIndex, canonicalKey: puzzle.canonicalKey, research: analyzeLocalPuzzle(puzzle, config) }))
const payload = { formatVersion: 'local-research-v1', sourceShardDigest: shard.digest, config, records }
await writeArtifact(output, { ...payload, digest: digest(payload) })
console.log(serialize({ output, puzzles: records.length }))

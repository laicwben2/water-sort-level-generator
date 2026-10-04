import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { serialize, validateLocalShard, validateRange } from '../shard'
import { parseCliOptions, stringArg } from './args'
import { localConfigArgs, requireLocalRuntime, safeIntArg } from './local'
import { reanalyzeSelected } from '../reanalysis'

parseCliOptions(['input', 'output', 'analysis-max-states', 'analysis-max-depth', 'analysis-max-steps', 'analysis-max-alternatives', 'severe-penalty', 'start-index','end-index','only-incomplete','resume'], 'Reanalyze stored puzzles: --input=SHARD --output=RESEARCH [--start-index=N --end-index=N --only-incomplete=true --resume=true] [--analysis-max-states=25000 --analysis-max-depth=100 --analysis-max-steps=20 --analysis-max-alternatives=6 --severe-penalty=5]. All budgets must be positive safe integers. Checkpoints are bound to source, config and selection.')
requireLocalRuntime()
const input = stringArg('input')
if (!input) throw new Error('Usage: npm run analyze:shard -- --input=shard.json --output=research.json [--analysis-max-states=25000]')
const output = resolve(stringArg('output', 'output/research.json')!)
const config = localConfigArgs().mistakeAnalysis
const hasRange = stringArg('start-index') !== undefined || stringArg('end-index') !== undefined
const startIndex = hasRange ? safeIntArg('start-index') : undefined, endIndex = hasRange ? safeIntArg('end-index') : undefined
if (hasRange) validateRange(startIndex!,endIndex!)
for (const name of ['only-incomplete','resume']) if (stringArg(name) !== undefined && stringArg(name) !== 'true') throw new Error(`--${name} only accepts true`)
const shard: unknown = JSON.parse(await readFile(input, 'utf8'))
validateLocalShard(shard)
const result = await reanalyzeSelected(shard,config,{output,startIndex,endIndex,onlyIncomplete:stringArg('only-incomplete')==='true',resume:stringArg('resume')==='true',onProgress(done,total,index,reused){process.stderr.write(`Research ${done}/${total}: candidate ${index}${reused ? ' (checkpoint)' : ''}\n`)}})
console.log(serialize({ output, puzzles: result.records.length, selection:result.selection }))

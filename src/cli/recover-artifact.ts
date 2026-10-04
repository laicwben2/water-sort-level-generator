import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { parseCliOptions, stringArg } from './args'
import { recoverPair, verifyPair } from '../artifact-store'
import { validateLocalShard } from '../shard'
parseCliOptions(['file'], 'Recover an interrupted publication: --file=SHARD.json. No solver is run and existing mismatched files are never overwritten.')
const file = stringArg('file')
if (!file) throw new Error('--file is required')
await recoverPair(resolve(file))
await verifyPair(resolve(file))
validateLocalShard(JSON.parse(await readFile(file,'utf8')))
console.log(JSON.stringify({file, recovered:true}))

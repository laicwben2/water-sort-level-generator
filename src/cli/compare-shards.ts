import { readFile } from 'node:fs/promises'
import { compareLocalShards, serialize } from '../shard'
import { requireLocalRuntime } from './local'

requireLocalRuntime()
const paths = process.argv.slice(2)
if (paths.length !== 2) throw new Error('Usage: npm run compare:shards -- first.json second.json')
const [first, second] = await Promise.all(paths.map(async path => JSON.parse(await readFile(path, 'utf8')) as unknown))
console.log(serialize(compareLocalShards(first, second)))

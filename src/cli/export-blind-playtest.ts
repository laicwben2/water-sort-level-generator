import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { exportBlindPlaytestPack, type PlaytestSelection } from '../playtest'
import { stringArg } from './args'

const inputPath = resolve(stringArg('input', 'data/output/playtest-types7-v0.2.json')!)
const outputPath = resolve(stringArg('output', 'data/output/playtest-types7-v0.2-blind.json')!)
const playtestId = stringArg('playtest-id', 'types7-v0.2')!

const selection = JSON.parse(await readFile(inputPath, 'utf8')) as PlaytestSelection
const pack = exportBlindPlaytestPack(selection, playtestId)

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(pack, null, 2)}\n`)

console.log(JSON.stringify({
  output: outputPath,
  playtestId: pack.playtestId,
  types: pack.types,
  levels: pack.levels.length,
}, null, 2))

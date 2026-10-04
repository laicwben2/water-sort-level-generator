import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {parseCliOptions,stringArg} from './args'
import {validateLocalShard} from '../shard'
import {validateResearchArtifact,type ResearchArtifact} from '../research'
import {coverageReport} from '../coverage'
import {writeExclusive} from '../artifact-store'
parseCliOptions(['input','comparison','output'],'Coverage report without solver calls: --input=SHARD --output=REPORT [--comparison=RESEARCH]. Grouped by colors and optimal moves.')
const input=stringArg('input'),output=stringArg('output');if(!input||!output)throw new Error('--input and --output required')
const source:unknown=JSON.parse(await readFile(input,'utf8'));validateLocalShard(source)
const c=stringArg('comparison');let comparison:ResearchArtifact|undefined
if(c){const parsed:unknown=JSON.parse(await readFile(c,'utf8'));validateResearchArtifact(parsed,source);comparison=parsed}
await writeExclusive(resolve(output),coverageReport(source,comparison))
console.log(JSON.stringify({output,solverCalls:0}))

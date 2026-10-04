import {readFile} from 'node:fs/promises'
import {resolve,dirname,relative,sep} from 'node:path'
import {parseCliOptions,stringArg} from './args'
import {appendCatalogIndex,loadCatalogIndex,type CatalogIndex} from '../catalog-index'
import {validateLocalShard,mergeLocalShards} from '../shard'
import {fileHash,writeExclusive} from '../artifact-store'
const paths=parseCliOptions(['output','input','materialize'],'Index: shard.json ... --output=INDEX.json; verify: --input=INDEX.json; materialize unchanged v1: --input=INDEX.json --materialize=CATALOG.json',true)
const input=stringArg('input'),output=stringArg('output'),materialize=stringArg('materialize')
if(input){
  if(paths.length||output)throw new Error('Do not combine --input with shard inputs/output')
  const index=await loadCatalogIndex(resolve(input))
  if(materialize){const shards=await Promise.all(index.shards.map(async s=>JSON.parse(await readFile(resolve(dirname(input),s.file),'utf8'))));await writeExclusive(resolve(materialize),mergeLocalShards(shards))}
  console.log(JSON.stringify({input,valid:true,puzzles:index.summary.accepted,materialize:materialize??null}))
}else{
  if(!paths.length||!output||materialize)throw new Error('Shard inputs and --output required')
  let index:CatalogIndex|undefined
  for(const p of paths){const s:unknown=JSON.parse(await readFile(p,'utf8'));validateLocalShard(s);index=appendCatalogIndex(index,relative(dirname(resolve(output)),resolve(p)).split(sep).join('/'),await fileHash(p),s)}
  await writeExclusive(resolve(output),index);console.log(JSON.stringify({output,puzzles:index!.summary.accepted}))
}

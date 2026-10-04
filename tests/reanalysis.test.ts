import {readFileSync} from 'node:fs'
import {mkdtemp,rm,unlink,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {describe,it,expect} from 'vitest'
import {reanalyzeSelected} from '../src/reanalysis'
import type {LocalShard} from '../src/shard'
const source=JSON.parse(readFileSync('data/pilots/mac-local-pilot-v1/candidate-000050.json','utf8')) as LocalShard
const config={...source.config.mistakeAnalysis,maxVisitedStatesPerAlternative:1,maxAnalyzedSteps:1}
describe('selected resumable research',()=>{
  it('reuses checked records after interruption and refuses mismatched requests',async()=>{
    const d=await mkdtemp(join(tmpdir(),'ws-research-'));const output=join(d,'r.json')
    try{
      const a=await reanalyzeSelected(source,config,{output,startIndex:50,endIndex:50});await unlink(output)
      const reused:boolean[]=[];const b=await reanalyzeSelected(source,config,{output,startIndex:50,endIndex:50,resume:true,onProgress(_d,_t,_i,r){reused.push(r)}})
      expect(b).toEqual(a);expect(reused).toEqual([true])
      await expect(reanalyzeSelected(source,{...config,maxDepthPerAlternative:1},{output,resume:true})).rejects.toThrow(/mismatch/)
      expect(await readFile(output,'utf8')).toContain('local-research-v2')
    }finally{await rm(d,{recursive:true,force:true})}
  })
})

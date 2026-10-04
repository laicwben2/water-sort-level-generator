import {execFileSync} from 'node:child_process'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,existsSync,chmodSync,readdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {describe,it,expect} from 'vitest'
import {generateLocalShard,DEFAULT_LOCAL_CONFIG,serialize} from '../src/shard'
const entry=resolve('src/cli/batch-local.ts'),modules=resolve('node_modules')
describe('portable local batches',()=>{
  it('dry-runs without generation, recovers a rejected push without replacing a shard',()=>{
    const d=mkdtempSync(join(tmpdir(),'ws-batch-')),repo=join(d,'repo'),remote=join(d,'remote.git');mkdirSync(repo)
    const git=(args:string[],cwd=repo)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
    const cli=(args:string[])=>execFileSync(process.execPath,['--import','tsx',entry,...args],{cwd:repo,encoding:'utf8',env:{...process.env,npm_config_user_agent:'npm/11.17.0 node/v24.19.0 darwin arm64'},stdio:['ignore','pipe','pipe'],timeout:60_000})
    try{
      git(['init','-b','main']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);git(['init','--bare',remote],d);git(['remote','add','origin',remote])
      mkdirSync(join(repo,'src'));writeFileSync(join(repo,'src','fixture.txt'),'pinned source');writeFileSync(join(repo,'package-lock.json'),'{}');writeFileSync(join(repo,'.gitignore'),'node_modules/\n**/.batch-state.json\n');symlinkSync(modules,join(repo,'node_modules'),'dir')
      const baseline=generateLocalShard({startIndex:0,endIndex:1,batchSeed:'runner-test',config:{...DEFAULT_LOCAL_CONFIG,colors:[2],capacity:2,maxEmptyTubes:2,maxDepth:20,maxVisitedStates:500,mistakeAnalysis:{maxVisitedStatesPerAlternative:50,maxDepthPerAlternative:20,maxAnalyzedSteps:2,maxAlternativesPerStep:2,severeRecoveryThreshold:2}}})
      writeFileSync(join(repo,'baseline.json'),serialize(baseline));git(['add','.']);git(['commit','-m','fixture']);git(['push','origin','main'])
      const args=['--directory=batches','--baseline=baseline.json','--start-index=2','--end-index=3','--batch-size=2','--publish=true']
      cli([...args,'--dry-run=true']);expect(existsSync(join(repo,'batches'))).toBe(false)
      const hook=join(remote,'hooks','pre-receive');writeFileSync(hook,'#!/bin/sh\nwhile read old new ref; do\ncase "$(git log -1 --format=%s "$new")" in *"batch 2-3"*) exit 1;; esac\ndone\n');chmodSync(hook,0o755)
      expect(()=>cli(args)).toThrow()
      const state=JSON.parse(readFileSync(join(repo,'batches','.batch-state.json'),'utf8'));expect(state.current.stage).toBe('committed')
      const shard=readFileSync(join(repo,'batches','shard-000002-000003.json'),'utf8');rmSync(hook)
      cli(['--directory=batches','--publish-retry=true']);cli(['--directory=batches','--resume=true'])
      expect(readFileSync(join(repo,'batches','shard-000002-000003.json'),'utf8')).toBe(shard)
      expect(readdirSync(join(repo,'batches')).filter(p=>/^shard-\d+-\d+\.json$/.test(p))).toHaveLength(1)
      expect(git(['ls-remote','origin','refs/heads/main']).split(/\s+/)[0]).toBe(git(['rev-parse','HEAD']))
    }finally{rmSync(d,{recursive:true,force:true})}
  },90_000)
})

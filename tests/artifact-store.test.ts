import {mkdtemp, readFile, writeFile, mkdir, rm, access} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {describe,it,expect} from 'vitest'
import {publishPair,recoverPair,verifyPair,fileHash,writeExclusive} from '../src/artifact-store'
describe('recoverable publication', () => {
  it('publishes a checksum-bound pair and refuses replacement', async () => {
    const d=await mkdtemp(join(tmpdir(),'ws-pair-'))
    try {const p=join(d,'s.json');await publishPair(p,{a:1},{run:1});await verifyPair(p);await expect(publishPair(p,{a:2},{run:2})).rejects.toThrow();expect(JSON.parse(await readFile(p,'utf8'))).toEqual({a:1});await expect(access(`${p}.pending.json`)).rejects.toThrow()} finally {await rm(d,{recursive:true,force:true})}
  })
  it('recovers between data and manifest without redoing computation, rejects conflicting targets',async()=>{
    const d=await mkdtemp(join(tmpdir(),'ws-pair-'))
    try {const p=join(d,'s.json'),stage=`${p}.stage-${randomUUID()}`;await mkdir(stage);await writeExclusive(`${stage}/artifact.json`,{a:1});await writeExclusive(`${stage}/manifest.json`,{run:1});await writeExclusive(`${p}.pending.json`,{formatVersion:'artifact-pair-v1',stage,artifactSHA256:await fileHash(`${stage}/artifact.json`),manifestSHA256:await fileHash(`${stage}/manifest.json`)});await writeFile(p,'conflict');await expect(recoverPair(p)).rejects.toThrow();expect(await readFile(p,'utf8')).toBe('conflict');await rm(p);await recoverPair(p);await verifyPair(p)}finally{await rm(d,{recursive:true,force:true})}
  })
})

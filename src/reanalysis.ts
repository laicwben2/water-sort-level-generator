import { access, readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { analyzeLocalPuzzle, digest, type LocalShard } from './shard'
import { validateAnalysisConfig, validateResearchArtifact, type ResearchArtifact } from './research'
import { writeExclusive } from './artifact-store'
import type { MistakeAnalysisConfig } from './types'

export async function reanalyzeSelected(source: LocalShard, config: MistakeAnalysisConfig, options: { output: string; startIndex?: number; endIndex?: number; onlyIncomplete?: boolean; resume?: boolean; onProgress?: (done: number,total: number,index: number,reused: boolean)=>void }): Promise<ResearchArtifact> {
  validateAnalysisConfig(config)
  const selected = source.acceptedPuzzles.filter(p => (options.startIndex === undefined || p.candidateIndex >= options.startIndex)
    && (options.endIndex === undefined || p.candidateIndex <= options.endIndex) && (!options.onlyIncomplete || !p.research.complete))
  const selection = {candidateIndices:selected.map(p=>p.candidateIndex)}
  const request = {sourceShardDigest:source.digest, config, selection, analysisVersion:source.reproducibility.analysisVersion}
  const checkpoint = `${options.output}.checkpoint`, meta = join(checkpoint,'request.json')
  await mkdir(checkpoint,{recursive:true})
  try {
    const saved = JSON.parse(await readFile(meta,'utf8'))
    if (!options.resume) throw new Error('Checkpoint exists; use --resume=true')
    if (!isDeepStrictEqual(saved,request)) throw new Error('Checkpoint source/config/selection mismatch')
  } catch(e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; await writeExclusive(meta,request) }
  try {
    await access(options.output)
    if (!options.resume) throw new Error('Output exists')
    const completed: unknown = JSON.parse(await readFile(options.output,'utf8'))
    validateResearchArtifact(completed, source)
    if (!isDeepStrictEqual(completed.config, config) || !isDeepStrictEqual(completed.selection,selection)) throw new Error('Completed output request mismatch')
    return completed
  } catch(e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
  const records: ResearchArtifact['records'] = []
  for (const p of selected) {
    const file = join(checkpoint,`${p.candidateIndex}.json`)
    let record, reused = false
    try {
      const saved: unknown = JSON.parse(await readFile(file,'utf8'))
      validateResearchArtifact(saved,{...source,acceptedPuzzles:[p]})
      if (!isDeepStrictEqual(saved.config,config) || saved.records.length !== 1 || saved.records[0].candidateIndex !== p.candidateIndex) throw new Error('Checkpoint record mismatch')
      record = saved.records[0]; reused = true
    } catch(e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      record = {candidateIndex:p.candidateIndex,canonicalKey:p.canonicalKey,research:analyzeLocalPuzzle(p,config)}
      const payload = {formatVersion:'local-research-v2' as const, sourceShardDigest:source.digest,config,selection:{candidateIndices:[p.candidateIndex]},records:[record]}
      await writeExclusive(file,{...payload,digest:digest(payload)})
    }
    records.push(record)
    options.onProgress?.(records.length,selected.length,p.candidateIndex,reused)
  }
  const payload = {formatVersion:'local-research-v2' as const,sourceShardDigest:source.digest,config,selection,records}
  const result = {...payload,digest:digest(payload)}
  validateResearchArtifact(result,source)
  await writeExclusive(options.output,result)
  return result
}

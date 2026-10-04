import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, link, unlink, readFile, rm, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { serialize } from './shard'

export async function writeExclusive(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), {recursive:true})
  const temporary = `${path}.${randomUUID()}.tmp`
  let handle
  try {
    handle = await open(temporary, 'wx')
    await handle.writeFile(serialize(value), 'utf8'); await handle.sync(); await handle.close(); handle = undefined
    await link(temporary, path)
  } finally {
    await handle?.close()
    await unlink(temporary).catch(e => { if (e.code !== 'ENOENT') throw e })
  }
}
export async function fileHash(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}
interface PairJournal { formatVersion: 'artifact-pair-v1'; stage: string; artifactSHA256: string; manifestSHA256: string }
async function ensureLinked(staged: string, target: string, expected: string): Promise<void> {
  if (await fileHash(staged) !== expected) throw new Error(`Corrupt staged file: ${staged}`)
  try { await link(staged, target) } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST' || await fileHash(target) !== expected) throw e
  }
}
export async function recoverPair(output: string): Promise<void> {
  output = resolve(output)
  const pending = `${output}.pending.json`, marker = `${output}.complete.json`
  const j = JSON.parse(await readFile(pending, 'utf8')) as PairJournal
  if (j.formatVersion !== 'artifact-pair-v1' || !j.stage.startsWith(`${output}.stage-`)
    || !/^[a-f0-9-]{36}$/.test(j.stage.slice(`${output}.stage-`.length))
    || !/^[a-f0-9]{64}$/.test(j.artifactSHA256) || !/^[a-f0-9]{64}$/.test(j.manifestSHA256)) throw new Error('Invalid publication journal')
  await ensureLinked(`${j.stage}/artifact.json`, output, j.artifactSHA256)
  await ensureLinked(`${j.stage}/manifest.json`, output.replace(/\.json$/, '.run.json'), j.manifestSHA256)
  try { await writeExclusive(marker, {formatVersion:j.formatVersion,artifactSHA256:j.artifactSHA256,manifestSHA256:j.manifestSHA256}) }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; await verifyPair(output) }
  await unlink(pending)
  await rm(j.stage, {recursive:true})
}
export async function verifyPair(output: string): Promise<void> {
  const m = JSON.parse(await readFile(`${output}.complete.json`, 'utf8')) as PairJournal
  if (m.formatVersion !== 'artifact-pair-v1' || await fileHash(output) !== m.artifactSHA256
    || await fileHash(output.replace(/\.json$/, '.run.json')) !== m.manifestSHA256) throw new Error('Incomplete or corrupt artifact pair')
}
export async function publishPair(output: string, artifact: unknown, manifest: unknown): Promise<void> {
  output = resolve(output)
  for (const p of [output, output.replace(/\.json$/, '.run.json'), `${output}.pending.json`, `${output}.complete.json`]) {
    try { await access(p); throw new Error(`Publication already exists: ${p}. Use recover:artifact for a pending pair.`) }
    catch(e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
  }
  const stage = `${output}.stage-${randomUUID()}`
  await mkdir(stage, {recursive:true})
  let journalPublished = false
  try {
    await writeExclusive(`${stage}/artifact.json`, artifact)
    await writeExclusive(`${stage}/manifest.json`, manifest)
    await writeExclusive(`${output}.pending.json`, {formatVersion:'artifact-pair-v1',stage,artifactSHA256:await fileHash(`${stage}/artifact.json`),manifestSHA256:await fileHash(`${stage}/manifest.json`)})
    journalPublished = true
    await recoverPair(output)
  } finally {
    if (!journalPublished) await rm(stage, {recursive:true,force:true})
  }
}

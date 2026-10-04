import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { validateLocalShard } from '../src/shard'

const directory = mkdtempSync(join(tmpdir(), 'water-sort-cli-'))
afterAll(() => rmSync(directory, { recursive: true, force: true }))
function cli(name: string, args: string[]) {
  return execFileSync(process.execPath, ['--import', 'tsx', `src/cli/${name}.ts`, ...args], {
    timeout: 60_000, encoding: 'utf8', env: { ...process.env, npm_config_user_agent: 'npm/11.17.0 node/v24.19.0 darwin arm64' }, stdio: ['ignore', 'pipe', 'pipe'],
  })
}
describe('native local CLI', () => {
  it('writes deterministic shards with separate varying manifests and validates real files', () => {
    const a = join(directory, 'a.json'), b = join(directory, 'b.json')
    const args = ['--seed=cli-test', '--start-index=0', '--end-index=0', '--colors=2', '--capacity=2']
    cli('generate', [...args, `--output=${a}`]); cli('generate', [...args, `--output=${b}`])
    expect(readFileSync(a, 'utf8')).toBe(readFileSync(b, 'utf8'))
    expect(readFileSync(a.replace('.json', '.run.json'), 'utf8')).not.toBe(readFileSync(b.replace('.json', '.run.json'), 'utf8'))
    validateLocalShard(JSON.parse(readFileSync(a, 'utf8')))
    expect(JSON.parse(cli('validate', [`--file=${a}`])).valid).toBe(true)
    expect(JSON.parse(cli('compare-shards', [a, b])).candidatesMatched).toBe(1)
    expect(() => cli('merge', [a, b, `--output=${join(directory, 'overlap.json')}`])).toThrow()
    expect(existsSync(join(directory, 'overlap.json'))).toBe(false)
    expect(() => cli('generate', [...args, `--output=${a}`])).toThrow()
  }, 60_000)
  it('rejects certification overrides before running a batch', () => {
    expect(() => cli('certify', ['--end-index=100000'])).toThrow()
  }, 60_000)

  it.each([['--start-index=0'], ['--start-index', '--end-index=0'], ['--start-index=0', '--end-index=0', '--max-states=2', '--max-states=3'], ['--start-index=0', '--end-index=0', '--unknown=1'], ['--start-index=-1', '--end-index=0'], ['--start-index=0', '--end-index=1x'],
    ['--start-index=1', '--end-index=0'], ['--start-index=0', '--end-index=0', '--count=1']])('rejects malformed range flags without output %s', (...args) => {
    const output = join(directory, 'invalid.json')
    expect(() => cli('generate', [...args, `--output=${output}`])).toThrow()
    expect(existsSync(output)).toBe(false)
  }, 60_000)
})

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs'
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
  it('help never generates or overwrites and legacy typos fail before work', () => {
    const output = join(directory, 'help.json')
    expect(cli('generate', ['--help', `--output=${output}`])).toContain('per difficulty')
    expect(existsSync(output)).toBe(false)
    for (const args of [['--start-inde=0', '--end-inde=1'], ['--count=1x'], ['--count=0'], ['--seed=a', '--seed=b']]) {
      expect(() => cli('generate', [...args, `--output=${output}`])).toThrow()
      expect(existsSync(output)).toBe(false)
    }
    expect(cli('analyze-shard', ['--help'])).toContain('positive')
  })
  it.each(['--analysis-max-state=1', '--analysis-max-states=0', '--severe-penalty=0', '--analysis-max-steps=1x', '--analysis-max-states=1 --analysis-max-states=2'])('rejects invalid analysis options before reading a source: %s', flag => {
    expect(() => cli('analyze-shard', ['--input=missing.json', ...flag.split(' '), `--output=${join(directory, 'invalid-research.json')}`])).toThrow()
    expect(existsSync(join(directory, 'invalid-research.json'))).toBe(false)
  })
  it('writes deterministic shards with separate varying manifests and validates real files', () => {
    const a = join(directory, 'a.json'), b = join(directory, 'b.json')
    const args = ['--seed=cli-test', '--start-index=0', '--end-index=0', '--colors=2', '--capacity=2']
    cli('generate', [...args, `--output=${a}`]); cli('generate', [...args, `--output=${b}`])
    const reports=join(`${a}.process-runs`)
    const report=JSON.parse(readFileSync(join(reports,readdirSync(reports)[0]),'utf8'))
    expect(report.status).toBe('completed')
    expect(report.telemetry.phases.write).toBeGreaterThan(0)
    expect(report.telemetry.solves.calls).toBeGreaterThan(0)
    expect(report.telemetry.resourceStatistics.maxRssBytes).toBeGreaterThan(0)
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

export function stringArg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`
  const argument = process.argv.find((value) => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length) : fallback
}

export function positiveIntArg(name: string, fallback: number): number {
  const raw = stringArg(name)
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1) throw new Error(`--${name} must be a positive safe integer`)
  return value
}
/** Validate before any I/O or expensive work. Help never starts a workload. */
export function parseCliOptions(allowed: readonly string[], usage: string, positional = false): string[] {
  const args = process.argv.slice(2)
  if (args.includes('--version')) { console.log(GENERATOR_VERSION); process.exit(0) }
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage)
    process.exit(0)
  }
  const seen = new Set<string>(), paths: string[] = []
  for (const arg of args) {
    if (!arg.startsWith('-') && positional) { paths.push(arg); continue }
    const match = /^--([^=]+)=(.+)$/.exec(arg)
    if (!match || !allowed.includes(match[1]) || seen.has(match[1])) {
      throw new Error(`Unsupported, empty, malformed or repeated option: ${arg}. Use --help.`)
    }
    seen.add(match[1])
  }
  return paths
}
import {GENERATOR_VERSION} from '../version'

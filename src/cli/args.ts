export function stringArg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`
  const argument = process.argv.find((value) => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length) : fallback
}

export function positiveIntArg(name: string, fallback: number): number {
  const raw = stringArg(name)
  if (raw === undefined) return fallback
  const value = Number.parseInt(raw, 10)
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`)
  return value
}


export function booleanArg(name: string, fallback = false): boolean {
  const bare = `--${name}`
  if (process.argv.includes(bare)) return true
  const raw = stringArg(name)
  if (raw === undefined) return fallback
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  throw new Error(`--${name} must be true or false`)
}

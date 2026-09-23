import { describe, expect, it } from 'vitest'
import { positiveIntArg } from '../src/cli/args'

function parseCount(raw: string): number {
  const previous = process.argv
  process.argv = ['node', 'cli', `--count=${raw}`]
  try {
    return positiveIntArg('count', 5)
  } finally {
    process.argv = previous
  }
}

describe('positive integer CLI arguments', () => {
  it('accepts a complete positive integer', () => {
    expect(parseCount('7')).toBe(7)
  })

  it.each(['1x', '1.5', '0', '-1', '', '9007199254740992'])(
    'rejects malformed or unsafe value %s',
    (raw) => {
      expect(() => parseCount(raw)).toThrow(/positive integer/)
    },
  )
})

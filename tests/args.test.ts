import { describe, expect, it } from 'vitest'
import { nonNegativeIntArg, positiveIntArg } from '../src/cli/args'

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

describe('non-negative integer CLI arguments', () => {
  it('accepts candidate index zero', () => {
    const previous = process.argv
    process.argv = ['node', 'cli', '--candidate-index=0']
    try {
      expect(nonNegativeIntArg('candidate-index', 0)).toBe(0)
    } finally {
      process.argv = previous
    }
  })

  it.each(['1x', '1.5', '-1', '', '9007199254740992'])(
    'rejects malformed or unsafe candidate index %s',
    (raw) => {
      const previous = process.argv
      process.argv = ['node', 'cli', `--candidate-index=${raw}`]
      try {
        expect(() => nonNegativeIntArg('candidate-index', 0)).toThrow(/non-negative integer/)
      } finally {
        process.argv = previous
      }
    },
  )
})
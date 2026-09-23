import { describe, expect, it } from 'vitest'
import { CanonicalSequenceTrie } from '../src/dedup'

describe('canonical sequence trie', () => {
  it('detects exact duplicate uint64 sequences', () => {
    const trie = new CanonicalSequenceTrie()
    expect(trie.add([1n, 2n, 3n])).toBe(true)
    expect(trie.add([1n, 2n, 3n])).toBe(false)
    expect(trie.has([1n, 2n, 3n])).toBe(true)
    expect(trie.size).toBe(1)
  })

  it('does not collapse shared prefixes or different lengths', () => {
    const trie = new CanonicalSequenceTrie()
    expect(trie.add([1n, 2n])).toBe(true)
    expect(trie.add([1n, 2n, 3n])).toBe(true)
    expect(trie.add([1n, 4n])).toBe(true)
    expect(trie.size).toBe(3)
  })
})

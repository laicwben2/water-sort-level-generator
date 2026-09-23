class TrieNode {
  readonly children = new Map<bigint, TrieNode>()
  terminal = false
}

export class CanonicalSequenceTrie {
  private readonly root = new TrieNode()
  private _size = 0

  get size(): number {
    return this._size
  }

  has(sequence: readonly bigint[]): boolean {
    let node = this.root
    for (const key of sequence) {
      const child = node.children.get(key)
      if (!child) return false
      node = child
    }
    return node.terminal
  }

  add(sequence: readonly bigint[]): boolean {
    let node = this.root
    for (const key of sequence) {
      let child = node.children.get(key)
      if (!child) {
        child = new TrieNode()
        node.children.set(key, child)
      }
      node = child
    }

    if (node.terminal) return false
    node.terminal = true
    this._size += 1
    return true
  }
}

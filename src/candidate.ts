import { createRng, shuffle } from './rng'
import type { Board } from './types'

export function generateBalancedFullTubes(
  types: number,
  capacity: number,
  seed: string,
): Board {
  if (!Number.isInteger(types) || types < 1 || types > 16) {
    throw new Error('types must be an integer in 1..16')
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 4) {
    throw new Error('capacity must be an integer in 1..4')
  }

  const layers = Array.from({ length: types }, (_, type) => Array(capacity).fill(type)).flat()
  const shuffled = shuffle(layers, createRng(seed))
  return Array.from({ length: types }, (_, index) => (
    shuffled.slice(index * capacity, (index + 1) * capacity)
  ))
}

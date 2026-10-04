import type {LocalShard} from './shard'
/** Stable generation identity; puzzle.id alone is only a namespace-local alias. */
export function candidateIdentity(shard:LocalShard,candidateIndex:number){
  if(!Number.isSafeInteger(candidateIndex)||candidateIndex<0)throw new Error('Invalid candidate identity index')
  return {formatVersion:'local-candidate-identity-v1' as const,namespace:{config:structuredClone(shard.config),reproducibility:structuredClone(shard.reproducibility)},candidateIndex}
}

import type {LocalPuzzle,LocalShard} from './shard'
import type {ResearchArtifact} from './research'
export function coverageReport(source:LocalShard,comparison?:ResearchArtifact){
  const compare=new Map(comparison?.records.map(r=>[r.candidateIndex,r.research]))
  function group(puzzles:LocalPuzzle[],other=false){
    const rows=new Map<string,{colors:number;optimalMoves:number;puzzles:number;incomplete:number;selectedSteps:number;skippedSteps:number;eligible:number;known:number;skippedAlternatives:number;unknown:number}>()
    for(const p of puzzles){const research=other?compare.get(p.candidateIndex):p.research;if(!research)continue
      const colors=p.research.structural.typeCount,optimalMoves=p.optimalSolution.length,key=`${colors}:${optimalMoves}`
      let row=rows.get(key);if(!row){row={colors,optimalMoves,puzzles:0,incomplete:0,selectedSteps:0,skippedSteps:0,eligible:0,known:0,skippedAlternatives:0,unknown:0};rows.set(key,row)}
      const m=research.mistakeRecovery;row.puzzles++;row.incomplete+=Number(!research.complete);row.selectedSteps+=m.analyzedSteps;row.skippedSteps+=m.skippedSteps;row.eligible+=m.eligibleAlternatives;row.known+=m.knownAlternativeCount;row.skippedAlternatives+=m.skippedAlternatives;row.unknown+=m.unknownCount
    }
    return [...rows.values()].sort((a,b)=>a.colors-b.colors||a.optimalMoves-b.optimalMoves).map(r=>({...r,selectedStepCoverage:r.selectedSteps+r.skippedSteps?r.selectedSteps/(r.selectedSteps+r.skippedSteps):1,knownCoverageWithinSelectedSteps:r.eligible?r.known/r.eligible:1}))
  }
  return {formatVersion:'local-coverage-report-v1',sourceShardDigest:source.digest,sampling:'Evenly spaced path steps; first alternatives in deterministic joinsColor/amount/from/to order. Not a random sample.',interpretation:'Raw counts are not calibrated difficulty. Selected-step coverage is distinct from eligible-alternative coverage.',baseline:group(source.acceptedPuzzles),comparison:comparison?{digest:comparison.digest,config:comparison.config,groups:group(source.acceptedPuzzles,true),matchedBaseline:group(source.acceptedPuzzles.filter(p=>compare.has(p.candidateIndex)))}:null}
}

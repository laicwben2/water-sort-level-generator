import {performance} from 'node:perf_hooks'
const phases:Record<string,number>={}
const solves={calls:0,allocatedNodes:0,peakQueue:0,reopens:0}
export function measure<T>(phase:string,action:()=>T):T{const t=performance.now();try{return action()}finally{phases[phase]=(phases[phase]??0)+performance.now()-t}}
export async function measureAsync<T>(phase:string,action:()=>Promise<T>):Promise<T>{const t=performance.now();try{return await action()}finally{phases[phase]=(phases[phase]??0)+performance.now()-t}}
export function recordSolve(nodes:number,peakQueue:number,reopens:number):void{if(!process.send)return;solves.calls++;solves.allocatedNodes+=nodes;solves.peakQueue=Math.max(solves.peakQueue,peakQueue);solves.reopens+=reopens}
export function installTelemetry():void{
  process.once('beforeExit',()=>{
    const r=process.resourceUsage()
    process.send?.({kind:'water-sort-telemetry',phases,solves,resourceStatistics:{maxRssBytes:r.maxRSS*1024,userCpuMicroseconds:r.userCPUTime,systemCpuMicroseconds:r.systemCPUTime},memory:process.memoryUsage()},()=>process.disconnect?.())
  })
}

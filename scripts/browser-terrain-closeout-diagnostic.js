// Diagnostic flights only. These observers never run in acceptance captures.
const diagnostic = {calls:[],frames:[],longTasks:[]}
window.__closeoutDiagnostic = diagnostic
const inWindow=()=>closeout.active&&closeout.seconds>=160&&closeout.seconds<=180
for(const [label,object] of Object.entries({world,terrain:world.terrain,settlements:world.settlements,atmosphere:world.atmosphere,traffic:world.traffic,mission:world.mission,renderer,radar,audio,hud,review:window.__closeout})){
 const names=new Set([...Object.getOwnPropertyNames(object),...Object.getOwnPropertyNames(Object.getPrototypeOf(object))])
 for(const key of names){
  if(key==='constructor'||Object.getOwnPropertyDescriptor(Object.getPrototypeOf(object),key)?.get||typeof object[key]!=='function')continue
  const original=object[key]
  object[key]=function(...args){
   if(!inWindow())return original.apply(this,args)
   const start=performance.now(),seconds=closeout.seconds
   try{return original.apply(this,args)}finally{const ms=performance.now()-start;if(ms>=2)diagnostic.calls.push({label,key,seconds,start,ms})}
  }
 }
}
new PerformanceObserver(list=>{for(const e of list.getEntries())if(inWindow())diagnostic.longTasks.push(e.toJSON())}).observe({type:'longtask',buffered:true})
const diagnosticFrame=window.__closeout.frame
window.__closeout.frame=now=>{
 if(inWindow())diagnostic.frames.push({seconds:closeout.seconds,raf:now,observed:performance.now(),previousTerrainMs:closeout.previousTerrainMs})
 return diagnosticFrame(now)
}

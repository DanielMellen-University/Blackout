// Review-only observer and controls pilot, injected by the runner. No shipped API.
const closeout = {active:false,seconds:0,nextSurvey:0,target:0,route:null,frames:0,lastFrame:0,captureUntil:0,histogram:{},hitches:[],terrainMaxMs:0,previousTerrainMs:0,terrainSlow:[],coverageMissing:0,coverageChecks:0,coverageMisses:[]}
const closeClamp=(v,a,b)=>Math.max(a,Math.min(b,v))
const originalTerrainUpdate=world.terrain.update
world.terrain.update=function(...args){const start=performance.now();try{return originalTerrainUpdate.apply(this,args)}finally{const ms=performance.now()-start;closeout.previousTerrainMs=ms;if(closeout.active){closeout.terrainMaxMs=Math.max(closeout.terrainMaxMs,ms);if(ms>16)closeout.terrainSlow.push({seconds:closeout.seconds,ms})}}}
window.__closeout={
 start:r=>{
  closeout.route=r
  if(!r.long){world.atmosphere.setAutomaticWeather(false);world.atmosphere.setWeather('clear',true);world.atmosphere.setWeatherLocked(true);world.atmosphere.timeOfDay=.48;world.atmosphere.setTimeOfDayLocked(true)}
  const yaw=r.yaw, x=r.x,z=r.z
  aircraft.reset({x,y:closeSurface(x,z)+r.clearance,z,yaw})
  aircraft.velocity.set(Math.sin(yaw)*160,0,Math.cos(yaw)*160)
  aircraft.snapDisplay();aircraft.capturePrevious();wasAirborne=true
  closeout.active=true;closeout.seconds=0;closeout.start=aircraft.position.toArray();closeout.lastFrame=0
  cameras.setMode('chase',aircraft)
 },
 camera:mode=>cameras.setMode(mode,aircraft),
 capture:()=>{closeout.captureUntil=performance.now()+1500},
 frame:now=>{
  if(!closeout.active)return
  const gap=now-closeout.lastFrame;closeout.lastFrame=now
  if(gap<=0||gap>10000||now<closeout.captureUntil)return
  closeout.frames++;const bucket=Math.round(gap*10)/10;closeout.histogram[bucket]=(closeout.histogram[bucket]??0)+1
  if(gap>100)closeout.hitches.push({seconds:closeout.seconds,gapMs:gap,previousTerrainMs:closeout.previousTerrainMs,position:aircraft.position.toArray()})
 },
 before:dt=>{
  if(!closeout.active)return
  closeout.seconds+=dt
  const r=closeout.route,p=aircraft.position,pose=attitudeFromOrientation(aircraft.orientation)
  if(closeout.seconds>=closeout.nextSurvey){
   closeout.nextSurvey=closeout.seconds+.5;closeout.target=-Infinity
   for(const d of r.long?[0,500,1000,1800,3000,4500,6000,8000]:[0,500,1000,1800,3000])closeout.target=Math.max(closeout.target,closeSurface(p.x+Math.sin(r.yaw)*d,p.z+Math.cos(r.yaw)*d)+r.clearance-d*.025)
   closeout.coverageChecks++;if(world.terrain.sampleMeshHeight(p.x,p.z)===null){closeout.coverageMissing++;closeout.coverageMisses.push({seconds:closeout.seconds,position:p.toArray()})}
  }
  const desired=closeClamp(Math.atan2(closeout.target-p.y,1800),-.18,.5),error=Math.atan2(Math.sin(r.yaw-pose.heading),Math.cos(r.yaw-pose.heading)),c=aircraft.controls
  c.pitch=closeClamp((desired-pose.pitch)*2+aircraft.angularVelocity.x*.4,-1,1)
  c.roll=closeClamp(-pose.roll*2+aircraft.angularVelocity.z*.4,-1,1)
  c.yaw=closeClamp(error*1.8-aircraft.angularVelocity.y*.4,-1,1)
  c.throttle=.45;c.boost=false;c.airbrake=false;c.gearDown=false;c.stabilityAssist=true
 },
 state:()=>({seconds:closeout.seconds,seed:world.worldSeed,course:activeSortie.course.id,position:aircraft.position.toArray(),velocity:aircraft.velocity.toArray(),start:closeout.start,targetHeight:closeout.target,crashMessage,failureReason:collision.failureReason,meshCoverage:world.terrain.sampleMeshHeight(aircraft.position.x,aircraft.position.z)!==null,impact:aircraft.impact?{...aircraft.impact}:null,status:aircraft.status,onGround:aircraft.onGround,agl:aircraft.altitudeAgl,attitude:{...attitudeFromOrientation(aircraft.orientation)},climate:closeClimate(aircraft.position.x,aircraft.position.z).biome,weather:{...world.atmosphere.weatherSnapshot},timeOfDay:world.atmosphere.timeOfDay,paused:menu.paused,playing,heapBytes:performance.memory?.usedJSHeapSize??0,streaming:{...world.terrain.streamingStats},ratio:renderer.getPixelRatio(),camera:cameras.mode}),
 metrics:()=>({frames:closeout.frames,histogram:closeout.histogram,hitches:closeout.hitches,terrainMaxMs:closeout.terrainMaxMs,terrainSlow:closeout.terrainSlow,coverageMissing:closeout.coverageMissing,coverageChecks:closeout.coverageChecks,coverageMisses:closeout.coverageMisses})
}

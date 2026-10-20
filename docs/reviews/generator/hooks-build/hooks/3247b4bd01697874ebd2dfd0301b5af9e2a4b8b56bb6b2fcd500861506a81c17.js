// Review-only controls pilot. No reset, pose, velocity, gate or challenge writes.
const training = {active:false,seconds:0,stage:'takeoff',gate:-1,events:[],waypoint:0,lastPhase:'',target:null}
const trainClamp=(v,a,b)=>Math.max(a,Math.min(b,v))
window.__training={
 start:()=>{training.active=true;training.started=aircraft.position.toArray()},
 camera:mode=>cameras.setMode(mode,aircraft),
 before:dt=>{
  if(!training.active)return
  training.seconds+=dt
  const p=aircraft.position,pose=attitudeFromOrientation(aircraft.orientation),c=aircraft.controls
  const gate=world.mission.activeGatePos(),next=world.mission.next
  if(next!==training.gate){training.events.push({seconds:training.seconds,next,position:p.toArray(),phase:challenge.phase});training.gate=next}
  let target,speed=150,gear=false
  const spawn=!gate&&window.__b21ReverseApproach?{...world.spawn,x:world.runway.position.x,z:world.runway.position.z}:world.spawn,pilotYaw=spawn.yaw+(!gate&&window.__b21ReverseApproach?Math.PI:0),fx=Math.sin(pilotYaw),fz=Math.cos(pilotYaw)
  if(!wasAirborne&&training.stage==='takeoff'){
   target={x:p.x+fx*1000,y:spawn.y+160,z:p.z+fz*1000};speed=150;gear=aircraft.altitudeAgl<12
   if(aircraft.altitudeAgl>25)training.stage='gates'
  }else if(gate){
   training.stage='gates'
   const g=world.mission.gates[next],along=(p.x-g.pos.x)*g.fwd.x+(p.z-g.pos.z)*g.fwd.z
   const lead=along>60 ? -300 : Math.max(0,100+along)
   target={x:gate.x+g.fwd.x*lead,y:gate.y,z:gate.z+g.fwd.z*lead}
  }else{
   if(['contour','weather','generated-desert','generated-valley','generated-coastal','generated-volcanic'].includes(world.mission.routeProfile))training.waypoint=1; const padY=world.runway.position.y,along=(p.x-spawn.x)*fx+(p.z-spawn.z)*fz
   const approach={x:spawn.x-fx*2200,y:padY+135,z:spawn.z-fz*2200}
   approach.y=Math.max(approach.y,b21Ground(approach.x,approach.z)+220)
   if(training.waypoint===0&&Math.hypot(p.x-approach.x,p.z-approach.z)<300&&p.y<Math.max(approach.y+80,padY+900))training.waypoint=1
   if(training.waypoint===0){training.stage='return';target=approach;speed=180}
   else{
    training.stage='approach';gear=true;speed=62
    const lateral=(p.x-spawn.x)*Math.cos(pilotYaw)-(p.z-spawn.z)*Math.sin(pilotYaw)
    const look=120
    const aimAlong=along+look
    const height=padY+1.4+Math.max(0,(-along-450)*.052)
    target={x:spawn.x+fx*aimAlong-lateral*.25*Math.cos(pilotYaw),y:height,z:spawn.z+fz*aimAlong+lateral*.25*Math.sin(pilotYaw)}
    // Aim the flight path down the glide instead of repeatedly aiming at a
    // point above the same aircraft coordinate.
    target.y=padY+1.4-aimAlong*.052
    // Follow a terrain-clearing descent into the short existing runway.
    // This changes only pilot targets, never the aircraft pose or terrain.
    for(let offset=-400;offset<=400;offset+=40){
     const sampleAlong=aimAlong+offset
     if(sampleAlong> -15)continue
     const key=Math.round(sampleAlong/40),cache=training.approachHeights||(training.approachHeights=new Map())
     if(!cache.has(key))cache.set(key,b21Ground(spawn.x+fx*key*40,spawn.z+fz*key*40))
     const clearance=trainClamp((-sampleAlong-20)*.07,0,60)
     target.y=Math.max(target.y,cache.get(key)+1.4+clearance-Math.abs(offset)*.45)
    }
   }
  }
  if(!gate&&['contour','weather','generated-desert','generated-valley','generated-coastal','generated-volcanic'].includes(world.mission.routeProfile))training.returnCleared=true
  if(!gate&&!training.returnCleared){
   if(training.returnClearY===undefined){
    training.returnClearY=p.y
    for(let i=0;i<12;i++){
     const angle=i*Math.PI/6,x=p.x+Math.sin(angle)*1200,z=p.z+Math.cos(angle)*1200
     training.returnClearY=Math.max(training.returnClearY,(world.terrain.sampleMeshHeight(x,z)??b21Ground(x,z))+400)
    }
   }
   if(p.y>=training.returnClearY)training.returnCleared=true
   else{training.stage='return-climb';target={x:p.x+Math.sin(pose.heading)*1000,y:p.y+1000,z:p.z+Math.cos(pose.heading)*1000};speed=200;gear=false}
  }
  training.touched ||= aircraft.status==='landed'||(training.contact&&['roll','landed'].includes(training.contact.touch)&&aircraft.onGround)
  if(training.touched){training.stage='rollout';c.pitch=0;c.roll=0;c.yaw=trainClamp(Math.atan2(Math.sin(pilotYaw-pose.heading),Math.cos(pilotYaw-pose.heading))*2,-1,1);c.throttle=0;c.boost=false;c.airbrake=true;c.gearDown=true;return}
  if(training.stage==='return'){
   const tx=target.x-p.x,tz=target.z-p.z,length=Math.max(1,Math.hypot(tx,tz))
   if(training.seconds>=(training.transitAt||0)){
    training.transitAt=training.seconds+.4;training.transitFloor=-Infinity
    for(const distance of [0,300,600,900])training.transitFloor=Math.max(training.transitFloor,b21Ground(p.x+tx/length*Math.min(length,distance),p.z+tz/length*Math.min(length,distance))+180,b21Ground(p.x+Math.sin(pose.heading)*distance,p.z+Math.cos(pose.heading)*distance)+180)
   }
   target.y=Math.max(target.y,training.transitFloor)
  }
  training.target=target
  const dx=target.x-p.x,dz=target.z-p.z,dist=Math.hypot(dx,dz)
  const heading=Math.atan2(dx,dz),error=Math.atan2(Math.sin(heading-pose.heading),Math.cos(heading-pose.heading))
  let desired=trainClamp(Math.atan2(target.y-p.y,Math.max(100,dist)),training.stage==='approach'?-.65:-.3,.55)
  if(training.stage==='approach'&&p.y-world.runway.position.y<3)desired=trainClamp((world.runway.position.y+.9-p.y)*.08,-.055,.06)
  if(training.stage==='return-climb')desired=.9
  c.pitch=trainClamp((desired-pose.pitch)*3+aircraft.angularVelocity.x*.4,-1,1)
  if(aircraft.onGround&&training.stage==='takeoff')c.pitch=aircraft.speed>38?.85:0
  c.roll=trainClamp(-pose.roll*2+aircraft.angularVelocity.z*.4,-1,1)
  c.yaw=trainClamp(error*2.5-aircraft.angularVelocity.y*.4,-1,1)
  const feed=(aircraft.speed/340)**2+(gear?.0048*aircraft.speed**2*.55/48:0)
  c.throttle=trainClamp(feed+(speed-aircraft.speed)*.03,0,1)
  if(gear&&!c.gearDown)aircraft.toggleGear()
  c.boost=false;c.airbrake=aircraft.speed>speed+12;c.gearDown=gear;c.stabilityAssist=true
 },
 state:()=>({seconds:training.seconds,stage:training.stage,waypoint:training.waypoint,target:training.target,events:training.events,
  position:aircraft.position.toArray(),velocity:aircraft.velocity.toArray(),speed:aircraft.speed,agl:aircraft.altitudeAgl,status:aircraft.status,onGround:aircraft.onGround,
  attitude:{...attitudeFromOrientation(aircraft.orientation)},controls:{...aircraft.controls},spawn:{...world.spawn},runway:world.runway.position.toArray(),
  gates:world.mission.gates.map(g=>({position:g.pos.toArray(),fwd:g.fwd.toArray(),passed:g.passed})),next:world.mission.next,
  seed:world.worldSeed,freeStages:training.freeStages||[],contact:training.contact||null,loadFactor:aircraft.loadFactor,engine:{...aircraft.engineState},fuel:aircraft.fuel.fraction,weather:{...world.atmosphere.weatherSnapshot},result:challenge.result,recordId:activeSortie.recordId,impact:aircraft.impact?{point:aircraft.impact.point.toArray(),verticalVelocity:aircraft.impact.verticalVelocity,surface:aircraft.impact.surface}:null,
  course:activeSortie.course.id,phase:challenge.phase,briefing:{visible:flightBriefing.visible,stage:flightBriefing.stage,hint:hudFrame.controlHint},navTarget:hudFrame.navTarget,navGlide:hudFrame.navGlide,resultsOpen:results.open,
  paused:menu.paused,playing,camera:cameras.mode})
}
window.__training.catalog=()=>COURSE_LIBRARY.map(course=>({id:course.id,label:course.label}))

const b21OriginalBefore=window.__training.before
const b21Free={stage:'takeoff',time:0,total:0,done:false,stallTime:0}
window.__training.before=dt=>{
 if(!training.active)return
 if(activeSortie.course.id!=='free-flight'||b21Free.done){b21OriginalBefore(dt);return}
 const p=aircraft.position,c=aircraft.controls,pose=attitudeFromOrientation(aircraft.orientation),f=b21Free
 f.time+=dt;f.total+=dt;training.seconds+=dt;training.stage=f.stage
 const next=stage=>{(training.freeStages||=[]).push({stage:f.stage,seconds:f.total,position:p.toArray(),speed:aircraft.speed,vy:aircraft.velocity.y,loadFactor:aircraft.loadFactor,nitro:{...aircraft.nitro}});f.stage=stage;f.time=0}
 let pitch=0,bank=0,speed=220,throttle=1
 if(f.stage==='takeoff'){pitch=.28;if(aircraft.altitudeAgl>3000&&aircraft.speed>180)next('nitro-drain')}
 if(f.stage==='nitro-drain'){pitch=.02;speed=650;if(aircraft.nitro.depleted)next('nitro-refill')}
 if(f.stage==='nitro-refill'){pitch=0;throttle=.55;speed=340;if(aircraft.nitro.fraction>=.75)next('nitro-restart')}
 if(f.stage==='nitro-restart'){pitch=.08;speed=650;if(f.time>3)next('hard-turn')}
 if(f.stage==='hard-turn'){bank=1.40;pitch=0;if(f.time>1.3)c.pitch=.25;if(f.time>11)next('climb')}
 if(f.stage==='climb'){pitch=.35;if(f.time>12)next('dive')}
 if(f.stage==='dive'){pitch=-.28;if(f.time>10)next('stall-entry')}
 if(f.stage==='stall-entry'){pitch=.12;throttle=0;speed=35;if(aircraft.speed<40&&aircraft.velocity.y< -2){f.stallTime+=dt;if(f.stallTime>.5)next('stall-recovery')}}
 if(f.stage==='stall-recovery'){pitch=f.time<1?-.18:0;speed=190;if(f.time>5&&aircraft.speed>160&&Math.abs(aircraft.velocity.y)<5){next('return');f.done=true;training.waypoint=0}}
 c.pitch=trainClamp((pitch-pose.pitch)*3+aircraft.angularVelocity.x*.4,-1,1)
 if(f.stage==='hard-turn'&&f.time>1.3)c.pitch=.25
 if(aircraft.onGround)c.pitch=aircraft.speed>38?.85:0
 c.roll=trainClamp((bank-pose.roll)*2+aircraft.angularVelocity.z*.4,-1,1)
 c.yaw=0;c.throttle=throttle;c.boost=['nitro-drain','nitro-restart'].includes(f.stage);c.gearDown=aircraft.altitudeAgl<12;c.stabilityAssist=false
 c.airbrake=aircraft.speed>speed+12
}
window.__training.touch=touch=>{
 if(!training.active||training.contact||!wasAirborne||!['landed','roll','crash','ditch'].includes(touch))return
 const yaw=world.spawn.yaw,p=aircraft.position,rx=p.x-world.runway.position.x,rz=p.z-world.runway.position.z
 training.contact={touch,seconds:training.seconds,position:p.toArray(),surface:aircraft.impact?.surface||'land',
  localX:rx*Math.cos(yaw)-rz*Math.sin(yaw),localZ:rx*Math.sin(yaw)+rz*Math.cos(yaw),
  speed:aircraft.speed,verticalVelocity:aircraft.impact?.verticalVelocity??aircraft.impactVy}
}
// Catalog compatibility can lower draw cadence while preserving native RAF,
// production Time, every simulation step, streaming and all mission evaluators.
const b21Render=renderer.render.bind(renderer)
let b21RenderInterval=0,b21RenderedAt=-Infinity
renderer.render=(...args)=>{
 const now=performance.now()
 if(!b21RenderInterval||now-b21RenderedAt>=b21RenderInterval){b21RenderedAt=now;b21Render(...args)}
}
window.__training.setRenderInterval=ms=>{b21RenderInterval=Math.max(0,ms)}
window.__training.capture=()=>{b21RenderedAt=performance.now();b21Render(world.scene,cameras.camera)}

// Optional review control override, never a reserve or state override.
const b21PilotBefore = window.__training.before
window.__training.boost = enabled => { training.forceBoost = enabled }
window.__training.before = dt => {
 b21PilotBefore(dt)
 if (training.active && training.forceBoost !== undefined) {
  aircraft.controls.boost = training.forceBoost
  if (training.forceBoost) { aircraft.controls.throttle = 1; aircraft.controls.airbrake = false }
 }
}
const b21Observe = window.__training.state
window.__training.state = () => ({ ...b21Observe(), nitro: { ...aircraft.nitro } })
// Observe the production audio graph and capture its post-limiter output.
const b21Cue = audio.playCue.bind(audio)
training.audioCues = []
audio.playCue = (...args) => { training.audioCues.push({ seconds: training.seconds, kind: args[0] }); return b21Cue(...args) }
window.__training.startAudio = () => {
 const ctx = audio['ctx'], limiter = audio['limiter']
 if (!ctx || !limiter) throw Error('Production audio unavailable')
 const tap = ctx.createMediaStreamDestination(), chunks = []
 limiter.connect(tap)
 const recorder = new MediaRecorder(tap.stream)
 recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
 training.audioCapture = { tap, chunks, recorder }
 recorder.start()
}
window.__training.endAudio = () => new Promise(resolve => {
 const { tap, chunks, recorder } = training.audioCapture
 recorder.onstop = async () => {
  const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
  let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  audio['limiter'].disconnect(tap)
  resolve(btoa(binary))
 }
 recorder.stop()
})
const b21SoundState = window.__training.state
window.__training.state = () => ({ ...b21SoundState(), audio: { state: audio['ctx']?.state, cues: training.audioCues,
 engineGain: audio['engineGain']?.gain.value, filterHz: audio['engineFilter']?.frequency.value,
 masterGain: audio['master']?.gain.value } })

// Each mission uses short aligned bursts near gates. Navigation and landing
// remain the original controls pilot; routes and evaluators remain untouched.
const b21FlightBefore = window.__training.before
training.nitroTimeline = []; training.refills = []
window.__training.before = dt => {
 b21FlightBefore(dt)
 if (!training.active) return
 if (activeSortie.course.id !== 'free-flight' && training.forceBoost === undefined && training.stage === 'gates') {
  const gate = world.mission.activeGatePos(), p = aircraft.position, pose = attitudeFromOrientation(aircraft.orientation)
  if (gate) {
   const dx=gate.x-p.x,dz=gate.z-p.z,range=Math.hypot(dx,dz)
   const error=Math.atan2(Math.sin(Math.atan2(dx,dz)-pose.heading),Math.cos(Math.atan2(dx,dz)-pose.heading))
   if (training.boostedGate !== world.mission.next && range>100 && range<260 && Math.abs(error)<.12 && aircraft.speed<230 && aircraft.altitudeAgl>30) {
    training.boostedGate=world.mission.next; training.boostUntil=training.seconds+.8
   }
   if (training.seconds < (training.boostUntil||0)) {
    aircraft.controls.boost=true; aircraft.controls.throttle=1; aircraft.controls.airbrake=false
   }
  }
 }
 if (training.seconds >= (training.nitroSampleAt||0)) {
  training.nitroSampleAt=training.seconds+.5
  training.nitroTimeline.push({seconds:training.seconds,stage:training.stage,reserve:aircraft.nitro.fraction,
   depleted:aircraft.nitro.depleted,boosting:aircraft.engineState.afterburnerActive,requested:aircraft.controls.boost,speed:aircraft.speed})
 }
}
window.__training.gateBefore = () => { training.gateBefore={...aircraft.nitro} }
window.__training.gateAfter = () => { training.refills.push({seconds:training.seconds,gate:world.mission.next,
 before:training.gateBefore,after:{...aircraft.nitro}}) }
const b21FlightState = window.__training.state
window.__training.state = () => ({ ...b21FlightState(), nitroTimeline:training.nitroTimeline, nitroRefills:training.refills })

const generatorObserve = window.__training.state
window.__training.state = () => ({ ...generatorObserve(), stream: world.terrain.streamingStats,
 coverage: world.terrain.hasMeshCoverage(aircraft.position.x-100,aircraft.position.z-100,aircraft.position.x+100,aircraft.position.z+100),
 lod: world.terrain.chunkStats(Math.floor(aircraft.position.x/420),Math.floor(aircraft.position.z/420)),
 heapMB: performance.memory?.usedJSHeapSize / 1048576,
})

// Observe actual drawing-buffer resizes without changing adaptive resolution.
training.resizes = []
const generatorSetPixelRatio = renderer.setPixelRatio.bind(renderer)
renderer.setPixelRatio = ratio => {
 const at = performance.now()
 performance.mark('review-pixel-ratio-' + ratio)
 generatorSetPixelRatio(ratio)
 training.resizes.push({ at, ratio, ms: performance.now() - at })
}
const generatorResizeState = window.__training.state
window.__training.state = () => ({ ...generatorResizeState(), resizes: training.resizes })

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
  const spawn=world.spawn,fx=Math.sin(spawn.yaw),fz=Math.cos(spawn.yaw)
  if(!wasAirborne&&training.stage==='takeoff'){
   target={x:p.x+fx*1000,y:spawn.y+160,z:p.z+fz*1000};speed=150;gear=aircraft.altitudeAgl<12
   if(aircraft.altitudeAgl>25)training.stage='gates'
  }else if(gate){
   training.stage='gates'
   const g=world.mission.gates[next],along=(p.x-g.pos.x)*g.fwd.x+(p.z-g.pos.z)*g.fwd.z
   const lead=along>60 ? -300 : Math.max(0,100+along)
   target={x:gate.x+g.fwd.x*lead,y:gate.y,z:gate.z+g.fwd.z*lead}
  }else{
   if(['contour','weather'].includes(world.mission.routeProfile))training.waypoint=1; const padY=world.runway.position.y,along=(p.x-spawn.x)*fx+(p.z-spawn.z)*fz
   const approach={x:spawn.x-fx*2200,y:padY+135,z:spawn.z-fz*2200}
   if(training.waypoint===0&&Math.hypot(p.x-approach.x,p.z-approach.z)<180&&p.y<approach.y+80)training.waypoint=1
   if(training.waypoint===0){training.stage='return';target=approach;speed=130}
   else{
    training.stage='approach';gear=true;speed=62
    const lateral=(p.x-spawn.x)*Math.cos(spawn.yaw)-(p.z-spawn.z)*Math.sin(spawn.yaw)
    const look=['contour','weather'].includes(world.mission.routeProfile)?185+Math.max(0,200-(world.mission.gates.at(-1).pos.y-padY))*.85:220
    const aimAlong=along+look
    const height=padY+1.4+Math.max(0,(-along-450)*.052)
    target={x:spawn.x+fx*aimAlong-lateral*.25*Math.cos(spawn.yaw),y:height,z:spawn.z+fz*aimAlong+lateral*.25*Math.sin(spawn.yaw)}
    // Aim the flight path down the glide instead of repeatedly aiming at a
    // point above the same aircraft coordinate.
    target.y=padY+1.4-aimAlong*.052
   }
  }
  training.touched ||= aircraft.status==='landed'
  if(training.touched){training.stage='rollout';c.pitch=0;c.roll=0;c.yaw=trainClamp(Math.atan2(Math.sin(spawn.yaw-pose.heading),Math.cos(spawn.yaw-pose.heading))*2,-1,1);c.throttle=0;c.boost=false;c.airbrake=true;c.gearDown=true;return}
  training.target=target
  const dx=target.x-p.x,dz=target.z-p.z,dist=Math.hypot(dx,dz)
  const heading=Math.atan2(dx,dz),error=Math.atan2(Math.sin(heading-pose.heading),Math.cos(heading-pose.heading))
  let desired=trainClamp(Math.atan2(target.y-p.y,Math.max(100,dist)),training.stage==='approach'&&['contour','weather'].includes(world.mission.routeProfile)?-.45:-.2,.38)
  if(training.stage==='approach'&&p.y-world.runway.position.y<3)desired=trainClamp((world.runway.position.y+.9-p.y)*.08,-.055,.06)
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

const b20OriginalBefore=window.__training.before
const b20Free={stage:'takeoff',time:0,total:0,done:false,stallTime:0}
window.__training.before=dt=>{
 if(!training.active)return
 if(activeSortie.course.id!=='free-flight'||b20Free.done){b20OriginalBefore(dt);return}
 const p=aircraft.position,c=aircraft.controls,pose=attitudeFromOrientation(aircraft.orientation),f=b20Free
 f.time+=dt;f.total+=dt;training.seconds+=dt;training.stage=f.stage
 const next=stage=>{(training.freeStages||=[]).push({stage:f.stage,seconds:f.total,position:p.toArray(),speed:aircraft.speed,vy:aircraft.velocity.y,loadFactor:aircraft.loadFactor});f.stage=stage;f.time=0}
 let pitch=0,bank=0,speed=220,throttle=1
 if(f.stage==='takeoff'){pitch=.28;if(aircraft.altitudeAgl>3000&&aircraft.speed>180)next('hard-turn')}
 if(f.stage==='hard-turn'){bank=1.40;pitch=0;if(f.time>1.3)c.pitch=.25;if(f.time>11)next('climb')}
 if(f.stage==='climb'){pitch=.35;if(f.time>12)next('dive')}
 if(f.stage==='dive'){pitch=-.28;if(f.time>10)next('stall-entry')}
 if(f.stage==='stall-entry'){pitch=.12;throttle=0;speed=35;if(aircraft.speed<40&&aircraft.velocity.y< -2){f.stallTime+=dt;if(f.stallTime>.5)next('stall-recovery')}}
 if(f.stage==='stall-recovery'){pitch=f.time<1?-.18:0;speed=190;if(f.time>5&&aircraft.speed>160&&Math.abs(aircraft.velocity.y)<5){next('return');f.done=true;training.waypoint=0}}
 c.pitch=trainClamp((pitch-pose.pitch)*3+aircraft.angularVelocity.x*.4,-1,1)
 if(f.stage==='hard-turn'&&f.time>1.3)c.pitch=.25
 if(aircraft.onGround)c.pitch=aircraft.speed>38?.85:0
 c.roll=trainClamp((bank-pose.roll)*2+aircraft.angularVelocity.z*.4,-1,1)
 c.yaw=0;c.throttle=throttle;c.boost=false;c.gearDown=aircraft.altitudeAgl<12;c.stabilityAssist=false
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
const b20Render=renderer.render.bind(renderer)
let b20RenderInterval=0,b20RenderedAt=-Infinity
renderer.render=(...args)=>{
 const now=performance.now()
 if(!b20RenderInterval||now-b20RenderedAt>=b20RenderInterval){b20RenderedAt=now;b20Render(...args)}
}
window.__training.setRenderInterval=ms=>{b20RenderInterval=Math.max(0,ms)}
window.__training.capture=()=>{b20RenderedAt=performance.now();b20Render(world.scene,cameras.camera)}

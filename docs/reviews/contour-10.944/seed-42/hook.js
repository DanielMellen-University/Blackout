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
  let target,speed=window.__reviewSpeed,gear=false
  const spawn=world.spawn,fx=Math.sin(spawn.yaw),fz=Math.cos(spawn.yaw)
  if(!wasAirborne&&training.stage==='takeoff'){
   target={x:p.x+fx*1000,y:spawn.y+160,z:p.z+fz*1000};speed=window.__reviewSpeed;gear=aircraft.altitudeAgl<12
   if(aircraft.altitudeAgl>25)training.stage='gates'
  }else if(gate){
   training.stage='gates'
   const g=world.mission.gates[next],along=(p.x-g.pos.x)*g.fwd.x+(p.z-g.pos.z)*g.fwd.z
   const lead=along>60 ? -300 : Math.max(0,100+along)
   target={x:gate.x+g.fwd.x*lead,y:gate.y,z:gate.z+g.fwd.z*lead}
  }else{
   if(world.mission.routeProfile==='contour')training.waypoint=1; const padY=world.runway.position.y,along=(p.x-spawn.x)*fx+(p.z-spawn.z)*fz
   const approach={x:spawn.x-fx*2200,y:padY+135,z:spawn.z-fz*2200}
   if(training.waypoint===0&&Math.hypot(p.x-approach.x,p.z-approach.z)<180)training.waypoint=1
   if(training.waypoint===0){training.stage='return';target=approach;speed=130}
   else{
    training.stage='approach';gear=true;speed=62
    const lateral=(p.x-spawn.x)*Math.cos(spawn.yaw)-(p.z-spawn.z)*Math.sin(spawn.yaw)
    const look=world.mission.routeProfile==='contour'?185:220
    const aimAlong=along+look
    const height=padY+1.4+Math.max(0,(-along-450)*.052)
    target={x:spawn.x+fx*aimAlong-lateral*.25*Math.cos(spawn.yaw),y:height,z:spawn.z+fz*aimAlong+lateral*.25*Math.sin(spawn.yaw)}
    // Aim the flight path down the glide instead of repeatedly aiming at a
    // point above the same aircraft coordinate.
    target.y=padY+1.4+Math.max(0,(-aimAlong+(world.mission.routeProfile==='contour'?-180:-450))*.052)
   }
  }
  training.target=target
  const dx=target.x-p.x,dz=target.z-p.z,dist=Math.hypot(dx,dz)
  const heading=Math.atan2(dx,dz),error=Math.atan2(Math.sin(heading-pose.heading),Math.cos(heading-pose.heading))
  let desired=trainClamp(Math.atan2(target.y-p.y,Math.max(100,dist)),training.stage==='approach'&&world.mission.routeProfile==='contour'?-.45:-.2,.38)
  if(training.stage==='approach'&&aircraft.altitudeAgl<(world.mission.routeProfile==='contour'?6:8))desired=trainClamp((world.runway.position.y+1.4-p.y)*.045,-.055,.06)
  c.pitch=trainClamp((desired-pose.pitch)*3+aircraft.angularVelocity.x*.4,-1,1)
  if(aircraft.onGround&&training.stage==='takeoff')c.pitch=aircraft.speed>24?.85:0
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
  course:activeSortie.course.id,phase:challenge.phase,briefing:{visible:flightBriefing.visible,stage:flightBriefing.stage,hint:hudFrame.controlHint},navTarget:hudFrame.navTarget,navGlide:hudFrame.navGlide,resultsOpen:results.open,
  paused:menu.paused,playing,camera:cameras.mode})
}

window.__resetPilot=()=>Object.assign(training,{active:false,seconds:0,stage:'takeoff',gate:-1,events:[],waypoint:0,lastPhase:'',target:null});window.__score=()=>({result:challenge.result,elapsed:challenge.elapsedSec,active:activeSortie,summary:world.mission.routeSummary,allowance:world.mission.timeAllowanceSec,storage:{...localStorage},report:document.querySelector('#run-results').innerText,goal:document.querySelector('#title-course-picker .course-picker-goal')?.textContent});
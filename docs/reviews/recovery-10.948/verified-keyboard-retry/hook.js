// Review-only controls pilot. No reset, pose, velocity, gate or challenge writes.
const training = {active:false,seconds:0,stage:'takeoff',gate:-1,events:[],waypoint:0,lastPhase:'',target:null}
const trainClamp=(v,a,b)=>Math.max(a,Math.min(b,v))
window.__training={
 start:()=>{training.active=true;training.started=aircraft.position.toArray()},
 camera:mode=>cameras.setMode(mode,aircraft),
 before:dt=>{
  if(!training.active)return
  training.seconds+=dt
  const p=aircraft.position,pose=attitudeFromOrientation(aircraft.orientation),c={...aircraft.controls}
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
   if(!training.missed)training.waypoint=1; const padY=world.runway.position.y,along=(p.x-spawn.x)*fx+(p.z-spawn.z)*fz
   const approach={x:spawn.x-fx*2200,y:padY+135,z:spawn.z-fz*2200}
   if(training.waypoint===0&&Math.hypot(p.x-approach.x,p.z-approach.z)<180)training.waypoint=1
   if(training.waypoint===0){training.stage='return';target=approach;speed=130}
   else{
    training.stage='approach';gear=true;speed=45
    const lateral=(p.x-spawn.x)*Math.cos(spawn.yaw)-(p.z-spawn.z)*Math.sin(spawn.yaw)
    const look=220
    const aimAlong=along+look
    const height=padY+1.4+Math.max(0,(-along-450)*.052)
    target={x:spawn.x+fx*aimAlong-lateral*.25*Math.cos(spawn.yaw),y:height,z:spawn.z+fz*aimAlong+lateral*.25*Math.sin(spawn.yaw)}
    // Aim the flight path down the glide instead of repeatedly aiming at a
    // point above the same aircraft coordinate.
    target.y=padY+1.4+Math.max(0,(-aimAlong-80)*.052)
   }
  }
  const along=(p.x-spawn.x)*fx+(p.z-spawn.z)*fz;
  if(window.__scenario==='go-around'&&training.stage==='approach'&&!training.missed&&aircraft.altitudeAgl>85&&along>-780&&along<-400){training.missed=true;training.climbUntil=training.seconds+15;training.waypoint=0;training.events.push({kind:'go-around',seconds:training.seconds,position:p.toArray()})}
  if(training.seconds<training.climbUntil){training.stage='go-around';gear=false;speed=135;target={x:p.x+fx*1000,y:spawn.y+300,z:p.z+fz*1000}}
  if(window.__scenario==='engine-out'&&training.stage==='approach'&&!training.cut&&along>-1800&&along<-400){aircraft.fuel.remaining=0;training.cut=true;training.events.push({kind:'fuel-out-fixture',seconds:training.seconds,position:p.toArray()})}
  if(training.stage==='return'){
   const dx=target.x-p.x,dz=target.z-p.z,length=Math.max(1,Math.hypot(dx,dz));
   target.y=Math.max(target.y,spawn.y+350);
   for(const d of [0,300,600,1000])target.y=Math.max(target.y,recoverySurface(p.x+dx/length*d,p.z+dz/length*d)+160)
  }
  training.target=target
  const dx=target.x-p.x,dz=target.z-p.z,dist=Math.hypot(dx,dz)
  const heading=Math.atan2(dx,dz),error=Math.atan2(Math.sin(heading-pose.heading),Math.cos(heading-pose.heading))
  let desired=trainClamp(Math.atan2(target.y-p.y,Math.max(100,dist)),-.4,.38)
  if(training.stage==='approach'&&aircraft.altitudeAgl<3)desired=trainClamp((world.runway.position.y+.9-p.y)*.045,-.055,.06)
  c.pitch=trainClamp((desired-pose.pitch)*3+aircraft.angularVelocity.x*.4,-1,1)
  if(aircraft.onGround&&training.stage==='takeoff')c.pitch=aircraft.speed>24?.85:0
  c.roll=trainClamp(-pose.roll*2+aircraft.angularVelocity.z*.4,-1,1)
  c.yaw=trainClamp(error*2.5-aircraft.angularVelocity.y*.4,-1,1)
  const feed=(aircraft.speed/340)**2+(gear?.0048*aircraft.speed**2*.55/48:0)
  c.throttle=trainClamp(feed+(speed-aircraft.speed)*.03,0,1)
  
  c.boost=false;c.airbrake=aircraft.speed>speed+12;c.gearDown=gear;c.stabilityAssist=true;
  if(window.__scenario==='crash'&&training.seconds>12){c.pitch=-1;c.throttle=0;c.gearDown=false;c.airbrake=false}
  if(training.cut){c.throttle=0;c.airbrake=false}
  driveMapped(c,dt)
 },
 state:()=>({seconds:training.seconds,stage:training.stage,waypoint:training.waypoint,target:training.target,events:training.events,
  position:aircraft.position.toArray(),velocity:aircraft.velocity.toArray(),speed:aircraft.speed,agl:aircraft.altitudeAgl,status:aircraft.status,onGround:aircraft.onGround,
  attitude:{...attitudeFromOrientation(aircraft.orientation)},controls:{...aircraft.controls},spawn:{...world.spawn},runway:world.runway.position.toArray(),
  gates:world.mission.gates.map(g=>({position:g.pos.toArray(),fwd:g.fwd.toArray(),passed:g.passed})),next:world.mission.next,
  course:activeSortie.course.id,phase:challenge.phase,briefing:{visible:flightBriefing.visible,stage:flightBriefing.stage,hint:hudFrame.controlHint},navTarget:hudFrame.navTarget,navGlide:hudFrame.navGlide,resultsOpen:results.open,
  paused:menu.paused,playing,camera:cameras.mode})
}

// External pilot adapter. Desired controls enter through keyboard events or a
// standard Gamepad API fixture, then the production InputManager samples them.
const mapped = { held: new Set(), duty: {}, events: [], gearAt: -Infinity, trimAt: -Infinity, trimRequested: false, gearRequested: false }
const mappedKey = (code, down) => {
 if (mapped.held.has(code) === down) return
 if (down) mapped.held.add(code); else mapped.held.delete(code)
 window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }))
 mapped.events.push({ seconds: training.seconds, code, down })
}
const mappedAxis = (name, value, positive, negative) => {
 const magnitude = Math.abs(value)
 mapped.duty[name] = (mapped.duty[name] || 0) + magnitude
 const pulse = mapped.duty[name] >= 1
 if (pulse) mapped.duty[name] -= 1
 mappedKey(positive, pulse && value > 0); mappedKey(negative, pulse && value < 0)
}
function driveMapped(c, dt) {
 const gamepad = window.__mappedDevice === 'gamepad'
 if (!mapped.trimRequested) { mapped.trimAt = training.seconds; mapped.trimRequested = true }
 if (training.stage === 'approach' && !aircraft.controls.gearDown && !mapped.gearRequested) {
  mapped.gearAt = training.seconds; mapped.gearRequested = true
 }
 if (gamepad) {
  const axis = v => Math.abs(v) < 0.001 ? 0 : Math.sign(v) * (0.14 + Math.abs(v) * 0.86)
  window.__virtualPad.axes = [axis(c.roll), -axis(c.pitch), axis(c.yaw), 0]
  const throttleError = c.throttle - aircraft.controls.throttle
  const buttons = window.__virtualPad.buttons
  for (const button of buttons) { button.value = 0; button.pressed = false }
  const set = (i, v) => { buttons[i].value = v; buttons[i].pressed = v > 0.5 }
  set(7, throttleError > .004 ? 1 : 0); set(6, throttleError < -.004 ? 1 : 0)
  set(4, c.airbrake ? 1 : 0)
  set(1, training.seconds - mapped.trimAt < .2 ? 1 : 0)
  set(2, training.seconds - mapped.gearAt < .2 ? 1 : 0)
  window.__virtualPad.timestamp = performance.now()
 } else {
  mappedAxis('pitch', c.pitch, 'KeyW', 'KeyS')
  mappedAxis('roll', c.roll, 'KeyQ', 'KeyE')
  mappedAxis('yaw', c.yaw, 'KeyD', 'KeyA')
  mappedKey('ShiftLeft', c.throttle - aircraft.controls.throttle > .004)
  mappedKey('ControlLeft', c.throttle - aircraft.controls.throttle < -.004)
  mappedKey('KeyB', c.airbrake)
  mappedKey('KeyV', training.seconds - mapped.trimAt < .1)
  mappedKey('KeyG', training.seconds - mapped.gearAt < .1)
 }
}
window.__mappedState = () => ({ device: window.__mappedDevice, inputSource: input.inputSource, eventCount: mapped.events.length, events: mapped.events.slice(-24), pad: window.__virtualPad, result: challenge.result, report: document.querySelector('#run-results').innerText, storage: { ...localStorage } })

window.__mappedEvents = () => mapped.events

window.__recovery=()=>({active:activeSortie,seed:world.worldSeed,selected:selectedCourseId,seconds:training.seconds,phase:challenge.phase,result:challenge.result,crash:crashCinematic.active,resultsOpen:results.open,report:document.querySelector('#run-results').innerText,playing,paused:menu.paused,fuel:{...aircraft.fuel},engine:{...aircraft.engineState},onGround:aircraft.onGround,speed:aircraft.speed,position:aircraft.position.toArray(),spawn:{...world.spawn},next:world.mission.next,controls:{...aircraft.controls},source:input.inputSource,briefing:hudFrame.controlHint,navTarget:hudFrame.navTarget,navGlide:hudFrame.navGlide,events:training.events,storage:{...localStorage}});window.__stopPilot=()=>{training.active=false;for(const code of [...mapped.held])mappedKey(code,false);for(const b of window.__virtualPad.buttons){b.pressed=false;b.value=0}window.__virtualPad.axes.fill(0)};
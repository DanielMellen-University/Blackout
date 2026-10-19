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
   const padY=world.runway.position.y,along=(p.x-spawn.x)*fx+(p.z-spawn.z)*fz
   const approach={x:spawn.x-fx*2200,y:padY+135,z:spawn.z-fz*2200}
   if(training.waypoint===0&&Math.hypot(p.x-approach.x,p.z-approach.z)<180)training.waypoint=1
   if(training.waypoint===0){training.stage='return';target=approach;speed=130}
   else{
    training.stage='approach';gear=true;speed=42
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
  training.target=target
  const dx=target.x-p.x,dz=target.z-p.z,dist=Math.hypot(dx,dz)
  const heading=Math.atan2(dx,dz),error=Math.atan2(Math.sin(heading-pose.heading),Math.cos(heading-pose.heading))
  let desired=trainClamp(Math.atan2(target.y-p.y,Math.max(100,dist)),-.2,.38)
  if(training.stage==='approach'&&aircraft.altitudeAgl<3)desired=trainClamp((world.runway.position.y+.9-p.y)*.045,-.055,.06)
  c.pitch=trainClamp((desired-pose.pitch)*3+aircraft.angularVelocity.x*.4,-1,1)
  if(aircraft.onGround&&training.stage==='takeoff')c.pitch=aircraft.speed>24?.85:0
  c.roll=trainClamp(-pose.roll*2+aircraft.angularVelocity.z*.4,-1,1)
  c.yaw=trainClamp(error*2.5-aircraft.angularVelocity.y*.4,-1,1)
  const feed=(aircraft.speed/340)**2+(gear?.0048*aircraft.speed**2*.55/48:0)
  c.throttle=trainClamp(feed+(speed-aircraft.speed)*.03,0,1)
  
  c.boost=false;c.airbrake=aircraft.speed>speed+12;c.gearDown=gear;c.stabilityAssist=true;
 training.touched ||= aircraft.status==='landed'||aircraft.onGround; if(training.touched){training.stage='rollout';c.pitch=0;c.roll=0;c.yaw=trainClamp(Math.atan2(Math.sin(spawn.yaw-pose.heading),Math.cos(spawn.yaw-pose.heading))*2,-1,1);c.throttle=0;c.boost=false;c.airbrake=true;c.gearDown=true}
 driveMapped(c,dt);
 if(training.seconds>=(training.traceAt||0)){training.traceAt=training.seconds+.05;(training.trace||=[]).push({seconds:training.seconds,position:aircraft.position.toArray(),onGround:aircraft.onGround,speed:aircraft.speed,agl:aircraft.altitudeAgl,status:aircraft.status,controls:{...aircraft.controls}})}
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

window.__handlingTrace=()=>training.trace||[];window.__setupHandling=()=>{const spawn=world.spawn,fx=Math.sin(spawn.yaw),fz=Math.cos(spawn.yaw),along=-250,x=spawn.x+fx*along,z=spawn.z+fz*along;const y=Math.max(world.runway.position.y+28,handlingSurface(x,z)+12);aircraft.reset({x,y,z,yaw:spawn.yaw});aircraft.velocity.set(fx*40,-2,fz*40);aircraft.snapDisplay();aircraft.capturePrevious();wasAirborne=true;training.active=true;training.stage='approach';training.waypoint=1;training.seconds=0};window.__handling=()=>({seed:world.worldSeed,...window.__training.state(),engine:{...aircraft.engineState},fuel:{...aircraft.fuel},source:input.inputSource,impact:aircraft.impact?{position:aircraft.impact.position.toArray(),verticalVelocity:aircraft.impact.verticalVelocity,tangentialSpeed:aircraft.impact.tangentialSpeed,gearDown:aircraft.impact.gearDown}:null,storage:{...localStorage}});
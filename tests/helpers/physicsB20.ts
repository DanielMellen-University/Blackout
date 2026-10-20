import { Aircraft } from '../../src/aircraft/Aircraft'
import { setContactHeightSampler } from '../../src/world/ground'
import { Euler, Vector3 } from 'three'

/** Calm, gear-up, dry-thrust probes. All motion comes from production Aircraft.step. */
export function measurePhysics() {
 setContactHeightSampler(()=>0)
 try {
 const dt=1/120,deg=180/Math.PI
 function create(speed=340,pitch=0,bank=0){const a=new Aircraft();a.position.set(0,20000,0);a.orientation.setFromEuler(new Euler(-pitch,0,-bank,'YXZ'));a.velocity.set(0,0,speed).applyQuaternion(a.orientation);Object.assign(a.controls,{gearDown:false,throttle:1,boost:false,stabilityAssist:false});return a}
 function run(a: Aircraft,seconds: number){for(let i=0;i<Math.round(seconds/dt);i++)a.step(dt)}
 const out: any={dt,initialAltitudeM:20000,calm:true}
 for(const axis of ['roll','pitch']){const a=create(250);a.controls[axis]=1;run(a,1);const rate=Math.abs(a.angularVelocity[axis==='roll'?'z':'x'])*deg;a.controls[axis]=0;run(a,.25);out[axis]={rateDegS:rate,residualAfter250msDegS:Math.abs(a.angularVelocity[axis==='roll'?'z':'x'])*deg};a.dispose()}
 {const a=create(340,0,Math.PI/2);a.controls.pitch=.25;run(a,10);out.turn={seconds:10,bankDeg:90,pitchStick:.25,startSpeedMps:340,endSpeedMps:a.speed,lossMps:340-a.speed,altitudeChangeM:a.position.y-20000,peakG:a.loadFactor};a.dispose()}
 {const a=create();run(a,120);out.topSpeedMps=a.speed;a.dispose()}
 {const a=create(340,Math.PI/6);run(a,30);out.climb={pitchDeg:30,seconds:30,endSpeedMps:a.speed,altitudeGainM:a.position.y-20000,meanMps:(a.position.y-20000)/30,endVerticalMps:a.velocity.y};a.dispose()}
 {const a=create(340,-Math.PI/6);run(a,30);out.dive={pitchDeg:-30,seconds:30,endSpeedMps:a.speed,altitudeChangeM:a.position.y-20000};a.dispose()}
 {const a=create(100);a.controls.throttle=0;let onset: {speedMps:number;seconds:number}|null=null,maxSink=0;const samples=[];for(let i=0;i<3600;i++){a.step(dt);maxSink=Math.max(maxSink,-a.velocity.y);if(!onset&&a.velocity.y < -2)onset={speedMps:a.speed,seconds:i*dt};if(i%120===0)samples.push({s:i*dt,speed:a.speed,vy:a.velocity.y})}out.stall={sink2MpsOnset:onset,maxSinkMps:maxSink,samples};a.dispose()}
 {const a=create(32,20/deg);a.controls.throttle=0;run(a,2);const entry={speed:a.speed,vy:a.velocity.y};a.controls.throttle=1;a.controls.pitch=-.35;run(a,2);a.controls.pitch=0;for(let i=0;i<480;i++){const fwd=new Vector3(0,0,1).applyQuaternion(a.orientation);a.controls.pitch=Math.max(-1,Math.min(1,-Math.asin(fwd.y)*3+a.angularVelocity.x*.4));a.step(dt)}out.recovery={entry,endSpeedMps:a.speed,altitudeChangeM:a.position.y-20000,verticalMps:a.velocity.y};a.dispose()}
 return out
 } finally { setContactHeightSampler(null) }
}

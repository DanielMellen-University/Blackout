import { readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const part=process.env.REVIEW_PART
if(!part)throw Error('REVIEW_PART is required')
const themes=process.env.POLISH_THEMES.split(','),seeds=[73,808,2026]
function shape(f){
 const origin=[f.spawn.x,f.spawn.y,f.spawn.z],yaw=f.spawn.yaw,points=f.gates.map(g=>g.position)
 let prior=origin,length=0
 for(const p of [...points,origin]){length+=Math.hypot(p[0]-prior[0],p[1]-prior[1],p[2]-prior[2]);prior=p}
 const right=(points[1][0]-origin[0])*Math.cos(yaw)-(points[1][2]-origin[2])*Math.sin(yaw)
 const heights=points.map(p=>p[1]-f.runway[1])
 return {heading:((yaw*180/Math.PI)%360+360)%360,hand:right<0?'left':'right',width:Math.abs(right),lengthKm:length/1000,heights:heights.map(x=>Math.round(x)),recordId:f.recordId}
}
const rows=[]
for(const theme of themes)for(const seed of seeds){
 const b=JSON.parse(await readFile(`docs/reviews/generator/polish-baseline/${theme}-${seed}/run.json`,'utf8'))
 const a=JSON.parse(await readFile(`docs/reviews/generator/${part}/${theme}-${seed}/run.json`,'utf8'))
 assert.equal(b.pass,true);assert.equal(a.pass,true);assert.equal(a.smoke,false);assert.equal(a.final.result.medal,'gold')
 rows.push({theme,seed,before:shape(b.final),after:shape(a.final),score:a.final.result.totalScore,seconds:a.final.seconds,contact:a.final.contact})
}
await writeFile(`docs/reviews/generator/${part}-course-comparison.json`,JSON.stringify({rows},null,2)+'\n')
const table=['| Theme | Seed | Heading before/after | Turn before/after | Width m before/after | Circuit km before/after | Gate heights above runway m, after | Score |','| --- | ---: | --- | --- | --- | --- | --- | ---: |',...rows.map(r=>`| ${r.theme} | ${r.seed} | ${r.before.heading.toFixed(0)} / ${r.after.heading.toFixed(0)} | ${r.before.hand} / ${r.after.hand} | ${r.before.width.toFixed(0)} / ${r.after.width.toFixed(0)} | ${r.before.lengthKm.toFixed(2)} / ${r.after.lengthKm.toFixed(2)} | ${r.after.heights.join(', ')} | ${r.score} |`)].join('\n')
await writeFile(`docs/reviews/generator/${part}-course-comparison.md`,table+'\n')
console.log(table)

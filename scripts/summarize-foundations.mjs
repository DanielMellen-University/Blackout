import {readFile,writeFile} from 'node:fs/promises'
const dir=process.argv[2]||'docs/reviews/foundations-10.935',rows=[]
for(const [a,b]of [['before','after'],['before-historical','after-historical'],['coarse-before','coarse-after']]){
 const before=JSON.parse(await readFile(`${dir}/${a}.json`,'utf8')),after=JSON.parse(await readFile(`${dir}/${b}.json`,'utf8'))
 if(before.errors.length||after.errors.length||before.results.length!==after.results.length)throw Error('Incomplete '+a)
 for(const r of after.results){
  const old=before.results.find(o=>o.seed===r.seed&&o.mode===r.mode)
  if(!old||Math.hypot(...r.scan.position.map((v,i)=>v-old.scan.position[i]))>1e-5||r.scan.camera!==r.mode||r.scan.ratio!==1)throw Error('Pose mismatch')
  const visible=r.scan.cases.filter(c=>c.visible&&c.gap!==null),oldVisible=old.scan.cases.filter(c=>c.visible&&c.gap!==null)
  if(!visible.length||visible.length!==oldVisible.length)throw Error('Missing settlement')
  const maximum=key=>Math.max(...visible.map(c=>c[key]??-Infinity))
  const row={capture:b,seed:r.seed,mode:r.mode,buildings:visible.length,beforeGap:Math.max(...oldVisible.map(c=>c.gap)),afterGap:maximum('gap'),perimeterGap:maximum('perimeterGap')}
  if(row.afterGap>.001||row.perimeterGap>.001)throw Error('Exposed foundation '+JSON.stringify(row))
  rows.push(row)
 }
}
await writeFile(`${dir}/summary.json`,JSON.stringify(rows,null,2)+'\n');console.log(rows)

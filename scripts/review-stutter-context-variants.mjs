// Diagnostic only. Isolate context attributes, then restore source and review build.
import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
const path='src/main.ts', original=await readFile(path,'utf8')
const anchor="context: canvas.getContext('webgl2', { alpha: false, desynchronized: true,"
if(!original.includes(anchor))throw Error('Context diagnostic anchor missing')
const run=(script,env={})=>{
 const r=spawnSync(process.execPath,[script],{stdio:'inherit',env:{...process.env,...env}})
 if(r.error||r.status!==0)throw r.error||Error(`${script}: ${r.status}`)
}
try{
 for(const [name,attributes]of [['alpha-only','alpha: true, desynchronized: false,'],['latency-only','alpha: false, desynchronized: true,']]){
  await writeFile(path,original.replace(anchor,`context: canvas.getContext('webgl2', { ${attributes}`))
  run('scripts/build-generator-review.mjs')
  run('scripts/review-generator.mjs',{REVIEW_PART:`stutter-${name}`,REVIEW_COURSE:'desert-run',REVIEW_SEEDS:'42',REVIEW_CAPTURE:'0',REVIEW_SMOKE:'1'})
 }
}finally{
 await writeFile(path,original)
 run('scripts/build-generator-review.mjs')
}

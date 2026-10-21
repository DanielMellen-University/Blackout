// Approved catalog migration review. Sequential native-cadence browser flights.
import { createServer } from 'vite'
import { spawnSync } from 'node:child_process'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
const stage=process.env.MIGRATION_STAGE || 'b'
const mode=process.env.MIGRATION_MODE || 'smoke'
const server=await createServer({server:{middlewareMode:true}})
const jobs=[]
try {
 const {COURSE_LIBRARY,resolveCourseDefinition}=await server.ssrLoadModule('/src/systems/CourseLibrary.ts')
 const authored=COURSE_LIBRARY.filter(c=>c.seed!==null&&!c.contractCatalog)
 const contracts=COURSE_LIBRARY.filter(c=>c.seed!==null&&c.contractCatalog&&resolveCourseDefinition(c).terrainTheme)
 const selected=stage==='b'?authored:stage==='c'?contracts:[...authored,...contracts]
 const reps=stage==='c'?['precision-landing','ridge-trial','water-skim','volcanic-ops']:['training-orbit','range-sweep','coastal-run','volcanic-run']
 for(const c of selected) {
  if(mode==='full'&&!reps.includes(c.id))continue
  jobs.push({course:c.id,seeds:'42,1337,9001',query:'',profile:resolveCourseDefinition(c).terrainTheme})
 }
 if(mode==='smoke'&&stage!=='c') {
  for(const [course,key,periods] of [
   ['daily-ops','day',['2026-10-20','2026-10-21','2026-10-22']],
   ['weekly-ops','week',['2026-W43','2026-W44','2026-W45']],
   ['monthly-ops','month',['2026-10','2026-11','2026-12']],
  ])for(const period of periods) {
   const parse=key==='day'?'dailyOpsTimestampForDayKey':key==='week'?'weeklyOpsTimestampForWeekKey':'monthlyOpsTimestampForMonthKey'
   const lib=await server.ssrLoadModule('/src/systems/CourseLibrary.ts')
   const c=resolveCourseDefinition(COURSE_LIBRARY.find(c=>c.id===course),lib[parse](period))
   jobs.push({course,seeds:String(c.seed),query:`&${key}=${period}`,profile:c.terrainTheme,period})
  }
 }
} finally {await server.close()}
const part=`migration-${stage}-${mode}`
await mkdir(`docs/reviews/generator/${part}`,{recursive:true})
await writeFile(`docs/reviews/generator/${part}/jobs.json`,JSON.stringify(jobs,null,2)+'\n')
for(const [index,job]of jobs.entries()) {
 if(process.env.MIGRATION_COURSES&&!process.env.MIGRATION_COURSES.split(',').includes(job.course))continue
 console.log(`JOB ${index+1}/${jobs.length}`,JSON.stringify(job))
 const result=spawnSync(process.execPath,['scripts/review-generator.mjs'],{stdio:'inherit',env:{...process.env,
  REVIEW_PART:part,REVIEW_COURSE:job.course,REVIEW_SEEDS:job.seeds,REVIEW_QUERY:job.query,
  REVIEW_CAPTURE:mode==='smoke'?'1':'0',REVIEW_SMOKE:mode==='smoke'?'1':'0',REVIEW_PROFILE:'0',REVIEW_RESUME:'1',
 }})
 if(result.error||result.status!==0)throw result.error||Error(`Migration flight failed: ${job.course}`)
}

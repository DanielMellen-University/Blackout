// Functional regression only. Do not tune these older missions in this batch.
import {spawnSync} from 'node:child_process'
for(const [course,seed]of [['training-orbit',1],['contour-circuit',42],['weather-approach',619],['range-sweep',2],['precision-slalom',3],['volcanic-run',8]]){
 const r=spawnSync(process.execPath,['scripts/review-generator.mjs'],{stdio:'inherit',env:{...process.env,REVIEW_PART:'polish-legacy',REVIEW_COURSE:course,REVIEW_SEEDS:String(seed),REVIEW_CAPTURE:'1',REVIEW_SMOKE:'1',REVIEW_PROFILE:'0'}})
 if(r.error||r.status!==0)throw r.error||Error(`Older mission failed: ${course}`)
}

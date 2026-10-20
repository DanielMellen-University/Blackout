// Sequential flights only. Timing and visual runs use separate browser sessions.
import { spawnSync } from 'node:child_process'
const themes = ['desert-run','mountain-valley-run','coastal-island-run','generated-volcanic-run']
const selected = (process.env.POLISH_THEMES || themes.join(',')).split(',')
for (const course of selected) {
 if (!themes.includes(course) && process.env.POLISH_LEGACY !== '1') throw Error(`Unapproved theme: ${course}`)
 const child = spawnSync(process.execPath,['scripts/review-generator.mjs'],{
  stdio:'inherit',env:{...process.env,REVIEW_COURSE:course,REVIEW_CAPTURE:process.env.REVIEW_CAPTURE || '0',REVIEW_PART:process.env.REVIEW_PART || 'polish-proof',REVIEW_SEEDS:process.env.REVIEW_SEEDS || '42,1337,9001'},
 })
 if(child.error || child.status!==0)throw child.error || Error(`Flight failed: ${course}`)
}

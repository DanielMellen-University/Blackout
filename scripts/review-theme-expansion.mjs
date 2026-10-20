// Run sequentially so local browser measurements do not compete with each other.
import { spawnSync } from 'node:child_process'
const matrix = [
 ['coastal-island-run', '1337,2026,9001'],
 ['generated-volcanic-run', '1337,2026,9001'],
 ['desert-run', '42'],
 ['mountain-valley-run', '42'],
]
for (const [course, seeds] of matrix) {
 const child = spawnSync(process.execPath, ['scripts/review-generator.mjs'], {
  stdio: 'inherit', env: { ...process.env, REVIEW_PART: 'expansion-completion', REVIEW_SMOKE: '0', REVIEW_COURSE: course, REVIEW_SEEDS: seeds },
 })
 if (child.error || child.status !== 0) throw child.error || Error(`Flight review failed: ${course}, ${child.status ?? child.signal}`)
}
const summary = spawnSync(process.execPath, ['scripts/summarize-theme-expansion.mjs'], {
 stdio:'inherit', env: { ...process.env, REVIEW_PART: 'expansion-completion' },
})
if (summary.error || summary.status !== 0) throw summary.error || Error('Completion evidence validation failed')

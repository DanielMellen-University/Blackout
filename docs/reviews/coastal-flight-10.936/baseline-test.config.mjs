import {defineConfig} from 'vitest/config'
import {execFileSync} from 'node:child_process'
const baseline=execFileSync('git',['show','24530be:src/world/TerrainSystem.ts'],{encoding:'utf8'})
export default defineConfig({plugins:[{name:'baseline',enforce:'pre',transform(code,id){if(id.endsWith('/world/TerrainSystem.ts'))return baseline}}],test:{environment:'node',include:['tests/shorelineTransitions.test.ts']}})

import {createServer} from 'vite'
import {execFileSync} from 'node:child_process'
const root=process.cwd(),frozen=Object.fromEntries(['TerrainSystem','TerrainSeams','TerrainGeometry'].map(n=>[n,execFileSync('git',['show',`24530be:src/world/${n}.ts`],{cwd:root,encoding:'utf8'})]))
const server=await createServer({root,cacheDir:'/tmp/blackout-baseline-936-cache',server:{host:'127.0.0.1',port:5175},plugins:[{name:'frozen-coast',enforce:'pre',transform(code,id){for(const[n,s]of Object.entries(frozen))if(id.endsWith(`/world/${n}.ts`))return s}}]})
await server.listen();console.log('baseline 5175')

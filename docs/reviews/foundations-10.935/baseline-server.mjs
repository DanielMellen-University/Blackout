import {createServer} from 'vite'
import {execFileSync} from 'node:child_process'
const root=process.cwd()
const frozen=Object.fromEntries(['SettlementSystem','SurfaceDraper'].map(n=>[n,execFileSync('git',['show',`a8eb582:src/world/${n}.ts`],{cwd:root,encoding:'utf8'})]))
const server=await createServer({root,cacheDir:'/tmp/blackout-baseline-935-cache',server:{host:'127.0.0.1',port:5174},plugins:[{name:'frozen-foundations',enforce:'pre',transform(code,id){for(const [n,s]of Object.entries(frozen))if(id.endsWith(`/world/${n}.ts`))return s}}]})
await server.listen();console.log('baseline 5174')

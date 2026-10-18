import {readFileSync,writeFileSync} from 'node:fs';import{gunzipSync}from'node:zlib';
const data=JSON.parse(gunzipSync(readFileSync(process.argv[2]))),self=new Map(),owners=new Map();let total=0;
function visit(node,owner='(native)'){
 const f=node.callFrame,name=f.functionName||'(anonymous)',url=(f.url||'').replace(/^.*\/src\//,'src/').replace(/\?.*$/,'');
 if(url.startsWith('src/')&&!/scripts\//.test(url))owner=name+' '+url+':'+(f.lineNumber+1);
 const key=name+' '+url+':'+(f.lineNumber+1),bytes=node.selfSize||0;total+=bytes;
 self.set(key,(self.get(key)||0)+bytes);owners.set(owner,(owners.get(owner)||0)+bytes);
 for(const child of node.children||[])visit(child,owner);
}visit(data.head);
const rank=m=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,60).map(([name,bytes])=>({name,bytes,MB:Math.round(bytes/1e4)/100}));
const out={note:'Sampled allocation volume including collected objects, not live heap or acceptance',total,owners:rank(owners),self:rank(self)};writeFileSync(process.argv[3],JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({totalMB:total/1e6,owners:out.owners.slice(0,22),self:out.self.slice(0,16)},null,2));

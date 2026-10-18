// Compute strong-edge immediate dominators (Lengauer-Tarjan) from a V8 snapshot.
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
const filename = process.argv[2]
if (!filename) throw Error('Pass a .heapsnapshot.gz file')
const h = JSON.parse(gunzipSync(await readFile(filename)))
const nf = h.snapshot.meta.node_fields, ef = h.snapshot.meta.edge_fields
const ns = nf.length, es = ef.length, nodes = h.nodes, edges = h.edges, strings = h.strings
const type = nf.indexOf('type'), name = nf.indexOf('name'), size = nf.indexOf('self_size'), count = nf.indexOf('edge_count')
const et = ef.indexOf('type'), to = ef.indexOf('to_node'), en = ef.indexOf('name_or_index')
const types = h.snapshot.meta.node_types[type], edgeTypes = h.snapshot.meta.edge_types[et], weak = edgeTypes.indexOf('weak')
const n = nodes.length / ns, first = new Uint32Array(n + 1), order = new Uint32Array(n), vertex = new Uint32Array(n + 1), parent = new Uint32Array(n + 1)
for (let v=0;v<n;v++) first[v+1]=first[v]+nodes[v*ns+count]*es
const stack=[0], cursor=[first[0]];let reached=1;order[0]=1;vertex[1]=0
while(stack.length){const i=stack.length-1,v=stack[i];let e=cursor[i];while(e<first[v+1] && (edges[e+et]===weak || order[edges[e+to]/ns]))e+=es
 if(e>=first[v+1]){stack.pop();cursor.pop();continue}cursor[i]=e+es;const w=edges[e+to]/ns;order[w]=++reached;vertex[reached]=w;parent[reached]=order[v];stack.push(w);cursor.push(first[w])}
const pc=new Uint32Array(reached+2)
for(let v=0;v<n;v++)if(order[v])for(let e=first[v];e<first[v+1];e+=es)if(edges[e+et]!==weak && order[edges[e+to]/ns])pc[order[edges[e+to]/ns]+1]++
for(let i=1;i<pc.length;i++)pc[i]+=pc[i-1]
const pred=new Uint32Array(pc.at(-1)),fill=pc.slice()
for(let v=0;v<n;v++)if(order[v])for(let e=first[v];e<first[v+1];e+=es)if(edges[e+et]!==weak){const w=order[edges[e+to]/ns];if(w)pred[fill[w]++]=order[v]}
const semi=new Uint32Array(reached+1),label=new Uint32Array(reached+1),ancestor=new Uint32Array(reached+1),idom=new Uint32Array(reached+1),head=new Uint32Array(reached+1),next=new Uint32Array(reached+1)
for(let i=1;i<=reached;i++)semi[i]=label[i]=i
const path=[]
function evaluate(v){if(!ancestor[v])return label[v];path.length=0;let x=v;while(ancestor[ancestor[x]]){path.push(x);x=ancestor[x]}for(let i=path.length-1;i>=0;i--){x=path[i];const a=ancestor[x];if(semi[label[a]]<semi[label[x]])label[x]=label[a];ancestor[x]=ancestor[a]}return label[v]}
for(let w=reached;w>=2;w--){for(let i=pc[w];i<pc[w+1];i++){const u=evaluate(pred[i]);if(semi[u]<semi[w])semi[w]=semi[u]}next[w]=head[semi[w]];head[semi[w]]=w;ancestor[w]=parent[w];let v=head[parent[w]];head[parent[w]]=0;while(v){const u=evaluate(v);idom[v]=semi[u]<semi[v]?u:parent[w];v=next[v]}}
for(let w=2;w<=reached;w++)if(idom[w]!==semi[w])idom[w]=idom[idom[w]]
const retained=new Float64Array(reached+1),totals={}
for(let w=1;w<=reached;w++){const v=vertex[w],bytes=nodes[v*ns+size],t=types[nodes[v*ns+type]];retained[w]=bytes;totals[t]=(totals[t]||0)+bytes}
for(let w=reached;w>1;w--)retained[idom[w]]+=retained[w]
const desc=w=>{const v=vertex[w];return {node:v,id:nodes[v*ns+nf.indexOf('id')],type:types[nodes[v*ns+type]],name:strings[nodes[v*ns+name]].slice(0,160),selfBytes:nodes[v*ns+size],retainedBytes:retained[w]}}
const top=[];for(let w=2;w<=reached;w++)if(retained[w]>=100000)top.push(w);top.sort((a,b)=>retained[b]-retained[a])
const pathTo=w=>{const p=[];for(let i=0;w && i<15;i++,w=idom[w])p.push(desc(w));return p.reverse()}
const objects={};for(let w=1;w<=reached;w++){const d=desc(w);if(d.type==='object' && !['Object','Array','system / Context'].includes(d.name)){const row=objects[d.name]||={count:0,selfBytes:0,largestRetainedBytes:0};row.count++;row.selfBytes+=d.selfBytes;row.largestRetainedBytes=Math.max(row.largestRetainedBytes,d.retainedBytes)}}
const bigNative=[];for(let w=2;w<=reached;w++){const d=desc(w);if(d.selfBytes>=100000)bigNative.push(w)}bigNative.sort((a,b)=>nodes[vertex[b]*ns+size]-nodes[vertex[a]*ns+size])
const moduleCaches=[], moduleNames=new Set(['Hydrology','RegionalDrainage','SettlementPlan','RiverSurface'])
const property=edgeTypes.indexOf('property')
for(let v=0;v<n;v++)if(order[v] && strings[nodes[v*ns+name]]==='Object')for(let e=first[v];e<first[v+1];e+=es){
 if(edges[e+et]!==property || !moduleNames.has(strings[edges[e+en]]))continue
 const module=strings[edges[e+en]], owner=edges[e+to]/ns
 for(let k=first[owner];k<first[owner+1];k+=es){
  const field=strings[edges[k+en]],target=edges[k+to]/ns
  if(edges[k+et]===property && ['cache','nodes','anchorCache'].includes(field) && order[target])moduleCaches.push({module,field,...desc(order[target])})
 }
}
const out={filename,moduleCaches,nodes:n,reached,totalStrongSelfBytes:retained[1],selfBytesByType:totals,objects:Object.entries(objects).sort((a,b)=>b[1].largestRetainedBytes-a[1].largestRetainedBytes).slice(0,80),largestDominators:top.slice(0,100).map(w=>({node:desc(w),dominatorPath:pathTo(w)})),largestAllocations:bigNative.slice(0,80).map(w=>({node:desc(w),dominatorPath:pathTo(w)}))}
await writeFile(filename.replace('.heapsnapshot.gz','.retainers.json'),JSON.stringify(out,null,2)+'\n')
console.log(JSON.stringify({totalMB:retained[1]/1e6,moduleCaches,objects:out.objects.slice(0,22),largest:out.largestAllocations.slice(0,12)},null,2))

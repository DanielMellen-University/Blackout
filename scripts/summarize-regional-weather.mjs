import { readFile, writeFile } from 'node:fs/promises'
const directory=process.argv[2]||'docs/reviews/weather-10.918'
const names=['weather-loop','weatherfront-low','weatherfront-high','weatherstorm-low','weatherstorm-high','weathersnow-low','weathersnow-high']
const rows=[], hashes=new Set(), lowModes=new Set()
const views=['| Still | Weather / seconds | Rain / snow | Buffet | Wind / rain / storm gain | Fog far km |', '| --- | --- | ---: | ---: | ---: | ---: |']
const quantile=(values,q)=>values.slice().sort((a,b)=>a-b)[Math.floor((values.length-1)*q)]
for(const name of names){
 const d=JSON.parse(await readFile(`${directory}/${name}.json`,'utf8'))
 hashes.add(d.sourceHash)
 if(d.errors.length||d.result.phase!=='finished'||d.result.seed!==1||d.result.distanceM!==(name==='weather-loop'?612000:81600)||d.result.quality!=='balanced'||d.result.ratioRange.join(',')!=='1,1'||d.result.viewport.join(',')!=='1280,720')throw Error('Incomplete/unmatched weather case '+name)
 if(d.samples.some(s=>!s.samePools||s.cloudCapacity.reduce((a,b)=>a+b,0)!==688||s.shaftCapacity!==16||s.audio.state!=='running'||!s.audio.sharedBrownBuffer))throw Error('Resource/audio mismatch '+name)
 if(d.samples.some(s=>Math.abs(s.audio.windMpsInput-s.weather.windMps)>.05))throw Error('Wind sound is not local '+name)
 if(name.endsWith('high')&&d.samples.some(s=>s.rainVisible||s.snowVisible||s.audio.rain>0||s.audio.storm>0||s.buffet>0||s.precipitationVisibility>0||s.layerExposure>0))throw Error('Effects persist above cloud top '+name)
 if(!name.endsWith('high')) for(const s of d.samples)lowModes.add(s.weather.id)
 const row={name,duration:d.result.seconds,distanceKm:d.result.distanceM/1000,camera:d.camera,
  modes:[...new Set(d.samples.map(s=>s.weather.id))],rain:Math.max(...d.samples.map(s=>s.weather.rain)),
  snow:Math.max(...d.samples.map(s=>s.weather.snow)),stormAudio:Math.max(...d.samples.map(s=>s.audio.storm)),
  windAudio:[Math.min(...d.samples.map(s=>s.audio.wind)),Math.max(...d.samples.map(s=>s.audio.wind))],
  peakHeapMB:d.result.heapBytes.peak/1e6,errors:d.errors,poolsStable:true,pictures:d.pictures}
 if(name==='weather-loop'){
  const early=d.samples.filter(s=>s.flightSeconds>=300&&s.flightSeconds<=420)
  const late=d.samples.filter(s=>s.flightSeconds>=780&&s.flightSeconds<=900)
  if(early.length<10||late.length<10)throw Error('Missing sustained memory windows')
  row.memory={method:'Unforced JS heap samples at 5-second wall-clock polling; lower decile of matched 300-420 and 780-900 simulation-second route phases after both directions warm. No GC is forced.',
   earlyLowerDecileMB:quantile(early.map(s=>s.heapBytes),.1)/1e6,lateLowerDecileMB:quantile(late.map(s=>s.heapBytes),.1)/1e6,
   earlyGeometryRange:[Math.min(...early.map(s=>s.rendererGeometries)),Math.max(...early.map(s=>s.rendererGeometries))],
   lateGeometryRange:[Math.min(...late.map(s=>s.rendererGeometries)),Math.max(...late.map(s=>s.rendererGeometries))],
   textureCounts:[...new Set(d.samples.map(s=>s.rendererTextures))],
   postWarmTextureCounts:[...new Set(d.samples.filter(s=>s.flightSeconds>=300).map(s=>s.rendererTextures))]}
  row.memory.changeMB=row.memory.lateLowerDecileMB-row.memory.earlyLowerDecileMB
  row.memory.flatWithin5MB=row.memory.changeMB<=5
 }
 for(const picture of d.pictures){const s=d.samples[picture.sample];views.push(`| [${picture.file}](${picture.file}) | ${s.weather.id} / ${s.flightSeconds.toFixed(1)} | ${s.weather.rain.toFixed(2)} / ${s.weather.snow.toFixed(2)} | ${s.buffet.toFixed(2)} | ${s.audio.wind.toFixed(3)} / ${s.audio.rain.toFixed(3)} / ${s.audio.storm.toFixed(3)} | ${(s.fog.far/1000).toFixed(2)} |`)}
 rows.push(row)
}
if(hashes.size!==1)throw Error('Weather review source differs between cases')
for(const id of ['clear','cloudy','overcast','fog','rain','storm','snow','blizzard'])if(!lowModes.has(id))throw Error('Missing regional condition '+id)
await writeFile(`${directory}/summary.json`,JSON.stringify({sourceHash:[...hashes][0],lowModes:[...lowModes],rows},null,2)+'\n')
const table=['| Route | Seconds / km | Camera | Regional conditions | Peak heap MB |','| --- | ---: | --- | --- | ---: |',
 ...rows.map(r=>`| ${r.name} | ${r.duration.toFixed(0)} / ${r.distanceKm.toFixed(1)} | ${r.camera} | ${r.modes.join(', ')} | ${r.peakHeapMB.toFixed(1)} |`)]
await writeFile(`${directory}/measurements.md`,table.join('\n')+'\n')
await writeFile(`${directory}/views.md`,views.join('\n')+'\n')
console.log(table.join('\n'));console.log(JSON.stringify(rows[0].memory,null,2))

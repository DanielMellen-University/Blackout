// Isolated browser main-thread CPU reproduction, not a rendered game flight.
import { writeFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try {
  const page = await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
  await page.route('**/perf11-cpu', r => r.fulfill({contentType:'text/html',body:'<!doctype html><title>Hydrology CPU measurement</title>'}))
  await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5174'}/perf11-cpu`)
  const result = await page.evaluate(async () => {
    const {setWorldSeed}=await import('/src/world/noise.ts')
    const {setTerrainProfile}=await import('/src/world/TerrainProfile.ts')
    const {prepareHydrologyInBoundsSteps}=await import('/src/world/Hydrology.ts')
    const {sampleTerrainSurfaceHeightFast,clearOpsPad}=await import('/src/world/terrainSample.ts')
    const {TerrainReviewSurvey}=await import('/scripts/lib/terrain-review-survey.ts')
    const drain = steps => { while (!steps.next().done) {} }
    const reset = () => {
      clearOpsPad();setTerrainProfile(null);setWorldSeed(1338)
      const p=prepareHydrologyInBoundsSteps(56063,34982,56063,34982);p.next();p.return();setWorldSeed(1337)
      drain(prepareHydrologyInBoundsSteps(56063,34982,56063,34982))
    }
    const nextFrame=()=>new Promise(requestAnimationFrame)
    const longTasks=[]
    const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration}))))
    observer.observe({type:'longtask',buffered:true})
    const cases=[]
    for(const mode of ['before','after']) for(let i=0;i<8;i++) {
      reset(); await nextFrame()
      const start=performance.now(),slices=[]
      let target
      if(mode==='before') {
        target=Math.max(...[0,500,1000,1800,3000,4500,6000,8000].map(d=>sampleTerrainSurfaceHeightFast(56063+d,34982)+650-d*.025))
        slices.push(performance.now()-start)
      } else {
        const survey=new TerrainReviewSurvey()
        while((target=survey.sample(56063,34982,Math.PI/2,650,[0,500,1000,1800,3000,4500,6000,8000]))===null) {
          await nextFrame();const t=performance.now();survey.advance();slices.push(performance.now()-t)
        }
        survey.reset()
      }
      const end=performance.now()
      await nextFrame();await new Promise(resolve=>setTimeout(resolve,0))
      cases.push({mode,sample:i,start,end,target,wallMs:end-start,cpuMs:slices.reduce((a,b)=>a+b,0),maxSliceMs:Math.max(...slices),slices:slices.length,longTasks:longTasks.filter(t=>t.start>=start-1&&t.start<end)})
    }
    observer.disconnect()
    return {browser:navigator.userAgent,method:'Isolated browser CPU test, no game rendering. Eight before then eight after cold (2,1) queries with (1,1) warm; after advances once per native RAF. Long Tasks include callback overhead. Warmup/JIT can affect both groups. Not FPS or b19 endurance acceptance.',cases}
  })
  await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n')
  console.log(process.argv[2])
} finally {await browser.close()}

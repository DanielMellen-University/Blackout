# Controlled streaming review, 10.914

The twelve render-matched flights establish **no FPS or heap improvement**.
p95 remains 33.4 ms. Total >50 ms hitches increase from 48 to 62, and the worst
flight interval increases from 516.7 to 683.2 ms. City peak heap increases from
176.1 MB to 201.4 MB. Mean frame intervals also do not improve consistently.
These are observed results, not proof that either code change caused the
variation. No speedup, memory win or closed performance acceptance is claimed.

See [every acceptance run](measurements.md), [comparison fields](summary.json),
and the raw `before/` and `after/` JSON records. Source-level work removal and
CPU attribution are separate from rendered-frame acceptance.

Peak counts match in all three baseline and all three candidate runs of each
route. Four terrain workers remain active throughout the recorded endpoints.
Full queue and resource timelines remain in each JSON file.

| Route | Peak settlements | Buildings | Regional roads | Settlement queue |
| --- | ---: | ---: | ---: | ---: |
| Seed-1337 city | 2 | 1,238 | 1 | 11 |
| Seed-73 northeast | 3 | 848 | 1 | 12 |

Base: `a5ca12a`, chunk 10.913. Production geometry, terrain and water generation,
collision, render distances, worker counts, upload deadlines, draw families and
instance limits are held constant. Paused systems remain excluded.

## Method

Each acceptance run uses a fresh headless Chromium browser and context, a
1280 x 720 viewport and drawing buffer, device scale 1, fixed pixel ratio 1,
Balanced quality, the chase camera, normal automatic weather and the complete
production flight/render loop. Travel is prescribed at 680 m/s for 120 simulation
seconds, or 81.6 km. Startup coverage, flight wall time and real RAF intervals
are retained separately. The recorder excludes explicit paused/hidden time and
keeps visible hitches. There are three runs of each route before and after.

The city route is seed 1337, from (18000, 5000, 35000) eastward. The original
northeast route is seed 73, from (0, 5000, 0). These are the existing review
trajectories. A trial using seed 1337 on the northeast route crashed against
high terrain at 29.35 seconds. `rejected-world-seed1337.json` preserves that
incomplete trial. It contributes no acceptance statistics. Collision and the
route altitude were preserved; seed 73 matches the historical northeast review.

Chromium 153 uses ANGLE Vulkan on Intel Xe Graphics, recorded in every run.
The default headless software-rendering path was detected during setup and
excluded. No build, tests or second profiling browser ran alongside acceptance
measurements. Separate CPU captures and method timers are diagnostic runs and
are excluded from the before/after frame results.

`before/` and `after/` contain complete JSON records, raw startup/flight intervals,
heap start/end/peak, resource samples, current/peak settlement/building/road/queue
counts, browser flags and instrumentation hashes. Source manifests identify all
source files as measured, before the release-only Version metadata bump to
10.914. `measurements.md` presents every run; `summary.json` retains the
comparison fields without discarding outliers. Hitches use strict >50 and >100 ms
thresholds. MB means decimal megabytes. Browser heap is optional platform
telemetry, not process RSS or GPU memory.

## Reproduction

The baseline is `a5ca12a` plus `before/instrumentation.patch.gz`. That patch adds
measurement only, with no production optimization. Its TypeScript parameter
property was expanded to an explicit field/assignment for the candidate to
satisfy `erasableSyntaxOnly`. The served JavaScript, excluding source maps and trailing blank lines, is
byte-identical: `before/AdaptiveResolution.runtime.js` and the corresponding
`after/` file both hash to
`872be0ebc3bcfeb1211ffdf60328554f72a308cfbd8aa98fe70138eeae842485`.
The validator checks each source fingerprint and this runtime identity before
normalizing that one source-spelling difference in its environment comparison.

Start `npm run dev -- --host 127.0.0.1`. Set `PLAYWRIGHT_MODULE` to the installed
Playwright `index.mjs`, and optionally `CHROMIUM_PATH` to its Chromium binary.
Run `node scripts/profile-flight.mjs before` on the baseline and the same command
with `after` on the candidate. The harness refuses software rendering and
rejects incomplete or mismatched runs. It resumes existing completed records;
use a fresh label/directory for a new experiment.

For diagnostic captures, set `REVIEW_PROFILE=1 REVIEW_RUNS=1` and use a separate
label. `node scripts/profile-dense.mjs dense-before` captures cold city loading
and a stationary loaded core. `node scripts/summarize-flight-profiles.mjs DIR`
extracts sampled CPU self/inclusive rankings from the compressed DevTools
profiles. `node scripts/summarize-flight-runs.mjs` checks the twelve acceptance
records, raw sample counts, p99 and matching environment before writing tables.

The development server can version module URLs after an edit. The final timer
installer instruments the actual loaded class modules, including versioned URLs,
and checks installation before launch and recorded calls at completion. The
initial post-change city CPU-only capture is retained in
`profile-after-uninstrumented/`; it missed the method hooks and is excluded from
the publication-timer comparison. Its acceptance status never contributed to
the twelve uninstrumented route results.

Diagnostic method timers overlap because callers include children. Do not add
their totals. The road publication audit deliberately compares positions against
a diagnostic copy; its cost and memory are excluded from acceptance runs.
CPU profiles describe main-thread samples, including idle, native and compilation
work; they do not directly measure worker CPU or GPU execution.

## Baseline profile findings

The complete city CPU capture attributes about 3.76 s of sampled self time to
`updateMatrixWorld` and 2.41 s to `multiplyMatrices`. The scene's automatic
identity update forced every streamed subtree on each render. The candidate
keeps the identity scene and static stream roots quiet, initializes settlement
local matrices at attachment, and preserves ordinary world-matrix invalidation.
A late terrain tile resolves its world matrix after joining its parent.
Dynamic children retain their normal updates.

The city road audit found 172 unchanged publications among 276 total; northeast
found 458 among 575. Audited normal rebuilds took 1.48 s and 1.77 s respectively,
including audit overhead. Draping still samples the same vertices within the
same 1,024-vertex / 0.8 ms budget. The candidate compares heights in Float32
precision and skips position uploads, normal rebuilds and bounds rebuilds when
the completed mesh is unchanged. Dirty state persists across suspended batches;
actual changes still publish atomically.

Terrain attachment itself is relatively small per result: city `buildChunk`
attached 10,781 tiles in 835.5 ms total, with a 5.5 ms maximum; northeast attached
11,105 in 860.9 ms, with a 10.8 ms maximum. These are indivisible calls inside
the unchanged 2 ms / 16-upload frame allowance, not hard 2 ms guarantees.
Synchronous settlement assembly reached 52.9 ms in the city capture and 56 ms
in northeast; regional road assembly reached 62 and 66.5 ms. These allocation
and geometry-construction spikes remain further work. Worker dispatch stayed
small and the existing settlement worker remained active.

The cold city trace contains a 1.65 s main-thread module-evaluation span.
Spawn/protected-site planning contributes to startup CPU. Initialization also
constructs a default random world before applying the requested replay seed;
therefore the initial module/airfield timing is diagnostic rather than a fully
fixed-seed startup benchmark. The timed flight and launch-to-coverage route use
the requested fixed seed. Long worker spans, including a 772 ms message, belong
to dedicated worker threads and must not be reported as main-thread hitches.
Compilation/background optimization, renderer submission and native work remain
in the raw traces. `(program)` CPU samples are not a direct GPU-time measure.

## Post-change CPU findings

The city diagnostic records 112 drape publications and zero unchanged ones,
versus 276 / 172 before. Audited normal rebuild time is 561.3 ms, versus
1,482.1 ms; total audited drape time is 1,558.7 ms, versus 2,559.9 ms.
The captures contain 4,642 and 4,592 settlement updates respectively.
Sampled city matrix-multiply self time is about 0.53 s versus 2.41 s;
world-matrix update self time is 2.73 s versus 3.76 s. These observations
confirm removal of redundant CPU work, and do not override the rendered-frame
and heap results above. Regional road attachment still takes 39.7 ms in the city capture and 124.1 ms
in northeast, so indivisible attachment is not solved. Northeast drape
publications fall from 575 / 458 unchanged to 119 / zero unchanged; audited
normal rebuild time falls from 1,773.7 to 425.3 ms, while the longest changed
mesh rebuild still reaches 24.9 ms. Sampling budgets are not whole-update
deadline guarantees.

## Visual verification

The [baseline core](dense-before/dense.png) and [candidate core](dense-after/dense.png)
retain the same apartment review pose at 94 m AGL, 1,196 buildings, 370 draws and
293k triangles. The skyline, road placement and ground surfaces remain present.
Both captures have empty page-error logs. The city-core renderer fixture is
separate from the full-game acceptance recorder.

Inspected [low-altitude chase](views/city-chase.png) and
[first-person](views/city-first.png) stills follow the actual loaded seed-1337
`0,0|1,1` road at 3.10 km of its 31.05 km profile and 90 m clearance. The fixture
has three loaded settlements, 1,301 buildings and three regional roads, with an
empty page-error log. Roads remain visible and continuous, water and terrain
remain present, and both production camera modes resolve the placed scene.
These prescribed poses are visual checks, not a manual flight or full
triangle-interior/live-transition contact acceptance.

## Local verification

All 114 checks pass across `flightReview`, `adaptiveResolution`, `surfaceDraper`,
`terrainStreaming`, `settlementRendering`, `worldLifecycle`, `generatedRoadContact`
and `settlementBudget`. Coverage includes hidden/pause exclusion and bounded
recorder samples, unchanged Float32 uploads, dirty-state persistence across
suspended batches, dynamic transforms, explicit parent invalidation, late tile
attachment, generated far/near/far contact and fixed settlement budgets.

`npm run build` passes version synchronization, TypeScript and production Vite
compilation. The existing Three.js bundle-size warning remains. The twelve-run
validator passes environment, source/runtime instrumentation and raw-frame p99
checks. Full-suite, physical-device, long-session and workerless-throughput
acceptance were not run. No manual GitHub Actions workflow was triggered.

## Acceptance limits

These are short prescribed flights on one desktop GPU and browser, not handling
playthroughs or long-session memory acceptance. Worker completion order and GC
can change instantaneous resident counts. The fixed budgets and completed
routes matter more than identical asynchronous queue snapshots. A smaller
single maximum is insufficient evidence of a general speedup.

The worst intermittent hitch in the uninstrumented route records is not
causally attributed by these separate diagnostic captures. Initial random-world
construction and GC state also limit startup/heap comparison. Do not infer a
memory leak fix, a startup win, or a hardware-wide performance conclusion.

Coastal connectivity, rough/coastal artwork, triangle-interior road contact and
live near/far transition acceptance remain open under Part B. Physical-device
coverage, sustained memory behavior, and broader weather/landmark coverage also
remain open. No paused system is future work.

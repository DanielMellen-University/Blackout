# 10.922 verified CPU work, northeast heap acceptance still fails

Base: `a104e5d`, shipping 10.921. This checkpoint keeps demonstrated CPU and allocation improvements and drops the shared fallback-material, quad-merging, scheduler-map and custom sort experiments. It does **not** complete Part B's northeast memory requirement. No detail, draw distance, geometry count, collision surface, worker/upload limit, settlement/profile cap or other budget is reduced. Landscape revision stays 28. Every paused system stays excluded.

## Final matched flights

Three fresh browsers per route on each side, Balanced, 1280 x 720, fixed pixel ratio 1, production chase camera, 120 simulation seconds at 680 m/s, 81.6 km. Seed 1337 uses the city route; seed 73 uses the northeast route. The inherited before set measures frozen 10.921; the final after set measures the retained candidate with source hashes in each directory. The summarizer verifies identical browser, GPU, arguments, instrumentation, settings and workload. Flights run alone without tests, builds or a second profiling browser. Images are captured after timing finishes. Baseline and candidate are separate sessions, so uncontrolled host/driver variation remains a limitation.

| Metric across six flights | Before | After | Historical target |
| --- | ---: | ---: | ---: |
| Intervals strictly over 50 ms | 92 | 38 | <=51 |
| Intervals strictly over 100 ms | 0 | 1 | <=1 |
| Maximum interval ms | 66.8 | 400.0 | 250.0 historical before |
| City peak main JS heap MB | 204.1 | 184.4 | <=184.9 |
| Northeast peak main JS heap MB | 202.8 | 214.7 | <=155.4 |

Northeast after peaks are 201.2, 181.3 and 214.7 MB. City peaks are 181.1, 184.4 and 133.2 MB. Keep the low city peak and the high northeast peak equally: neither is discarded. The northeast result is worse than the fresh baseline and remains above the original 155.4 MB target. Historical 10.917 reached 217.8 MB. This is not an overall heap or FPS acceptance result.

All p95 values remain 33.4 ms. The 400 ms city-3 flight interval has no dominant captured main-thread phase; its largest measured method contribution is only 0.19 ms. The bounded trace/CPU evidence does not establish its cause. An after world-3 startup interval also contains 103.4 ms of staged attachment. Both remain in the evidence. Do not attribute unresolved gaps to GC or the GPU by exclusion.

`measurements.md`, `summary.json`, all twelve complete flight JSON records, CPU profiles and bounded hitch traces retain the raw measurements. Complete timelines stay local under the review .gitignore. Main JS heap telemetry is not worker memory, RSS or VRAM. These two-minute flights do not prove sustained memory acceptance.

## Changes retained and measured

- Reuse fixed road clipping workspace and a numeric Float32-identity weld table instead of allocating polygon arrays and coordinate strings per triangle. Four independent flat, rough, soil and translated road buffer hashes remain identical. Warm fitter medians in the final CPU-only run change from 19.803/62.759/61.078/61.135 ms to 19.618/12.967/12.874/12.159 ms. Original 3,027-vertex long flat-road coverage remains tested. Quad merging is removed, retaining the original triangulation.
- Cache squared/normalized biome blends under weak ownership, validating mutable arrays before reuse. Share the repeated 520 m noise sample within each color call. In the final isolated CPU diagnostic, 1,200 cached-color evaluations fall from **1.911 to 1.101 ms**, about 42%. Pure palettes, boundary samples and all six non-color terrain/water payload digests remain identical. This is color CPU cost, not frame rate. The inherited 2.014 to 1.017 ms warm comparison remains archived. Short-warmup and concurrent diagnostic timings are retained with their limitations, not used as final isolated measurements.
- Reuse exact Float32 indexed normal accumulation for road refits and skip height interpolation when the immutable contact tile owner has not changed. Preserve atomic publication and the 1,024-vertex/0.8 ms refit limits. Direct byte comparisons, owner replacement/reseed and interleaved/cancelled behavior remain covered. Use synchronous landform scratch in drainage probes.
- Reuse immutable patched shader source, keeping uniforms independent. Share entering opaque water until a private fallback depth bias is needed. Retain fixed back/front near-terrain fade passes sharing one geometry, and single-pass additive exhaust/traffic silhouettes. These remove repeated material-side invalidation without changing visible coverage. The actual production-material pixel comparison checks exhaust, traffic, fading ground and fallback ground against 10.921. Shared fallback materials themselves are removed; resumed private state is explicitly disposed.

The first city pair also reduces measured drape CPU from 1,466 to 752 ms and road assembly from 809 to 387 ms over the route. These are method totals including normal workload variation, not a universal speedup claim.

## Experiments rejected and verification

`candidate-1` through `candidate-7` retain every completed exploratory flight and its source manifest; `experiments.json` indexes them. All northeast candidates miss 155.4 MB. In particular, the final inherited shared-fallback candidate reaches 186.2 MB. Allocation and heap-burst diagnostics remain diagnostic only, including any post-flight forced GC, which is outside every acceptance run. No production GC forcing is added.

The shared fallback and quad-merging experiments are dropped. Custom sorting and desired-map reuse are also dropped because the exploratory comparisons do not demonstrate a sufficient independent benefit. The verified fitter scratch, color reuse, normal/refit reuse and material/source work remain, with the unsuccessful final heap result stated above.

The retained focused set passes 142 checks, with another 120 terrain payload/LOD, hydrology, world lifecycle, paused-system and release checks passing. The production build passes. All eleven material-view raw pixel hashes equal 10.921; repeated side invalidations drop from twenty to zero per ten draws in the affected passes. The full suite was already run for Part A and is left to CI here. `views/` contains inspected production chase/cockpit city-road stills at 90 m clearance, with no page errors: the road, shoreline, terrain and aircraft remain visible. These fixed poses do not constitute manual handling acceptance. Broader terrain/biome review proceeds separately; northeast heap, the 400 ms gap and sustained/workerless acceptance remain open.

## Reproduction

Use the installed Playwright module and Chromium through `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`. Start Vite on 127.0.0.1:5173; use `REVIEW_DIRECTORY=docs/reviews/performance-10.922 REVIEW_PROFILE=1 REVIEW_TRACE=1 REVIEW_CAPTURE=1 node scripts/profile-flight.mjs LABEL`. Use `scripts/attribute-flight-hitches.mjs` on each stage, then `scripts/summarize-hitch-runs.mjs` on the review root. Capture views separately with `scripts/capture-performance-views.mjs`.

For isolated CPU runs, close review browsers. Use `COLOR_WARMUP_RUNS=32 COLOR_SAMPLE_RUNS=31 node scripts/review-biome-materials.mjs OUTPUT.json`, supplying the frozen sampler through `TERRAIN_BASELINE_SOURCE` for before. Use `scripts/review-road-fit.mjs` with `ROAD_FIT_BASELINE_SOURCE` for the frozen road fitter. Raw records preserve every warmup and timed sample.

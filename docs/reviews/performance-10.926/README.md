# 10.926 northeast heap and hitch review

This review starts from frozen 10.925 runtime code. The README-only follow-up `ba1fe2b` has the same runtime as `d0b4a6c`. The retained candidate removes demonstrated allocation churn and lowers small-stall counts. It does not meet the 155.4 MB northeast target or complete overall performance/sustained-memory acceptance.

## Retainer and allocation evidence

`snapshot-flight-heap.mjs` flies the seed-73 northeast route at the same 680 m/s, 1280 x 720, pixel ratio 1 and Balanced settings. It arms a pause when a frame exceeds 160 MB after the requested minimum simulation time, captures the pre-snapshot inventory and takes a V8 heap snapshot. The first valid trigger occurs at 8.13 simulation seconds and 161.6 MB; a subsequent inventory read is 162.0 MB. Snapshot collection reduces the reported heap to 75.6 MB. The later armed window never reaches 160 MB and is explicitly a completed-flight fallback capture at 120 seconds, 107.0 MB before and 70.7 MB after collection. File suffixes identify the requested arming times, not necessarily the actual capture times. These diagnostic flights force GC and are excluded from all acceptance metrics.

The first inventory deduplicates ArrayBuffer ownership and ranks resident application buffers: other geometry 9.19 MB, terrain geometry 8.31 MB, water geometry 6.26 MB, drape owners 1.59 MB, contact grids 1.03 MB and drape staging 0.79 MB. At the finish those buffers total 19.26 MB, with no remaining drape staging at that location. This is main-thread resident data, not worker memory, process RSS or GPU/driver memory.

The strong-edge dominator summaries separately expose development source retention: the bundled Three.js script retains 16.02 MB, including its external source and inline source map. The drainage map exclusively retains about 2.26 MB and the hydrology map about 0.111 MB. Aliased settlement plans are not exclusively dominated by their cache, so its small dominator total is not their total footprint. The draper and contact-map retainers are also smaller than aggregate geometry buffers; the first snapshot contains 7,646 drainage nodes, nine hydrology catchments and two settlement-plan cache entries. The largest individual DataTexture dominator is about 0.066 MB and the shader-source cache about 0.016 MB. These values have different ownership scopes and must not be added to inventory totals. Development source and source maps are left intact, and no cache cap or visible geometry is cut to meet a benchmark.

The sampled allocation profile includes collected objects. It estimates 14.41 GB of allocation over the diagnostic flight, dominated by `queueEdgeJoins` at 6.60 GB, `joinTerrainEdges` at 3.74 GB and `edgeSample` at 2.16 GB. This is allocation volume, not retained heap. Together with the large collection drop it identifies seam churn, rather than a growing hydrology or texture cache, as the first optimization target. Exact allocation totals are sampling estimates and are affected by instrumentation and the diagnostic pauses.

## Candidate and invariants

The neighbor scan now reads existing chunk bounds directly. It constructs geometry/contact views only for an actual shared edge, avoiding per-neighbor wrapper objects. Seam publication reuses synchronous numeric staging arrays and six fixed edge samples. Logical lengths control copies into privately owned typed attributes and indices, so a smaller subsequent publication cannot expose stale tails or change an earlier tile. Repeated samples and per-triangle/per-interval temporary arrays are removed. The workspace retains numbers only, never a tile, geometry, material or contact owner.

The 35 measured tile pairs from 10.924 have identical complete attribute/index hashes and identical restored-skirt hashes against frozen 10.925, including non-nested and partially wet joins. Existing seam/retirement/attachment-cap checks and new published-buffer ownership and distant-neighbor payload checks pass. The ten focused files pass 123 checks; the production build passes. All configured terrain/road/profile/support/worker/upload/drape limits, contact grids, water, draw counts, landscape revision 28 and paused exclusions remain unchanged.

## Capture integrity

The initial `heap-worker-hook-pilot` is invalid because its inspection hook ran in workers and triggered fallback generation. Its zero-worker inventory is preserved; that snapshot is not used for conclusions. The corrected hook is window-guarded and every valid snapshot asserts four terrain workers.

A between-flight stop intended for the README CI correction left an old profiling process alive. Two second-city attempts overlapped, including the maintenance checks, and are rejected under `overlap-pilot`. Their partial records are excluded. The first completed city and northeast captures preceded the overlap and remain valid. The remaining baseline and all candidate measurements run in one sequential queue. No tests, builds, CPU survey, heap snapshot or second review browser runs during an accepted flight.

Graphics/scheduler tracing is requested across each flight for fresh attribution without allocation sampling or forced GC in acceptance runs. Their extra instrumentation differs from the older 10.922 review, so the current before/after sets must be compared with each other. The full returned timelines remain local under the review ignore rule; bounded multi-thread hitch excerpts, complete flight JSON, CPU profiles and source manifests are published. Extraction records flag incomplete coverage for before city-1, city-2 and northeast-2; all six after traces have complete RAF coverage. They explicitly flag incomplete trace coverage where the capture buffer omits part of the flight. Complete RAF interval arrays remain available independently. Bounded startup events are attributable, but absent native events in an omitted tail cannot establish a cause. The final comparison and remaining limits follow below.

## Final matched flights

Three fresh browsers per route on each side fly 120 simulation seconds and 81.6 km at 680 m/s, Balanced, production chase camera, 1280 x 720 and fixed pixel ratio 1. Every complete run is retained. `measurements.md` contains the full per-run table and `summary.json` the checked records. Before and after run in separate sessions, so host and driver variation remains a limitation.

| Metric across six flights | Before | After | Historical target |
| --- | ---: | ---: | ---: |
| Pooled mean interval ms | 29.9 | 31.3 | n/a |
| Intervals strictly over 50 ms | 496 | 313 | <=51 in the earlier instrumentation |
| Intervals strictly over 100 ms | 0 | 0 | <=1 |
| Maximum interval ms | 83.4 | 83.4 | 250.0 historical before |
| City peak main JS heap MB | 222.7 | 223.2 | <=184.9 |
| Northeast peak main JS heap MB | 201.6 | 190.8 | <=155.4 |

The pooled mean worsens from 29.9 to 31.3 ms. Pooled P95 remains about 50 ms under the expanded graphics/scheduler instrumentation; the last after northeast run individually reaches 33.5 ms. The complete per-run table also retains slower city means, so lower small-stall counts are not an overall FPS win. The city after peaks are 223.2, 213.0 and 148.2 MB; northeast peaks are 174.6, 190.8 and 172.9 MB. The high city result and low city result both remain. Do not compare the new small-stall counts directly with older, less instrumented batches or claim a general FPS improvement.

The after diagnostic estimates 1.516 GB of sampled allocation versus 14.414 GB before, about 89.5% less. `queueEdgeJoins` falls from 6,598.8 to 36.4 MB and `joinTerrainEdges` from 3,739.7 to 212.0 MB. These are sampling estimates including collected objects, not resident memory. The changes are retained for this demonstrated allocation reduction, exact output preservation and the lower small-stall total. Peak memory remains a separate failed requirement.

The remaining allocation profile is led by the production tick/render path at about 393 MB, seam output publication at 212 MB, draping at 97 MB and scheduling at 84 MB. Required geometry/contact data and the bounded caches are retained. The candidate's finished diagnostic has 71.6 MB after collection versus 70.7 MB before, with unchanged cache counts and normal resident-tile variation. It does not establish a leak fix or reduced retained live data. Further reduction of transient allocation and investigation of GC timing are required; neither a new cache cut, detail reduction nor forced production GC is justified by these snapshots.

## The historical 400 ms interval

The original 10.922 city-3 interval spans navigation times 23,485.6 to 23,885.6 ms. Its CPU profile assigns 397.2 ms to `(program)` and only 2.8 ms to rendering. The longest captured animation-frame callback is 3.56 ms, the largest measured phase is 0.19 ms, and there is no measured GC contribution. That original timeline did not record graphics/scheduler categories. It cannot identify the native or scheduling cause by exclusion, and it does not show a 400 ms game-code task.

The twelve fresh flights add graphics/scheduler tracing but do not reproduce a flight interval over 100 ms. Consequently, the exact original cause remains **unverified and open**. There is no claimed hitch fix based on non-reproduction. Fresh startup traces identify compositor readback/GPU waits, but also retain one after northeast-2 staged-attachment contribution of 95.3 ms inside a 133.3 ms interval. That startup attachment stall remains open. Published bounded startup/hitch evidence and extraction coverage records preserve what the fresh traces actually capture; nested events and different threads must not be summed into a fabricated main-thread cost.

## Visual review and reproduction

`views/city-chase.png` and `views/city-first.png` are inspected actual production-camera views at 90 m road clearance, 1280 x 720 and pixel ratio 1. The resident seed-1337 connector is `0,0|1,1`, at 3.10 of 31.05 km. Road, terrain, water and aircraft remain continuous in these poses, with no page errors. The recorded weather is automatic/scattered clouds. These are fixed poses, not manual handling or sustained travel acceptance.

Use the installed Playwright module and hardware Chromium through `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`. Start separate frozen-before and candidate Vite servers. Run `REVIEW_DIRECTORY=docs/reviews/performance-10.926 REVIEW_PROFILE=1 REVIEW_TRACE=1 REVIEW_GRAPHICS_TRACE=1 node scripts/profile-flight.mjs before` against the frozen server, then `after` against the candidate. Do not run tests, builds or another review browser during these flights. Capture snapshots with `scripts/snapshot-flight-heap.mjs` only in separate diagnostic runs. Rank with `rank-heap-retainers.mjs` and `summarize-heap-allocations.mjs`. Stream full timelines through `extract-native-trace.py`, attribute the bounded outputs with `attribute-flight-hitches.mjs`, and summarize the complete records with `summarize-hitch-runs.mjs`. Capture views separately with `capture-performance-views.mjs`.

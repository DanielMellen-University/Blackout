# Hitch attribution and cooperative preparation, 10.915

The final twelve-run instrumented comparison establishes **no overall FPS or
heap win**. Flight intervals >100 ms fall from **7 to 1**, but >50 ms intervals
rise from **51 to 71**. p95 remains **33.4 ms**. The maximum gets worse,
**250.0 to 483.3 ms**. City peak heap rises **184.9 to 194.2 MB** and northeast
peak heap rises **155.4 to 199.3 MB**. Every run is in [the table](measurements.md)
and [machine-readable summary](summary.json); [every long interval](hitches.md) has an evidence record.

The three final city flights contain no >100 ms interval. The final northeast
run 3 retains a 483.3 ms interval with 7.9 ms of RAF work, about 475.8 ms sampled
as `(program)`, no GC span and no long attachment/worker handler. Its trace
covers the interval. The remaining browser/driver/scheduling cause is **not
proven**. It must not be assigned to GC, uploads or shader compilation without
further evidence. Smaller hitches, heap acceptance and this outlier remain open.

Base: `ff1a4e4`, chunk 10.914. The recorded comparison uses the original
seed-1337 city and seed-73 northeast routes, 120 simulation seconds at 680 m/s,
81.6 km per flight, Balanced, chase camera, fixed pixel ratio 1 and 1280 x 720.
Three fresh-browser flights per route are retained on each side. No geometry,
collision, water detail, render distance, worker limit, terrain upload limit,
draw family, building limit or road/support limit is reduced.

## What the baseline actually caught

The three city flights contain seven intervals strictly over 100 ms. All seven
have specific main-thread evidence: three first-use shader compilation/link/
introspection intervals (150.0, 200.0 and 183.3 ms), three cold synchronous
hydrology queries from `sampleMeshSurface` in the biome-survey path (116.6,
116.7 and 116.8 ms), and one 250.0 ms GC interval. The latter includes roughly
191.5 ms of incremental marking followed by 15.5 ms of major-GC work. Counting
only the short `MajorGC` event would miss the dominant incremental phase.
The three baseline northeast flights have no flight intervals over 100 ms.

Launch also rebuilds protected settlements synchronously, with individual
baseline builds reaching 95 ms and a road build reaching about 64 ms. Several
startup intervals spend most of their time outside captured JavaScript work.
Those gaps must not be called GC, uploads or GPU compilation without further
evidence. Long worker-thread tasks are not main-thread frame costs.

The old 683.2 ms city interval is historical evidence without a matching trace.
It did not reproduce in the six new baseline flights. None of the seven new
long flight intervals is dominated by static matrix work or drape publication.
The 10.914 changes are retained. This is not proof of what caused the old
outlier or its heap increase. The new baseline city heap peaks themselves range
from 123.1 to 184.9 MB, despite identical route and render settings.

A compile-only pilot removed the original JavaScript shader/hydrology spikes
but retained a repeatable 150 ms interval dominated by native waiting. The first
full GPU trace filled its buffer before that frame and is rejected for GPU
attribution. A targeted 30-50 simulation-second capture reproduced a 183.3 ms
interval: 257 `GetProgramiv` queries account for about 126.2 ms while 15 programs
link. The sun's weather/elevation-dependent `castShadow` flag changes the shadow
light count during flight. Warming only the initial count misses those variants.
The final candidate warms and exercises both counts and waits for GPU completion.
The bounded GPU excerpt and native-query spans are in `gpu-window/`. Pilot and
GPU diagnostic flights are retained separately and excluded from the twelve-run
comparison. The pilot's third, incomplete flight was cancelled to investigate
this cause before starting the final comparison batch.

## Changes

- Construct a URL-requested seed directly, with a playable random fallback on
  failure. Reuse an unchanged seeded preview on first Play. This removes the
  discarded random world and the duplicate launch rebuild without changing
  retries or subsequent world selection.
- Warm both shadow-light counts before exposing the ready state. Compile and
  exercise the existing scene, near/far terrain, water and settlement material
  variants, including regional roads, bridges, docks and vertex/instance colours.
  Wait asynchronously for submitted GPU work. Draw private fixtures only during
  boot, remove them immediately and dispose only their owned buffers. Restore
  the live sun-shadow flag; no steady-flight draws or budgets are added.
- Prepare biome-survey watersheds through the existing cooperative hydrology
  iterator for the exact queried catchment. Keep the previous label until its
  exact query is ready. Physics,
  collision and analytic fallback surface queries are unchanged.
- Prepare one private streamed settlement or road at a time in cooperative
  slices. Yield between mesh phases, road-row groups and dash groups. Keep
  existing residents until admission commits, then publish the complete root
  and collision together. Cancel departed/reset work and release its private
  geometry. Protected retries use the same ready path. Initial protected roots
  and workerless planning remain synchronous.

A second pilot exposed unnecessary neighbouring-watershed preparation in the
new survey box. Its northeast run 2 reached 215.0 MB. The final implementation
prepares only the actual queried catchment and abandons work when that catchment
is left. `neighbour-pilot/` retains all four completed records; its incomplete
third city flight is excluded. Removing unnecessary preparation does not prove
a heap win: the final peak numbers above remain higher than baseline.

## Measurement and evidence

These twelve comparison flights deliberately have identical CPU sampling,
method timers and browser timeline recording enabled. They are an instrumented
comparison, not directly comparable to 10.914's uninstrumented acceptance totals.
The expensive old road-publication copy audit is disabled on both sides.
Method spans nest; do not add their totals. CPU samples are approximate evidence,
not exact CPU accounting. GC trace spans are unioned to avoid counting nested
phases twice. Browser heap is optional JS-heap telemetry, not process RSS or GPU
memory. Boot-ready and launch-to-coverage times are reported separately so work
moved into warmup remains visible. The old boot-ready mark preceded aircraft
construction; the new mark includes aircraft/material preparation, so those two
boot marks are not identical cold-start endpoints. Coverage and flight metrics
retain their original endpoints.

Every run retains raw RAF intervals, timestamped >100 ms intervals, heap and
resource timelines, method timings, environment settings and the complete CPU
profile. `*.hitches.json` links each interval to sampled stacks and main-thread
events. `*.hitch-trace.json.gz` retains bounded trace excerpts and thread metadata.
Full timelines remain local and can be regenerated with the harness; they are
ignored to avoid adding more than 100 MB to every CI checkout. Source manifests
identify the measured code before release metadata changes. The preliminary
city capture lacks CPU attribution and is excluded from the comparison.

No build, test process or second profiling browser runs alongside the flights.
Short inspection scripts read completed records during the batches. All measured
intervals are retained, including outliers and gaps without a proven cause.

## Reproduction

The baseline is `ff1a4e4` plus `before/instrumentation.patch.gz`.
Start `npm run dev -- --host 127.0.0.1`. Set `PLAYWRIGHT_MODULE` and optionally
`CHROMIUM_PATH` to the already-installed Playwright and Chromium paths.
Run `REVIEW_DIRECTORY=docs/reviews/performance-10.915 REVIEW_PROFILE=1
REVIEW_TRACE=1 node scripts/profile-flight.mjs LABEL` on each version. Use a new
label to avoid resuming old records. The harness rejects software rendering,
wrong routes, wrong buffers, missing instrumentation and incomplete flights.
For separate GPU diagnostics, add `REVIEW_GPU_TRACE=1 REVIEW_RUNS=1
REVIEW_ROUTES=city`; these are excluded from the comparison.

Run `node scripts/attribute-flight-hitches.mjs DIR` for each capture directory,
then `node scripts/summarize-hitch-runs.mjs` to validate and tabulate all twelve
comparison records. The timestamp recorder is bounded and opt-in development
code. Production flight does not allocate its history.

## Verification and limits

The affected checks cover staged root/collision publication, reset/departure
cleanup, resident admission, shader fixture ownership, exact survey delivery,
terrain contact/LOD, world lifecycle and the recorder. The production build
passes. Existing workerless planning, cold analytic collision misses, sustained
15-minute memory acceptance, coastal road connectivity and rough-terrain road
artwork remain open. Paused systems remain excluded.

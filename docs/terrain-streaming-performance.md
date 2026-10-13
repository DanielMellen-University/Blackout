# Terrain streaming performance

The streaming radius is 33,600 m, up from 16,800 m. Clear-weather fog ends at
30,240 m instead of 15,120 m; the camera far plane follows the stream radius.

## Implementation

### Chunk 10.892 current-revision full-game comparison

The accepted candidate is exact commit `b0c6cbd` (10.891), landscape revision
16. The historical baseline and method are recorded below under 10.888.
Both runs used seed 73, Balanced, 1280 x 720, pixel ratio 1, minimal HUD and
chase, with the same prescribed 680 m/s trajectory for 120 simulation seconds
(81.6 km). One tab/server ran at a time with no tests or profiler during the
accepted runs. Real gameplay rendering, streaming, weather, HUD, audio and
collision execute; prescribed aircraft pose/controls make this a workload
comparison, not a handling test. Navigation modules were warm. These are
single runs on the same machine, not repeated cold-start distributions, and
the intentionally changed generator produces different terrain/weather.

| Measure | 10.868 baseline | 10.891 candidate |
| --- | ---: | ---: |
| Airfield ready after navigation | 1,696.1 ms | 3,061.5 ms |
| Launch to terrain coverage | 1,152.3 ms | 2,110.5 ms |
| Startup rendered intervals | 56 | 111 |
| Startup median / p95 / max | 16.8 / 38.6 / 88.5 ms | 16.7 / 34.6 / 124.6 ms |
| Flight rendered intervals | 6,501 | 6,525 |
| Flight median / p95 / max | 17.5 / 24.0 / 781.6 ms | 18.1 / 23.6 / 1,084.1 ms |
| JS heap start / endpoint / peak | 62.3 / 88.9 / 110.6 MB | 78.6 / 95.6 / 218.5 MB |
| Endpoint geometries / textures | 403 / 4 | 377 / 4 |
| Endpoint loaded tiles | 637 | 638 |
| Endpoint pending / workers active / ready | 23 / 4 / 0 | 18 / 4 / 0 |

Raw candidate results are in [the revision-16 record](reviews/fullgame-10.891.json).
Frame median/p95 are comparable on this route; startup and peak heap are
higher. Endpoint heap is below its peak but one route does not prove absence
of a leak. The real long hitch is retained, not filtered or declared fixed.
No render distance, worker count, cache cap or upload budget was reduced.

A separate temporary diagnostic run reproduced a 1,057 ms RAF interval.
The preceding measured game work totalled 4.4 ms: simulation 0.2, world 1.1,
presentation 0, render 3.0 and HUD 0.1 ms. No slow world sub-stage was logged
at that gap. This narrows the measured CPU explanation but does not establish
a browser, GPU or host cause, nor exclude work outside those checkpoints.
Instrumentation was removed after the diagnostic; its run is not substituted
for the uninstrumented accepted result above.

The actual Free flight endpoint was visually inspected. A separate automatic
weather review covered 63.2 km at 680 m/s and 220 m above sampled terrain,
using first person then chase; observed samples included clear, snow showers
and overcast, with readable terrain. A later 170 km automatic travel pass
ended in blizzard conditions (18.0/23.3 ms median/p95; heap 62 to 80 MB,
peak 210 MB), but its intervening conditions were not continuously observed.
Neither pass certifies continuous storm/blizzard review. Browser approval
became unavailable before that focused check. At the user's request this
commit finishes the current water batch and weather is next; broader field
coverage remains explicitly unverified rather than inferred from stills.

Delivery checks: all 31 checks in `terrainWaterBed`, `regionalWorld`,
`lakeOutlets` and `smallPonds` passed. The production build and synchronized
release-metadata check passed; the existing Three.js bundle-size warning
remains. This delivery changes only release metadata and review evidence.

### Chunk 10.891 coarse shoreline bed correction

The seed-73 wetland overview exposed a pale triangular bank sliver. Independent
barycentric probes against the actual generated ground and water attributes
confirmed coarse ground penetrating water, by up to roughly 8.3 m at the
five retained regression points. Water triangles were present and matched
the analytic collision level. Five-point actual-mesh checks now pass at near,
mid and far detail. The corrected fixed view is saved as
[wetland banks](reviews/wetland-banks-10.891.png); the aircraft-scale view was
also inspected. This is not proof that every shoreline worldwide is perfect.

The correction runs only on eligible coarse water/shore tiles with cells
larger than 15 m. It samples mixed/at-risk cells, preserves a two-cell halo
for matching heights/normals, and protects the graded runway core. An exact
water-only query avoids repeated landform, biome and valley-carving work.
No ground or water vertices/attributes are added, and no render distance,
worker count or upload budget is reduced. Temporary arrays are tile-owned and
released after completion/cancellation. Revision 16 invalidates incompatible
ghost playback, not saved records.

Same-machine CPU comparison on October 12: 16 builds per case, first build
excluded from warm median/p95. The baseline uses the exact 10.890 terrain
builder with the same current drainage implementation in isolated module
loaders. The archived 10.888 TerrainGeometry source was verified identical
to 10.890 before use. No game tab/tests ran during this comparison. These are
warm builds, not repeated cold startups or a gameplay FPS benchmark.

| Seed / centre / LOD | 10.890 warm median / p95 | 10.891 warm median / p95 | Ground / water bytes, unchanged |
| --- | ---: | ---: | ---: |
| 73 / -4200, -18600 / near | 39.20 / 71.18 ms | 34.79 / 44.36 ms | 180,588 / 62,064 |
| 73 / -4200, -18600 / far | 7.76 / 23.27 ms | 11.91 / 24.39 ms | 15,788 / 380,160 |
| 73 / -7830, -20250 / near | 34.27 / 35.88 ms | 31.84 / 35.69 ms | 180,588 / 25,776 |
| 73 / -7830, -20250 / far | 8.64 / 11.56 ms | 12.33 / 14.00 ms | 15,788 / 582,912 |
| 1 / -46072, 91807 / near | 25.81 / 31.12 ms | 26.75 / 33.91 ms | 180,588 / 18,576 |
| 1 / -46072, 91807 / far | 4.67 / 5.94 ms | 6.19 / 8.53 ms | 15,788 / 135,792 |

Near-detail correction is bypassed; its timing differences are run variance,
not an optimization claim. Affected far tiles cost about 1.5-4.2 ms more to
build. The earlier unoptimized experiment roughly doubled affected build
times, so it was not retained. The current-revision full-game comparison is
recorded above under 10.892, including startup/heap costs and remaining hitches.
The historical 10.888 comparison below does not measure this extra work.

### Chunk 10.888 completed full-game comparison

The browser is no longer continuously host-throttled. Both accepted runs use
seed 73, Balanced, 1280 x 720, pixel ratio fixed at 1, minimal HUD and chase,
with a prescribed 680 m/s trajectory for 120 simulation seconds (81.6 km).
The baseline is exact commit `876a890` (10.868), with only the same development
recorder/hooks and windowed-review adapter added. The candidate retains world
generation revision 14. Only one game tab and one server ran at a time, with
no tests or profiler during either accepted run. Navigation modules were warm;
these single startup readings are not cold-install measurements. Landscapes
and weather intentionally differ because the shared generator changed.

| Measure | 10.868 baseline | 10.888 candidate |
| --- | ---: | ---: |
| Airfield ready after navigation | 1,696.1 ms | 3,688.6 ms |
| Launch to terrain coverage | 1,152.3 ms | 2,098.5 ms |
| Startup rendered intervals | 56 | 114 |
| Startup median / p95 / max | 16.8 / 38.6 / 88.5 ms | 16.7 / 35.6 / 65.9 ms |
| Flight rendered intervals | 6,501 | 6,532 |
| Flight median / p95 / max | 17.5 / 24.0 / 781.6 ms | 17.4 / 24.1 / 1,041.5 ms |
| JS heap start / endpoint / peak | 62.3 / 88.9 / 110.6 MB | 70.5 / 96.6 / 224.8 MB |
| Endpoint geometries / textures | 403 / 4 | 378 / 4 |
| Endpoint loaded tiles | 637 | 646 |
| Endpoint pending / workers active / ready | 23 / 4 / 0 | 1 / 4 / 2 |

Frame median/p95 are comparable on this route, not universally improved.
Startup is slower and peak heap is substantially higher. The candidate heap
returns below its earlier 137 MB reading by the endpoint, but this is not a
leak proof or a long-session memory guarantee. The long hitches are real
timestamp samples and are not discarded or explained away without a trace.
No render distance, worker count or streaming/upload cap was reduced.
Raw results are in [the comparison record](reviews/fullgame-10.888.json).

Discarded diagnostics include continuously throttled runs, a fullscreen-exit
pause, unmatched viewport sizes and two runs where reset restored a saved
orbit camera. The recorder now avoids automatic fullscreen, fixes launch and
reset to chase, and reports `external` (the chase label). It does not overwrite
the saved camera preference. Normal game launch still requests fullscreen.

The accepted endpoint was visually checked in the actual Free flight game.
A separate clear-weather, low-altitude seed-73 lake-outlet trace reached its
receiving water without a dry cutoff, but exposed a curved optical color
boundary. Water appearance and final low-altitude/weather field review remain
open; these measurements do not declare the full objective complete.

### Chunk 10.887 full-game review protocol

In development, open `/?course=free-flight&seed=73&review=flight` and use the
fixed-route review button. The normal launch loader still runs. After initial
terrain coverage, the real gameplay loop follows a prescribed northeast route
from (0, 5000, 0), at 680 m/s for 120 simulation seconds (81.6 km). Physics,
collision, HUD, audio, atmosphere, streaming and rendering execute normally;
the fixture overrides aircraft pose/controls. This is a rendering workload,
not a flight-handling or low-altitude collision validation. Production builds
omit the recorder and its import.

Compare an exact historical baseline and candidate on the same machine, seed,
quality, viewport and pixel-ratio range, running one at a time with no test
runner or profiler active. Keep the game visible, focused and unpaused. Record
airfield-ready navigation time separately from launch-to-coverage wall time
(which includes the loading screen and any wall-clock interruption). Compare
startup and flight frame median/p95/max, sample counts, optional JS heap
start/current/peak, geometry/texture counts and streaming queue counts. Each
frame window retains at most 18,000 recent rendered intervals; hitches are not
clamped. Explicit paused/hidden intervals reset the timestamp anchor and do not
advance the route. Missing browser heap telemetry is reported as zero, not
proof of zero usage. GC variation and one route do not establish absence of leaks.

The attempted 10.868 historical baseline was host-throttled near one rendered
frame per second even with document visibility reported as visible. Its
partial result is invalid for performance comparison, so no improvement or
regression is claimed. The old debug FPS estimate hid these long gaps by
substituting the protected simulation step; 10.887 corrects it and labels the
callback rate `raf/s`. Simulation hitch protection itself is unchanged. The
separate terrain-review timestamp measurements were not using this estimate.
Foreground baseline/candidate startup, frame-time and sustained-memory review
remain open. Do not reduce render distance to make this comparison pass.

### Chunk 10.880 regional weather CPU and travel sample

Same-machine atmosphere-only comparison against 10.879, seed 1, Balanced cloud
and precipitation budgets, 7,400 updates at 60 Hz. Each step moves 12 m on both
world axes; the measured 7,200-step portion covers 122.2 km.
The first 200 updates are warm-up; the reported distribution covers 7,200.
No test runner was active. This does not generate terrain or submit GPU draws.

| Measure | 10.879 | 10.880 |
| --- | ---: | ---: |
| Atmosphere construction / seed | 27.80 ms | 32.40 ms |
| Update median | 0.145 ms | 0.072 ms |
| Update p95 | 0.246 ms | 0.177 ms |
| Update p99 | 0.328 ms | 0.317 ms |
| Largest update | 0.864 ms | 3.390 ms |
| Fixed cloud instance capacity | 720 | 694 |

Different regional coverage changes visible-cloud work, so the lower median is
not a general speedup claim. The higher tail includes bounded regional sampling
and JIT/GC variability. One local sample updates each active simulation frame;
46 formation samples run at most five times a simulation second and nine sky
samples at most four times a second, except explicit reseeds/large relocations.
There are still three instanced cloud draws, one analytic sky draw, and the
existing pooled precipitation. No extra workers, terrain uploads, unbounded
world caches, render-distance cuts, or volumetric ray marching were added.

The background terrain review at 1280 x 720, seed 1, Automatic weather and maximum
afterburner speed completed 299.2 simulation seconds / 203.4 km in unobstructed
first person, with 16.7 ms frame median / 16.8 ms p95. Its bounded 7,200-frame
window covers the latest portion, not all five minutes. Reported JS heap was
62 MB initially and 79 MB at stop, with a 230 MB peak; final GPU resource counts
were 401 geometries / three textures. Garbage collection and stream churn make
the peak meaningful, but this is not a leak proof. The review includes terrain,
water, settlements, and atmosphere, not the complete gameplay/HUD workload.
No test runner or CPU profiler was active during this travel run. Earlier
background observations were host-throttled and are excluded from these frame
results. Clear-to-snow travel, a separate chase-view storm review, and low/high
altitude regional snow views retained readable terrain; the browser error log
was empty. These appearance checks do not prove every cloud interior or front
transition satisfactory; targeted full-game inspection remains required.
The tool reports travel, frame distributions, optional heap, and GPU resources,
excluding document-hidden frames. A same-route full-game baseline/candidate
startup, sustained-memory, and frame-time comparison remains outstanding.

### Chunk 10.874 confluence and mouth correction

Same-machine CPU-only comparison against 10.873, seed 1, unchanged quality,
16 builds per coordinate, with no test runner active; medians exclude the first:

| Tile | 10.873 warm ms | 10.874 warm ms | 10.873 / 10.874 payload bytes |
| --- | ---: | ---: | ---: |
| Receiving pond (-22050, -28350), near | 15.78 | 15.81 | 224004 / 216516 |
| River mouth (-33600, -18060), near | 25.00 | 21.77 | 215940 / 215940 |
| Far water (-26880, -26880), 8-cell | 2.67 | 2.58 | 10516 / 10516 |

Cold pond builds were 107.88 / 99.68 ms and mouth builds 82.34 / 72.10 ms.
Warm p95 was 25.48 / 24.81 ms at the pond and 38.93 / 24.77 ms at the mouth.
These short, JIT-sensitive CPU samples are not startup, FPS, or sustained-memory
measurements. The hidden review browser remained throttled near one FPS; its
frame statistics are not performance evidence. Render distance, worker/upload
limits, and cache bounds are unchanged. Junction radius is one cached scalar
per existing drainage node; mouth shading adds bounded local basin queries.

First-person seed-42 mouth inspection confirmed removal of the overlapping
full-disc cap and its striped semicircular flicker. A remaining shallow-water
color transition is visible, so this is not a claim of finished water artwork.
Broader basin-spill routing and controlled foreground travel/heap review remain
outstanding. Focused regressions cover descending actual confluence surfaces,
mouth ownership, shading metadata, and duplicate sea sheets at lake edges.

### Chunk 10.873 shared water surfaces

Same-machine CPU-only comparison against 10.872, seed 1, unchanged quality,
16 builds per coordinate, with no test runner active; medians exclude the first:

| Tile | 10.872 warm ms | 10.873 warm ms | 10.872 / 10.873 payload bytes |
| --- | ---: | ---: | ---: |
| Receiving pond (-22050, -28350), near | 17.63 | 20.58 | 228612 / 224004 |
| River mouth (-33600, -18060), near | 20.78 | 21.46 | 212916 / 215940 |
| Far water (-26880, -26880), 8-cell | 2.02 | 1.93 | 10516 / 10516 |

Cold pond builds were 134.50 / 106.13 ms and mouth builds 63.11 / 81.17 ms.
Warm p95 was 37.98 / 46.83 ms at the pond and 22.10 / 24.42 ms at the mouth.
These short JIT-sensitive samples show a real cost for exact surface agreement,
not a general speedup. The ordinary eight-sample seed-1337 sliced run recorded
a 7.05 ms warm near median, 12.26 ms p95, 148.10 ms first build, and 6.27 ms
maximum individual channel-preparation step. The 2 ms budget remains a deadline
between steps, not a guarantee on any single step.

Shared surfaces are weakly owned by immutable reaches under existing bounded
node/catchment caches. Clipped mouths use a compact 4x4 triangle index; ordinary
sections remain compact arrays. There is no new unbounded world cache, worker,
timer, upload allowance, or reduction in render distance. A sustained foreground
heap/FPS comparison is still outstanding; these CPU numbers do not replace it.

Rendered seed-42 review covered the river overview, a settled low-altitude chase
view, and the receiving-lake mouth in unobstructed first person. The hidden
browser was throttled near one frame per second, so initial missing coverage
was allowed to settle and its frame statistics are not performance evidence.
The mouth still has a visible shading transition; further confluence grading,
shore appearance, and complete basin-spill routing remain unfinished.

### Chunk 10.872 water correction sample

Same-machine CPU-only comparisons against 10.871 used seed 1, unchanged quality,
eight builds per fixed coordinate, and medians of the seven warm builds:

| Tile | 10.871 warm ms | 10.872 warm ms | 10.871 / 10.872 payload bytes |
| --- | ---: | ---: | ---: |
| Receiving pond (-22050, -28350), near | 16.83 | 17.94 | 220980 / 228612 |
| River mouth (-33600, -18060), near | 21.48 | 19.26 | 212916 / 212916 |
| Far water (-26880, -26880), 8-cell | 2.04 | 1.90 | 10516 / 10516 |

The larger pond contour adds about 3.5% to that tile's payload. Cold first builds
were 89.94 / 97.96 ms at the pond and 67.13 / 61.83 ms at the mouth. These short
JIT-sensitive samples are not an FPS, startup-time, or sustained-memory claim.
The ordinary seed-1337 three-sample sliced profile recorded an 11.33 ms warm
near-tile median, 2.99 ms maximum individual step, and 39,412-byte maximum payload.
Render distance, node/catchment cache caps, workers, and upload limits are unchanged.
River/lake clipping has bounded subdivision; bounds collection allocates a
short-lived stable-ID set to avoid duplicate geometry after node-cache eviction.

Rendered reviews covered seed-42 river/receiving-water outlines and a seed-1 lake.
The background browser became throttled and intermittently unresponsive during
later review, so its frame statistics do not validate performance. A controlled
foreground full-game travel/memory comparison remains outstanding. Use
`/dev/terrain.html?destination=river&seed=42` for the fixed route; the river slider
and Overview/Chase/First person controls are review-camera tools, not flight-physics
tests. Full hydrology spill routing and regional weather are not complete.

- One to six workers, selected from available CPU concurrency and the active
  quality preset (Low two, Balanced four, High six), generate terrain and water
  buffers. At most one job runs per worker, with a bounded completed queue and
  transferable buffers. Quality changes retire busy workers only after their
  current job completes, so no terrain result is dropped. No terrain generator
  runs on the render thread when workers are available.
- Render-thread attachment has a 2 ms inter-upload deadline and a 16-tile cap.
  A single attachment can exceed that deadline.
- Contact detail takes priority, followed by nearest missing coverage, then
  distant LOD changes. Movement reprioritizes waiting work; stale world replies
  cannot install after a reset or disposal.
- Outer quadtree leaves reach 32 cells. Representative layouts contain 540-575
  leaves, versus 516 in the original benchmark. Near mesh density is unchanged;
  distant water terrain uses at most 16 segments. Analytic water surfaces remain.
- New terrain and water fade in over 650 ms with smooth opaque fades (alpha-hash
  dithering was removed). Previous coverage stays through the transition.
- Settlement planning keeps its previous range and object caps so extending the
  landscape does not quadruple background settlement work.
- Browsers without working workers use the same geometry iterator as workers,
  but yield between batches of eight climate/color/gradient samples, cold
  hydrology phases, and water assembly phases. The stream
  retains one unfinished tile and shares the 2 ms upload deadline, with a hard
  256-step ceiling even if a clock is coarse or frozen. Unfinished work counts
  as in-flight and is cancelled on reset, disposal, seed changes, or unloading.
  Cold catchments publish only complete drainage and use the existing 128-region
  cache. Water jobs own staging arrays; at most one idle workspace is retained.
  Attribute allocation, bounds computation, and attachment remain indivisible;
  a single step can exceed the deadline. Loading speed and frame times differ
  from the worker path. No timers or additional background processes are used.
- Silent terrain and settlement jobs expire after 15 seconds of active world
  updates and use the existing bounded fallback queues. No wall-clock timer runs
  during pause or hidden-tab time. Settlement replies must match the outstanding
  key, generation, and request kind; late or duplicate results cannot add meshes.

## Shared water revision (chunk 10.869)

The shared regional coast field, drainage-node graph, and cached lake contours
feed carving, independent water meshes, and surface/collision samples in every
mode. The user's latest density request supersedes the earlier 15-25% open-sea
target. Compared with the denser in-progress prototype immediately before that
request, seeds 1, 42, and 1337 retain 635.84 km of river length versus 3,345.54 km
(19.0%). In 49,923 surface probes, water covers 3,735 samples versus 14,804
(25.2% of the previous wet area; 7.48% of the reviewed land/water area).
Those probes span +/-64 km at 1 km spacing. River lengths cover the nine
32 km regions around the origin for each seed. Split arms account for 0.65% of
retained river length. These are reproducible regional samples, not a guarantee
that every flight sees the same density. The broader ten-seed coast-only review
has 5.07% open sea coverage over +/-128 km at 4 km spacing.

Render radius remains 33.6 km, fog horizon 30.24 km, and worker/upload/cache
caps are unchanged. Fully submerged sea tiles no longer promote invisible ground
to shoreline detail. Basin queries use the current region's halo instead of
building extra regions to find off-tile lake centres. Curved river ribbons share
cross-sections rather than overlapping flat join pads on graded water.

Separate CPU-only three-sample seed-1337 profiles on the same machine:

| Measure | Before revision | Candidate |
| --- | ---: | ---: |
| First near tile | 59.21 ms | 97.64 ms |
| Later near median | 19.06 ms | 16.78 ms |
| Largest near work step | 5.67 ms | 2.67 ms |
| Near maximum payload | 39,412 B | 39,412 B |

Cold regional preparation still costs more overall than the old generator.
Shorter work slices and the worker path matter; this is not a general FPS gain
or a hard 2 ms deadline guarantee. Browser terrain-only travel and full-world
visual inspection are separate from this CPU profile. Full-game weather-heavy
flight and JS-heap growth need further review during the next batches.

Browser terrain-only checks used seed 1337, High quality, six workers, pixel
ratio 1, 5,000 m altitude, and the same northeast 680 m/s route on the same
machine. The 10.868 baseline ran 102 seconds / 69.4 km; the final candidate ran
101 seconds / 68.7 km. Both reported 60 median FPS and 16.8 ms flight frame p95.
Initial coverage measured 2.85 s before and 1.23 s after. Terrain update p95 was
2.20 ms before and 2.40 ms after. At the final sample the baseline had 664
resident tiles and the candidate 623, with no pending jobs. Resident tiles are
not a JS-heap measurement; this single route/run is not a full-game or universal
performance guarantee. Full-world river/chase, lake, and coastline screenshots
were visually inspected separately, including the wide-river join correction.

## CPU generation profile (chunk 10.839)

Run `npm run perf:terrain -- --seed=42 --samples=16`. The loader does not open an
HTTP/WebSocket server and closes on completion. The fixed route samples a
northeast diagonal from the world origin. Results include first-build timing,
subsequent-build median/p95, and maximum transferable payload size. A separate
process starts with fresh module/JIT state; later profile rows share warmed
generation caches. These are CPU geometry timings, **not FPS**, worker throughput,
GPU uploads, or full-game measurements.

Observed with Node v22.23.2 and eight available execution threads on 2026-10-06:

| Profile | First build | Later median | Later p95 | Max payload |
| --- | ---: | ---: | ---: | ---: |
| Near, 1 cell | 46.87 ms | 6.57 ms | 12.56 ms | 39,412 B |
| Mid, 1 cell | 1.80 ms | 1.19 ms | 1.75 ms | 10,516 B |
| Far, 8 cells | 0.74 ms | 1.47 ms | 2.34 ms | 10,516 B |
| Far fallback, 8 cells | 1.22 ms | 1.05 ms | 1.19 ms | 4,980 B |

Seed 1337, eight samples, also showed a 42.52 ms first near build and a 6.65 ms
later median. Near generation, rather than distance-ranking arithmetic, is the
main CPU cost in these samples. Keep it off the render thread. The existing
inter-build deadline could not interrupt one synchronous near build in 10.839.
Re-run in a separate
process without the test suite for comparisons. Samples and hardware are limited;
browser rendering and dense/weather-heavy full-flight profiling are still needed.

## Cooperative CPU steps (chunk 10.840)

Run `npm run perf:terrain -- --seed=42 --samples=16 --sliced`, then repeat with
seed 1337 in another process. Each `next()` reports the phase just performed;
the profiler includes whole-tile timings, maximum individual step cost, and
maximum costs by phase. It drains the iterator immediately, not over browser
frames, and does not include game scheduling, collision probes, uploads, or FPS.
Steps preserve the previous typed buffers and bounds, verified against hashes
captured independently from commit `1065d0b` for six terrain/water/pad cases.

Separate unloaded runs on the same Node environment/date, 16 near tiles each:

| Seed | First complete tile | Later tile median | Later tile p95 | Largest step |
| --- | ---: | ---: | ---: | ---: |
| 42 | 46.84 ms | 6.85 ms | 12.82 ms | 15.24 ms |
| 1337 | 43.97 ms | 9.20 ms | 40.55 ms | 12.40 ms |

The largest near step in both runs was layout/cold catchment creation. Normal
probes can create adjacent catchments (8.56 / 6.70 ms maxima); water assembly
reached 5.58 / 7.01 ms. Seed 1337's longer route also contains promoted water
grids, with a 218,964-byte maximum payload versus seed 42's 39,412 bytes.
An earlier run concurrent with focused tests showed an 83.70 ms first tile and
25.40 ms maximum step; host load matters. These observations are not a hard
frame-time guarantee or a cross-device speedup claim. Slicing stops an entire
tile from being one mandatory uninterrupted sampling call, but cold hydrology,
water assembly, and scene attachment remain profiling/optimization priorities.

## Cold hydrology and water steps (chunk 10.843)

The same `--sliced` profile now identifies `hydrology-*` and `water-*` phases.
Cold landform samples are batched eight at a time, priority-flood visits 32 at a
time, and channel emission one coarse segment at a time. Water clips 32 terrain
cells, solves eight shoreline rays, clips eight basin wedges, or emits four
river sections per batch. Face normals and normalization run in bounded batches,
preserving Three's Float32 rounding order. The synchronous API and workers drain
the same iterators; only the unsupported/failed-worker path spreads them across
frames. No detail, triangles, collision data, worker count, or stream radius is
reduced by this change.

Separate 16-sample runs on 2026-10-07, Node v22.23.2 / eight execution threads, without other
agent builds/tests running during measurement:

| Seed / candidate | First complete tile | Later median | Later p95 | Largest step | Max payload |
| --- | ---: | ---: | ---: | ---: | ---: |
| 42 | 50.50 ms | 5.89 ms | 11.56 ms | 2.65 ms | 39,412 B |
| 1337 | 63.73 ms | 11.62 ms | 46.30 ms | 3.72 ms | 218,964 B |

A seed-1337 baseline collected from 10.842 immediately before implementation
measured 42.94 ms first tile, 9.68 ms later median, 42.44 ms later p95, and an
11.84 ms largest step. Its water phase reached 7.00 ms. The final candidate's
largest water substep was 0.56 ms, layout 0.45 ms, and cold hydrology substeps
at most 2.73 ms; climate sampling became the largest step. An earlier candidate
run showed 3.65 ms largest step and 9.49 ms later median. Host/JIT variability
and additional yield points matter: this is a shorter-uninterrupted-work result,
**not** proof of faster total generation, a hard 2 ms limit, or an FPS increase.
Scene/prop attachment and complete browser flight remain unmeasured here.

Independent legacy hashes captured from 10.842 cover six catchment graphs and
seven raster/basin/river water payloads (including normals and bounds). Existing
full terrain hashes also remain unchanged. Regression tests cover partial-cache
publication, cancellation before/after geometry allocation, owned staging and
input lists, interleaved drainage sort scratch, canonical landmarks completed by
another query, direct seed changes, and failed seed-search restoration.

## Reproduce

Run `npm run dev` and open `/dev/streaming.html?seed=1337`, or use seed `1`.
The benchmark reports time until all requested terrain is attached, before the
last chunk's fade completes. Restart loading repeats the same seed. Maximum-speed
flight travels northeast at `flightConfig.maxSpeedBoost` (currently 680 m/s) at
5,000 m altitude. Export results saves
load timing, frame distributions, worker queues, draw counts, and triangle counts.

For a comparison, pin explicit baseline and candidate commits, and use the same
flight speed in both. Use one benchmark tab at a time, the same viewport and seed, and no test
suite running in parallel. The original implementation has no worker stats, so
the page reads its synchronous queue length for the same completion criterion.

## Historical stream-radius measurements

The following archived observations predate the current flight-speed tuning and
chunk 10.839. Their flight speed was 1,605.06 m/s, with baseline commit `929d8cf`.
They are retained as history, not validation of the current build or devices.

Measured in the Codex in-app browser at 1280 x 720, pixel ratio 1, four Balanced
workers on
the updated implementation. These are local observations, not a minimum-hardware
guarantee. Vite development loading, JIT compilation, and device load affect
individual runs.

| Seed / run | Original 16.8 km | Updated 33.6 km | Speedup |
| --- | ---: | ---: | ---: |
| 1337, page load | 6.37 s | 1.48 s | 4.30x |
| 1337, restart | 6.18 s | 1.37 s | 4.51x |
| 1, seed change / page load | 5.88 s | 1.33 s | 4.42x |

Maximum-speed runs held a 60 FPS median and 16.7 ms frame p95: seed 1337 over
26 seconds / 42.5 km and seed 1 over 39 seconds / 63.1 km. The terrain queue kept
up with movement. The isolated benchmark excludes aircraft, settlements, weather,
and HUD. A separate full-game Balanced-quality runway smoke check showed 60 FPS
with the aircraft, settlements, HUD, and a weather transition active, with no
browser shader errors. That smoke check is not an exhaustive full-flight GPU
benchmark on every quality preset or device.

Regression coverage includes grid seams and collision interpolation, buffer
transfer, near-first scheduling and uploads, bounded layouts during fast flight,
fade retention, worker failure fallback, reseeding, and disposal.

Historical validation: `npm run build` passed; all 536 tests across 64 files passed.
After integrating the newer high-G feedback changes, the build and 73 focused
HUD, high-G, world lifecycle, and streaming tests also passed.

# Terrain streaming performance

The streaming radius is 33,600 m, up from 16,800 m. Clear-weather fog ends at
30,240 m instead of 15,120 m; the camera far plane follows the stream radius.

## Implementation

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

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
  A single attachment can exceed that deadline, especially near-field props.
- Contact detail takes priority, followed by nearest missing coverage, then
  distant LOD changes. Movement reprioritizes waiting work; stale world replies
  cannot install after a reset or disposal.
- Outer quadtree leaves reach 32 cells. Representative layouts contain 540-575
  leaves, versus 516 in the original benchmark. Near mesh density is unchanged;
  distant water terrain uses at most 16 segments. Analytic water surfaces remain.
- New terrain and water fade in over 650 ms with smooth opaque fades (alpha-hash
  dithering was removed). Previous coverage stays through the transition.
  Vegetation retains its distance fade.
- Settlement planning keeps its previous range and object caps so extending the
  landscape does not quadruple background settlement work.
- Browsers without working workers retain synchronous generation with the same
  inter-build deadline. Their loading speed and frame times will differ.
- Silent terrain and settlement jobs expire after 15 seconds of active world
  updates and use the existing bounded fallback queues. No wall-clock timer runs
  during pause or hidden-tab time. Settlement replies must match the outstanding
  key, generation, and request kind; late or duplicate results cannot add meshes.

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
inter-build deadline cannot interrupt one synchronous near build; sliced fallback
generation remains a candidate, not a shipped improvement. Re-run in a separate
process without the test suite for comparisons. Samples and hardware are limited;
browser rendering and dense/weather-heavy full-flight profiling are still needed.

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

# 10.948 fresh city and northeast performance record

This is a new record of the shipped 10.947 runtime at `7172eca`, not a before/after optimization comparison. No performance changes are made for this release. Runtime files stay unchanged throughout the six-flight queue. Release metadata advances to 10.948 only after measurements finish.

## Method

Three fresh hardware-Chromium browsers per route run sequentially using the existing development-only FlightReview fixture. Each flight covers 120 simulation seconds and 81.6 km at 680 m/s, with Balanced quality, the production chase camera (reported as `external` by CameraSystem.modeLabel), 1280 x 720, fixed pixel ratio 1 and four terrain workers. City is seed 1337 on the original city corridor; northeast is seed 73 on the original northeast corridor. The fixture prescribes trajectory while the real loop runs flight physics, collision, atmosphere, HUD and rendering. These high-altitude fixed routes are streaming/performance evidence, not manual handling or low-altitude city gameplay acceptance.

CPU profiling, timeline tracing, allocation sampling and forced GC are disabled. No tests, builds, heap snapshots or other review browser overlap accepted flights. Each browser starts with a fresh context; the same Vite server is reused. The hardware renderer and browser version are retained in each raw record. A source manifest and the exact runtime commit identify the measured code. All six completed runs, full RAF arrays, startup statistics, resource samples and final screenshots are retained under `record/`.

Mean FPS is 1000 divided by the arithmetic mean of all recorded positive flight RAF intervals. P95 uses the sorted interval at floor(0.95 * sample count). Stutters are counts of intervals strictly greater than 50 ms and 100 ms. Startup intervals and launch-to-coverage time remain separate from flight statistics. Heap values are decimal MB, with 1 MB = 1,000,000 bytes. The active reference is approximately 200 MB. The reported heap is the main-thread JavaScript heap sampled during the measured flight after initial coverage. It is not total process, worker or GPU memory, and it excludes the earlier startup heap peak. A 120-second record cannot establish sustained or always-new-region memory acceptance or a leak fix.

## Results

| Route / run | Mean FPS | Mean ms | p95 ms | Max ms | >50 / >100 ms | Heap start / end / peak MB | Peak vs 200 MB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| city / 1 | 42.69 | 23.42 | 33.4 | 50.1 | 14 / 0 | 112.1 / 140.2 / 198.2 | within |
| northeast / 1 | 41.54 | 24.07 | 33.4 | 66.7 | 8 / 0 | 120.5 / 111.0 / 208.9 | above |
| city / 2 | 37.99 | 26.32 | 33.4 | 66.7 | 22 / 0 | 109.0 / 127.9 / 190.1 | within |
| northeast / 2 | 36.64 | 27.29 | 33.4 | 66.7 | 7 / 0 | 95.6 / 142.1 / 193.7 | within |
| city / 3 | 36.34 | 27.52 | 33.4 | 83.4 | 22 / 0 | 105.3 / 160.4 / 191.0 | within |
| northeast / 3 | 36.81 | 27.17 | 33.4 | 66.8 | 8 / 0 | 90.4 / 130.1 / 187.3 | within |

Pooled city mean is **39.01 FPS**, with **33.4 ms p95**, **58 intervals over 50 ms**, none over 100 ms and an 83.4 ms maximum. Pooled northeast mean is **38.33 FPS**, with **33.4 ms p95**, **23 intervals over 50 ms**, none over 100 ms and a 66.8 ms maximum. Each pooled calculation uses all raw flight intervals for that route, not the median of three runs.

City peak heaps are 198.2, 190.1 and 191.0 MB. Northeast peaks are 208.9, 193.7 and 187.3 MB. One of six runs exceeds the 200 MB reference, by 8.9 MB. The end heaps are lower than their respective peaks. These short runs show heap variation around the active target; they do not establish sustained memory acceptance. No memory reduction below the target is pursued, and no unmeasured performance fix is included. The city mean FPS range of 36.34 to 42.69 also prevents a stability or improvement claim from a favourable individual run.

All six records match the source commit, environment, viewport, quality, ratio, distance and four-worker requirements, with zero page errors. `summarize-performance-record.mjs` checks these conditions and recomputes the summaries from the full raw interval arrays. City-3 and northeast-3 browser captures were visually inspected: the aircraft, instruments, terrain and weather render, with no blank canvas or visible missing-terrain hole in these high-altitude views. The development review panel is intentionally present. These views do not establish detailed low-altitude city artwork acceptance.


The focused flight-review, streaming, settlement-budget, version and paused-exclusion set passes 64 tests in five files. The production build and synchronized version check pass.

## Reproduction

Start Vite on port 5174. Set `PLAYWRIGHT_MODULE` to the installed Playwright module and `CHROMIUM_PATH` to hardware Chromium. Run:

```sh
REVIEW_URL=http://127.0.0.1:5174 REVIEW_DIRECTORY=docs/reviews/performance-10.948 REVIEW_RUNS=3 REVIEW_ROUTES=city,world REVIEW_CAPTURE=1 node scripts/profile-flight.mjs record
node scripts/summarize-performance-record.mjs docs/reviews/performance-10.948
```

Use an empty output directory for fresh repetitions. Keep tests, builds and other review browsers outside the measurement queue. No result is discarded for a slower FPS, stutter or higher heap value. These unprofiled results must not be compared directly with historical traced or allocation-profiled batches as evidence of improvement. The historical 400 ms hitch cause remains unverified unless fresh attributable evidence establishes it.

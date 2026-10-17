# Streaming allocation and native-gap review, 10.917

Base: `68ad6a8`, chunk 10.916. The matched comparison retains the 10.915
seed-1337 city and seed-73 northeast routes, three fresh browsers per route
on each side, 120 simulation seconds at 680 m/s, Balanced, chase camera,
1280 x 720 and fixed pixel ratio 1. CPU sampling, method timers, timeline
categories and strict >50 / >100 ms thresholds match 10.915. No build, tests
or second profiling browser runs alongside the acceptance flights.

The six fresh baseline flights reproduce the problem: **88 intervals >50 ms,
5 >100 ms, a 499.9 ms maximum, and city/northeast peak heaps of
195.0 / 149.6 MB**. The historical 10.915 before target remains 51 intervals
>50 ms, at most one >100 ms, and 184.9 / 155.4 MB peak heap. Fresh baseline
results are not a replacement for those acceptance targets.

The candidate finishes with **49 intervals >50 ms, zero >100 ms, a 66.7 ms
maximum, and city/northeast peak heaps of 149.7 / 217.8 MB**. The smaller-stall,
long-stall and city-heap targets pass. **The northeast heap target fails**, and
its peak worsens against both the fresh and historical baselines. No overall
heap win or completed memory acceptance is claimed.

| Flight metric | Fresh before | After | Historical acceptance target |
| --- | ---: | ---: | ---: |
| >50 ms intervals, six flights | 88 | 49 | <=51 |
| >100 ms intervals, six flights | 5 | 0 | <=1 |
| Worst interval ms | 499.9 | 66.7 | 250.0 historical before |
| City peak heap MB | 195.0 | 149.7 | <=184.9 |
| Northeast peak heap MB | 149.6 | 217.8 | <=155.4 |

All final after-run p95 values are 33.4 ms. The before city run 3 is 49.9 ms;
other before p95 values are 33.4 ms. Mean intervals improve in three of six
paired runs and worsen in the first two city runs and first northeast run. This is not a universal
FPS improvement. Peak settlements/buildings/roads/queue remain 2/1238/1/11
for the city and 3/848/1/11 for the northeast in all twelve flights.
The northeast run 2 ends at 83.9 MB after its 217.8 MB peak. Its main-thread
GC events are retained in `heap-gc-evidence.json`; that does not establish which
source allocation caused the peak or justify excluding it.

Every final run is retained in `before/` and `after/`; `measurements.md` and
`summary.json` are generated directly from their raw samples. No outlier is
removed. JS heap is browser telemetry, not process RSS or GPU memory.

## What the evidence establishes

All five fresh baseline flight intervals >100 ms have little captured main
JavaScript work and no dominant GC/assembly span. The 499.9 ms interval samples
about 495.8 ms as `(program)`. That is not proof of GC, uploads or compilation.

A separate native diagnostic records a startup compositor task containing
200.5 ms in `GLES2::ReadPixels` and 195.8 ms waiting for GPU commands. A second
capture records **267.3 ms of compositor canvas readback within a 283.4 ms
startup interval**. The old JavaScript-focused trace categories did not expose
that task. See `native-evidence/world-1.hitches.json` and its bounded trace.
The actual WebGL renderer remains Intel ANGLE Vulkan; this is not a
software-WebGL capture. GPU compositing is enabled. No backend flags or
acceptance settings are changed to make the comparison faster.

The continuous native capture fills its buffer at about 104.6 seconds after
navigation, retaining 4,418 main-thread RAF events versus 5,115 measured flight
intervals. Its startup interval is covered, but its omitted tail cannot be used
for attribution. Both native diagnostic flights have no >100 ms flight
interval. The exact cause of the historical 483.3 ms and fresh 499.9 ms flight
outliers remains unproven. Compositor readback is a demonstrated startup cause
and a possible flight-gap explanation, not a retrospective proof.

`native/` retains the first bounded-window GPU/allocation diagnostic.
`native-continuous/` retains the repeated flight and complete exported file
with the buffer-coverage limitation above. `native-continuous-rejected/`
retains the earlier completed flight whose export exceeded V8's single-string
limit; it has no usable timeline and is excluded from attribution and acceptance.
The exporter now streams compressed chunks instead of assembling one huge string.
Full timelines stay local; bounded evidence and complete CPU captures are published.

The allocation diagnostic estimates 2.209 GB of allocation, including boot,
flight and trace-export time, with collected objects included. This is allocation
volume, not live heap. Post-flight forced GC reports 66.6 MB, outside every
acceptance measurement. `allocation-evidence.json` retains the ranked estimates.
Renderer shader parameter/uniform work, hydrology, surface refits, scheduling
and road preparation all contribute. Regional weather remains direct sampling
with fixed snapshots and no visited-cell cache. The worker-only road profile
cache is unchanged from 10.913 through 10.916; it is not a new main-thread cache.
This evidence does not identify a single source change as the cause of the
historical heap peaks, so no causal heap claim or speculative revert is made.

## Changes held under review

- Stage only refit heights, retaining one third of the previous drape staging
  bytes. Preserve atomic publication, all positions, normals, contacts and the
  1,024-vertex budget.
- Emit road indices while retaining only the preceding cross-section instead
  of one JavaScript array per row. Preserve every road geometry buffer byte.
- Reuse quadtree split scratch and replacement lists; avoid per-frame Map entry
  pairs when pruning city roads.
- Query the existing hydrology cache before creating survey preparation
  iterators. Cache eviction/reseed still takes the cooperative cold path.
- Give existing deck, tinted local pier and untinted regional pier draws
  separate material state, preserving their shared shader programs and draws.
  Three.js otherwise switches the current instancing/colour variant on the
  same material and rebuilds shader parameters/uniform lists.
- Prepare the silent audio graph during boot. Play still resumes audio from
  its gesture. Boot-ready now includes that work instead of moving it off-ledger.

Both shadow-light warmups and cooperative geometry/hydrology preparation are
retained. Their removal would re-expose previously attributed first-use and
cold-query work without establishing a cause for the compositor gaps.
Geometry, collision, water detail, draw distance, workers, uploads, profiles,
supports, draw families, building limits and all existing budgets are preserved.

## Verification and reproduction

The 192 focused checks pass, including independent 10.916 road-buffer hashes,
cooperative publication/cancellation, terrain LOD/contact/streaming, exact survey
and eviction behavior, warmup ownership, audio preparation and world lifecycle.
The production build passes. All six final flight stills are retained. Low-altitude
city-road chase and cockpit views at 90 m clearance are inspected in `views/`,
with no page errors. Road/asphalt/shoulders, water, terrain and aircraft remain
visible. These fixed poses do not constitute a manual flight-handling review.

Start Vite on 127.0.0.1:5173. Set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` to the
installed Playwright module and Chromium executable. Use:

```sh
REVIEW_DIRECTORY=docs/reviews/performance-10.917 REVIEW_PROFILE=1 REVIEW_TRACE=1 node scripts/profile-flight.mjs LABEL
node scripts/attribute-flight-hitches.mjs docs/reviews/performance-10.917/LABEL
node scripts/summarize-hitch-runs.mjs docs/reviews/performance-10.917
```

Native diagnostics additionally set `REVIEW_NATIVE_TRACE=1`; continuous capture
also sets `REVIEW_NATIVE_CONTINUOUS=1`. They are excluded from acceptance.
`scripts/extract-native-trace.py SOURCE TARGET` streams large timelines into
bounded evidence and records coverage limitations. Source manifests identify
the measured code before release-only metadata changes. Paused systems remain
excluded. Sustained weather memory, coastal connectivity and rough-terrain road
artwork are handled separately from this comparison.

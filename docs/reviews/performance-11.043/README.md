# Performance debt, chunk 11.043

The synchronous seed-1337 pilot query is corrected. Historical full-flight timing
acceptance remains open. This work addresses roadmap item 11 only; items 12 and
13 remain parked. Public release stays v0.12.0.

The test laptop is an Intel Core i5-1135G7 laptop, 4 cores / 8 logical CPUs,
16 GB RAM, Ubuntu 22.04, Node v22.23.2. Measurements run sequentially, without
other review flights, builds, tests or profilers overlapping timed work.

## Cause and change

The b19 attribution is still accurate on current code. The injected pilot calls
`sampleTerrainSurfaceHeightFast` at 0, 500, 1000, 1800, 3000, 4500, 6000 and
8000 m ahead every half second. At aircraft X 56063 / Z 34982, heading east,
the last point is X 64063. That enters hydrology catchment (2, 1), beyond the
32000 m boundary. A cache miss in `Hydrology.catchment` drains
`buildCatchmentSteps` synchronously, including regional river surfaces and lake
clipping. This is review instrumentation, not an attributed production flight,
worker, upload, GPU or physics defect.

The review-only `TerrainReviewSurvey` checks all points before taking any
analytic sample. Cold queries request the existing cooperative preparation
iterator. The RAF observer advances it once per rendered frame with a 1 ms
soft deadline, shared across all fixed physics steps. Individual generator
steps can exceed that deadline. Until ready, the pilot keeps its last finite
altitude target and retries. When ready, it uses exactly the previous analytic
surface sampler, distances, clearance and slope penalty. No mesh approximation
or replacement height is returned. Restart or departure cancels partial work.

The pilot's target update can now be delayed while cold drainage is prepared;
its flown trajectory is therefore not promised identical. Generated mission
route geometry, terrain and water are unchanged. Production source changes
only `src/core/Version.ts`. No physics, scoring, controls, replay format,
storage keys/records/IDs, worker limits, streaming budgets, 16-upload cap, LOD
distances or detail levels change. The production contact sampler remains exact.

## CPU reproduction

Eight independent seed-1337 cold builds per mode, with catchment (1, 1) warm
and (2, 1) cold. Nothing is dropped as warmup. All samples and identities are
in [before](cpu-before.json) and [after](cpu-after.json).

| Node CPU measure | Before | After |
| --- | ---: | ---: |
| Median largest uninterrupted timed slice | 46.104 ms | 2.400 ms |
| Worst timed slice | 87.392 ms | 3.478 ms |
| Median sum of timed slices | 46.104 ms | 43.606 ms |

The median largest slice falls by 94.8%. This is a latency result, not an FPS
or total CPU speedup. After-mode slice sums time `advance()` only, excluding
ready checks, the final warm analytic sampling, and event-loop waiting.
Node uses `setImmediate` between slices rather than real rendered frames.

[The isolated browser CPU reproduction](browser-cpu.json) uses the same point
queries in Chromium 153, on an otherwise empty page, eight before then eight
after. After-mode advances once per native RAF. This isolates main-thread
hydrology; it does not render the game or reproduce endurance acceptance.

| Browser CPU measure | Before | After |
| --- | ---: | ---: |
| Median largest timed slice | 41.150 ms | 5.650 ms |
| Worst timed slice | 85.800 ms | 9.300 ms |
| Median sum of timed slices | 41.150 ms | 144.200 ms |
| Median query wall time | 41.150 ms | 1801.200 ms |
| Observed query long tasks | 2 | 0 |

The median largest slice falls by 86.3%, but browser preparation CPU and wall
time increase substantially. The eight after queries each await many RAFs;
this is the cost of deferral, not faster drainage generation. JIT, scheduling
and the changed call pattern can affect these single ordered groups. No hard
1 ms guarantee, whole-game long-task elimination or FPS gain is claimed.

Every before/after target is exactly `2801.531937224386`. The affected catchment
SHA-256 is `51c372ada6a541c26b31e70cd5fecd958d34381a3b8acbba85a403d567df2790`.
The JSON identity sections also match for all bytes of heights, water levels,
ground/water attributes, indices and bounds in three near/mid/far tiles at the
boundary; and for complete mission recipes, including course points, across
seeds 42, 1337 and 9001 in all five existing themes. Existing legacy terrain,
water and hydrology identity tests supplement these bounded fixtures. This is
not an exhaustive worldwide hash sweep.

## Browser flights and limitations

The documented Vulkan flags load the page but leave it unresponsive before
flight begins. The original b19 attempt was interrupted without timing data;
a separate page-load probe also stopped responding. Explicit
`REVIEW_SWIFTSHADER=1` works. Its WebGL renderer reports:

`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`

SwiftShader is software rendering. Results are not comparable to the hardware
measurements in 10.989 or b19. Runs below are failed/incomplete diagnostics;
they do not replace or retroactively accept any historical excluded flight.

The 10.989 method still uses a production-mode injected build, native RAF,
1280 x 720, device scale 1, Balanced, fixed chase, capture OFF, profiler OFF,
and omission of only the first ten intervals. Its original complete-flight
runner and audit require five gates and a landed gold result. Current missions
have 8–20 gates and airborne finishes, so that acceptance contract is stale.
It was not relaxed to create passing evidence. A 60-wall-second diagnostic
limit now saves an incomplete record before the existing failure is reported;
the normal runner default remains 600 seconds. The SwiftShader option also
requests precise main JS heap reporting. Heap excludes workers, GPU and total
browser memory.

The b19 method retains the historical seed-1337 start, east heading, 650 m
clearance, controls pilot, automatic weather, fixed pixel ratio 1 and original
histogram/capture rules. The requested diagnostic duration is 185 simulated
seconds. Its after attempt uses a diagnostic-only wall limit; no full ten-minute
acceptance is claimed. It does not reach the historical 171.85-second trigger.
The isolated CPU checks above exercise that precise cold query instead.



| Partial mission attempt | Sim / wall seconds | RAF/s | p95 / max ms | >50 / >100 ms | Peak main heap MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| waterway-tour before | 1.317 / 60.137 | 1.295 | 883.3 / 900.0 | 69 / 69 | 58.51 |
| coastal-run before | 1.483 / 60.158 | 1.288 | 883.4 / 933.3 | 72 / 72 | 59.61 |
| waterway-tour after | 1.600 / 60.076 | 1.425 | 833.3 / 850.0 | 79 / 79 | 66.70 |
| coastal-run after | 1.467 / 60.187 | 1.289 | 850.0 / 899.9 | 71 / 71 | 64.40 |

All four are incomplete, with one gate passed; Waterway has 12 gates and
Coastal has 15. There are no unhandled browser/application errors. The static
review reports the existing known `/models/f35.glb` 404 in all four attempts
and uses the built-in aircraft fallback; those messages remain in each raw
record under `knownFallback`. This is another limit on comparison with other
asset installations. None reaches the
runner's post-10-second coverage sampling boundary, so no coverage acceptance
is inferred. The modest differences between partial RAF counts/percentiles are
not evidence of an FPS gain; the production workload is unchanged apart from
release metadata. [Raw before records](generator-before/waterway-tour-1337.json),
[before Coastal](generator-before/coastal-run-42.json),
[after Waterway](generator-after/waterway-tour-1337.json),
[after Coastal](generator-after/coastal-run-42.json) retain every interval,
approximately one-second samples, GPU identity and source manifests.

| Partial b19 attempt | Sim / wall seconds | Intervals | p95 / rounded max ms | >100 ms | Max terrain update ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| before | 2.283 / 78.819 | 129 | 733.3 / 833.3 | 129 | 26.1 |
| after | 1.667 / 60.016 | 99 | 733.3 / 816.7 | 98 | 20.1 |

The [before record](b19-before.json) was manually interrupted after its slow
progress became clear. The [after record](b19-after.json) stops at the explicit
60-second diagnostic wall limit. These unequal, very short simulation windows
are not a controlled frame comparison. After-mode survey deferrals/slices are
both zero because the route never reaches the cold boundary; the separate CPU
checks and regression tests exercise that path. No new flight profile or
attribution near 171.85 seconds was possible on this renderer. The old early
300 ms event, excluded alternate-seed intervals and high-altitude image finding
remain unresolved and outside this fix.

An endpoint still was captured after the final timed samples and visually
inspected: [screenshots/1337-endpoint.jpg](screenshots/1337-endpoint.jpg).
It shows the chase aircraft, instruments, terrain and water; one still does not
certify route-wide seams, LOD or performance. The earlier launcher probe is
[screenshots/launcher-probe.png](screenshots/launcher-probe.png). Both screenshots
are committed and under 1 MiB. All retained measurement artifacts are JSON/Markdown, under 1 MiB
per file. [summary.json](summary.json) is regenerated by the audit below.

## Verification and reproduction

- `npm test -- --maxWorkers=2 --reporter=verbose`: 277 Vitest files / 3,421
  tests pass, plus 8 Node test-runner checks. New regressions cover cold-query
  deferral without analytic calls, shared slices across repeated fixed-step
  polls, cancellation/restart, warm queries and exact seed-1337 drainage/heights.
- The first version check exposed a fixture mixing `HEAD`'s roadmap with the
  working-tree Version/README/CHANGELOG. It now reads the working-tree roadmap
  consistently. An initial default-concurrency full-suite attempt hit the
  existing river-union five-second timeout and was interrupted. A nonverbose
  two-worker attempt was also interrupted before a final result; the complete
  verbose two-worker run passes, including that river test. No test timeout or
  production worker budget was raised.
- `npm run build`: version consistency, TypeScript and production build pass.
  The existing Three.js bundle-size advisory remains.
- A separate strict TypeScript check of `scripts/lib/terrain-review-survey.ts`
  passes with `tsc --ignoreConfig --noEmit --target ES2023 --module ESNext
  --moduleResolution bundler --skipLibCheck --strict --noUncheckedIndexedAccess
  --types vite/client scripts/lib/terrain-review-survey.ts`.
- `node scripts/build-generator-review.mjs`: minified production review build
  passes. Timing uses this build, not the dev server, for the two mission cases.
- `node scripts/audit-performance-debt.mjs`: recomputes all four mission frame
  metrics, checks contiguous timestamps, exact height targets, before/after
  identity hashes, unchanged production source except release metadata, helper
  identity, failed/incomplete status and artifact sizes. It does not turn
  partial runs into flight acceptance.

CPU reproduction (run sequentially without other profilers/tests/builds):

```sh
node scripts/measure-terrain-lookahead.mjs before /tmp/cpu-before.json
node scripts/measure-terrain-lookahead.mjs after /tmp/cpu-after.json
# Requires the separate Vite source server on 5174 and external Playwright:
REVIEW_URL=http://127.0.0.1:5174 node scripts/measure-browser-lookahead.mjs /tmp/browser-cpu.json
```

Set `PLAYWRIGHT_MODULE` to the installed Playwright `index.mjs` and
`CHROMIUM_PATH` to the Chromium executable. The retained runs used the installed
Chromium 153.0.8010.12 binary. Start the source server with
`npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`.
For mission measurements, build with `node scripts/build-generator-review.mjs`
and serve `/tmp/blackout-generator-production` on 5176. Then run sequentially:

```sh
REVIEW_SWIFTSHADER=1 REVIEW_WALL_SECONDS=60 REVIEW_PART=perf11-rerun REVIEW_COURSE=waterway-tour REVIEW_SEEDS=1337 REVIEW_CAPTURE=0 node scripts/review-generator.mjs
REVIEW_SWIFTSHADER=1 REVIEW_WALL_SECONDS=60 REVIEW_PART=perf11-rerun REVIEW_COURSE=coastal-run REVIEW_SEEDS=42 REVIEW_CAPTURE=0 node scripts/review-generator.mjs
```

Those commands intentionally retain the stale landing acceptance and return
failure for incomplete runs. Omit `REVIEW_WALL_SECONDS` for the original
600-second wall limit. Omit the explicit software-renderer option to try the
original Vulkan configuration. The old historical audit is not reported as
passing on these current, incomplete airborne runs.

For the corrected b19 pilot, copy the archived `routes.json` to a new directory,
then run against 5174:

```sh
REVIEW_URL=http://127.0.0.1:5174 REVIEW_SWIFTSHADER=1 CLOSEOUT_SEEDS=1337 CLOSEOUT_DIAGNOSTIC_SECONDS=185 CLOSEOUT_WALL_SECONDS=60 CLOSEOUT_CAPTURE_ENDPOINT=1 node scripts/review-terrain-closeout.mjs /tmp/new-b19-review endurance
```

The wall limit is allowed only on diagnostic flights. Remove it to attempt the
full diagnostic duration. `CLOSEOUT_PROFILE=1` remains a separate diagnostic
mode; do not overlap it with unprofiled timing. The before b19 run used the
unchanged archived pilot hash
`5e56e767f56ab99b1626e69b8b9686fef864e81bb63c9fbe661e803f8a9df6f6`,
with only the explicit SwiftShader launch fallback in the runner. Historical
records/hooks are retained unchanged. Newly generated temporary hook manifests
are removed after copying their embedded provenance into these raw records.

The base is `3eb9ef16568188f22d597ca5aa119a97eac0555e`, equal to the clone's
cached `origin/main`. The required pull could not fetch because this environment
mounts `.git` read-only. That also prevents staging, committing and a clean
committed delivery; no push, tag or release is performed. No fix commit SHA is
claimed. The working-tree changes and this evidence are ready for review.

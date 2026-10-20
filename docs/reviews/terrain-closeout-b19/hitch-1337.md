# Seed-1337 hitch attribution, b19s, 10.957

The recurring stall near 171.9 seconds is caused by the injected review pilot's synchronous 8 km look-ahead surface query entering a cold hydrology catchment. This is review instrumentation work. The sampled stack does not originate in the production terrain update, worker publication, GPU upload, shader compilation, settlement/road assembly, weather or GC. No production repair is justified, so production source is unchanged except release metadata.

The required initial pull found main clean and current at `2038dd9` (10.956). There were no uncommitted leftovers. No full ten-minute attempt was consumed in Part A. Both diagnostic flights use the historical seed-1337 endurance start, heading, 650 m clearance, production physics, automatic weather and the original controls pilot. They deliberately stop after 185 seconds. No test, build, other flight or independent profile overlaps either run. The second flight is explicitly a diagnostic profile, excluded from acceptance.

## Reproduction and measured cause

| Diagnostic | Simulation / wall seconds | Observation |
| --- | ---: | --- |
| `diagnostics/reproduction/endurance/1337.json` | 185.400 / 186.533 | Original hook, no profiler. No interval strictly over 100 ms; largest interval is 100.0 ms. The route crosses the historical event location. |
| `diagnostics/profile/endurance/1337.json` | 185.267 / 186.562 | Same route with diagnostic method timings and CPU/GPU trace around 165-178 s. The recurring stall is present, though its RAF interval rounds just below the strict exclusion threshold. |

In the profile, the review `before` method begins at simulation 171.850 s and takes **84.0 ms**. A browser Long Tasks entry records **101 ms** for the enclosing main-thread task. The following RAF gap is **99.9 ms** at simulation 171.867 s, with an actual callback-observation gap of **101.9 ms**. The prior production terrain update is near zero in the historical failures. The same work falling either side of 100 ms explains why this reproduction is not a fresh 100-135 ms exclusion while still reproducing the underlying stall.

The CPU profile attributes 85.643 ms of samples to the review `before` subtree across the trace window. The cold stack is:

```text
tick
  injected review before
    sampleGeographySurfaceInto
      sampleHydrologyInto
        catchment
          buildCatchmentSteps
            regionalDrainageSteps
              riverSurface / clipLakeShore / basinDistance
```

The original hook directly calls `sampleTerrainSurfaceHeightFast` at distances 0, 500, 1000, 1800, 3000, 4500, 6000 and 8000 m every half second. Near aircraft x 56063, z 34982, the far query reaches x 64063 and crosses the 32000 m catchment boundary into cell (2, 1). `Hydrology.catchment` drains its generator synchronously on a cache miss. This is the deterministic spatial trigger. The production survey-label path already uses `sampleSurveySurface` with cooperative preparation instead. Neither that production path nor the flight physics is changed.

At the recurring event, measured renderer calls around the stall are 2.4-5.8 ms. Method timing and the CPU stack assign the large synchronous work to the review query itself. A raw Chrome performance trace, compressed CPU profile, observer output, frame timestamps and a derived attribution summary are archived together under `diagnostics/profile/endurance/`. `node scripts/summarize-terrain-hitch.mjs` regenerates and checks `attribution.json` from the retained profile and method data.

Profiler startup separately introduces a **266.6 ms** RAF interval at 165.650 s. This is an induced diagnostic artifact, outside the recurring event, and is not acceptance evidence. The old 300 ms interval at 3.7 seconds was not reproduced; it remains unattributed. This investigation does not claim all possible whole-game stalls are excluded.

## Decision and remaining issue

The first selected fallback was seed 2026. B19s ultimately records the third clean flight on seed 1 after excluding full attempts on 2026 and 9001; see [the endurance record](b19s-endurance.md). Keep the original acceptance hook, strict greater-than-100 ms rule, capture exclusions and production runtime unchanged. The runner now supports the three authorized alternative seeds using their existing `routes.json` poses, because historical endurance pins only exist for 42, 73 and 1337. Those three historical pins remain exact. No route generation or route revision changes.

Seed 1337 remains a **known open review performance issue** in ROADMAP: the synchronous pilot look-ahead is retained, its historical failed flights remain excluded, and there is no clean full seed-1337 acceptance flight. A future review-harness correction would need its own validation. It is outside the remaining close-out requirement if the authorized alternate seed passes. No speculative game optimization or heap chase is made.

## Reproduction

Run a Vite source server, supply external Playwright through `PLAYWRIGHT_MODULE` and the browser through `CHROMIUM_PATH`, and copy the unchanged `routes.json` into a new directory. For the short original-hook pass:

```sh
CLOSEOUT_SEEDS=1337 CLOSEOUT_DIAGNOSTIC_SECONDS=185 node scripts/review-terrain-closeout.mjs <directory> endurance
```

Repeat in a separate directory with `CLOSEOUT_PROFILE=1` to collect the diagnostic observer, CPU profile and trace. Profile mode refuses a normal acceptance flight. A diagnostic duration must be 180-599 seconds. The archived hook hash covers the added observer as well as the original pilot when profiling. All 16 diagnostic chase/cockpit stills were visually inspected: no seam, gap, floating settlement or broken road was observed; night/cloud visibility limits the later stills. These short runs do not count toward the three ten-minute flights.

Verification is retained in `verification/b19s-part-a.txt`: key terrain/biome/contact/settlement/metadata checks, production build, attribution regeneration, hook identity and unchanged production source checks. The existing bundle-size advisory remains.

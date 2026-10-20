# Terrain close-out b19s, final report, 10.959

**The scoped good-enough bar is met. Roadmap step 1 is DONE.** The retained six-seed appearance, biome and normal-altitude LOD checks pass. Seeds 42, 73 and 1 supply three accepted ten-minute flights under the original runner and acceptance rules. The user-authorized alternate seed is used because the recurring seed-1337 stall is attributed to the injected review pilot. No production game defect is established by that hitch investigation, and production terrain and physics are unchanged.

This decision is bounded to the agreed appearance routes and altitude envelope, plus the accepted endurance records. It is not a claim of defect-free rendering at every coordinate or altitude. The known seed-1337 harness issue, unattributed excluded-flight intervals and a new unresolved high-altitude image finding remain visible below and in ROADMAP/summary metadata.

## Four bar decisions

| Required item | Decision | Evidence |
| --- | --- | --- |
| No visible seams, gaps or floating objects on six seeds in low-altitude chase and cockpit | Met within the retained routes | Six fresh 45-second flights and 36 inspected stills under `final/`, following the independent `audit/` set |
| Distinct alpine, desert/badlands, green, volcanic and coastal biomes | Met | Snow ridges on 42; tan slopes/orange badlands on 2026; green rolling ground on 9001; charcoal cinder relief on 1; sand and blue coastal water on 73; city/hinterland on 1337 supplements object contact coverage |
| No obvious LOD popping at normal flight altitude | Met within the retained sequences | Six passes longer than 25 seconds, sampled AGL 565-909 m, six continuous 1280 x 720 WebMs and 240 inspected half-second frames under `lod/` |
| Three clean ten-minute flights | **Met on 42, 73 and 1** | Each exceeds 650 simulation and wall seconds; no interval over 100 ms, terrain update over 50 ms, contact or browser/application error; original screenshot exclusions and coverage warmup retained |

The final missing endurance item is complete. No additional appearance polish, mission work or physics work is added to b19. The high-altitude finding below is retained outside the agreed appearance-route envelope rather than expanding this batch's acceptance requirements. No b20 work starts.

## Retained appearance evidence

| Seed | Reviewed group | Fresh low-altitude duration | Sampled low-altitude AGL |
| --- | --- | ---: | ---: |
| 42 | Alpine | 45.950 s | 135-361 m |
| 2026 | Desert/badlands | 46.000 s | 35-595 m |
| 9001 | Green | 45.317 s | 103-202 m |
| 1 | Volcanic | 45.233 s | 44-360 m |
| 73 | Coastal | 45.300 s | 96-233 m |
| 1337 | City/green hinterland | 45.233 s | 290-609 m |

The b19r review inspected all 36 final low-altitude stills, all twelve LOD sequence sheets and all 88 stills from its two accepted and two full excluded endurance flights. No visible seam, uncovered gap, floating building or broken/floating road was reproduced in its reviewed appearance routes. `visual-review.md` records those findings and sequence limits. One seed-1 missing-height query occurs at 0.0167 seconds after the airborne reset in both final and LOD telemetry. No coverage query is missing after the five-second reset warmup, and every retained final/LOD picture pose has resident mesh coverage.

LOD sheets sample approximately 5.0-24.5 seconds after reset; raw videos retain startup and the first five seconds. Alignment is approximate, based on video duration minus measured flight wall duration. Cameras switch deliberately, including paired screenshot captures. No obvious terrain silhouette jump, opening crack or abrupt terrain patch is observed between the retained normal-altitude sequence frames. These are bounded route and temporal checks.

`mission-loads.json` verifies the five featured missions and Random world select and launch without recorded application/console errors. This is a loading smoke check only. No current mission is polished or claimed complete.

## Three accepted endurance flights

| Record | Simulation / wall seconds | p95 / maximum frame interval | Terrain update maximum | Peak sampled main JS heap |
| --- | ---: | ---: | ---: | ---: |
| `endurance/42.json` | 650.500 / 650.520 | 33.4 / 66.7 ms | 27.3 ms | 218.3 MB |
| `endurance/73.json` | 650.333 / 650.382 | 33.4 / 83.3 ms | 25.3 ms | 236.9 MB |
| `endurance/1.json` | 650.533 / 650.537 | 33.4 / 83.3 ms | 27.2 ms | 209.4 MB |

Each accepted flight retains 22 paired minute stills. Seed 1 covers approximately 143.193 horizontal km. All three have zero aircraft crashes, ground contacts and browser/application errors. Seeds 42 and 73 have zero missing terrain queries. Seed 1 has one reset-frame miss at 0.0167 seconds, and none at or after the existing five-second coverage boundary; all picture poses have coverage. This applies the original coverage rule, not a new waiver. Early timing gaps still count.

Automatic weather and lighting stay active. Frame timing excludes only the declared 1.5-second window per screenshot. All terrain update costs, including screenshot periods, remain counted. Heap is observed against the approximate 200 MB target, without optimization or a memory improvement claim. This controls pilot is not a manual-handling acceptance test.

Exactly three full attempts were made in b19s, on 2026, 9001 and 1. The first two fail the original timing rule and remain excluded. No tests, builds, independent profiles or other review flight overlap any timed capture. Profiling is confined to a separate short diagnostic flight. See [the detailed endurance record](b19s-endurance.md).

## Attribution and retained exclusions

[The seed-1337 investigation](hitch-1337.md) identifies an 84.0 ms synchronous cold hydrology build inside the injected review pilot's 8 km look-ahead query at 171.850 seconds. The enclosing main-thread task is 101 ms. The sampled stack runs from review `before` through `sampleGeographySurfaceInto`, `sampleHydrologyInto`, `catchment`, `buildCatchmentSteps` and `regionalDrainageSteps`, including river-surface/shore clipping work. Near aircraft x 56063, the far query crosses x 64000 into a new 32000 m catchment. The production survey-label path already prepares hydrology cooperatively.

The original-hook 185-second diagnostic peaks at 100.0 ms with no strict exclusion. The profiled pass reproduces the same stall with a 99.9 ms RAF interval and 101.9 ms observed callback gap. Its separate 266.6 ms profiler-startup interval is explicitly diagnostic-only. The historical 100-135 ms failures are not erased or retroactively accepted. No GPU/shader/worker/settlement/GC fix is claimed; measured work and the CPU stack locate the recurring synchronous cost in the review hook. The original pilot is retained unchanged for all accepted endurance flights.

| Excluded record | Duration | Retained reason |
| --- | ---: | --- |
| Original `endurance-supplemental/1337.json` | 372.333 s | 116.6 ms at 171.883 s; deliberately stopped |
| `endurance-partial/1337-usage-limit/1337.json` | 116.667 s | Usage-limit interruption; no timing exclusion in the partial record |
| `endurance-supplemental/1337-b19r-attempt-1/1337.json` | 650.233 s | 100.1 ms at 171.883 s |
| `endurance-supplemental/1337-b19r-attempt-2/1337.json` | 650.450 s | 300.0 ms at 3.700 s; 133.4 ms at 171.867 s |
| `endurance-supplemental/2026-b19s-attempt-1/2026.json` | 650.600 s | 116.6 ms at 497.667 s, unattributed |
| `endurance-supplemental/9001-b19s-attempt-2/9001.json` | 650.267 s | 516.7 ms at 523.900 s, unattributed |

The early seed-1337 300 ms event was not reproduced or attributed. Neither excluded alternate-seed interval was profiled; the seed-2026 event is near another far-look-ahead catchment boundary, but that is not causal proof. The recurring seed-1337 review performance issue remains open and unfixed, with no clean full seed-1337 flight. The explicitly authorized fallback closes the three-flight item without hiding these limitations.

## New high-altitude image limitation

All 66 stills from the three b19s full flights were inspected. The seed-1 605-second chase/cockpit pair contains a small sky-colored rectangular patch on distant ground. Its cockpit state is 606.633 seconds and 2566.98 m AGL, outside the accepted low-altitude and 565-909 m normal-altitude appearance envelope. The still is retained unchanged.

A separate static same-pose scene check after 25 seconds of terrain settling shows continuous terrain at that image position. A ray through the approximate patch pixel hits `TerrainChunk` at x 33111.659, y 183.507, z 39881.270. The script, settled image and ray data are archived under `diagnostics/seed1-high-altitude-patch/`. This uses a static camera and world updates after a normal launch, not another endurance attempt or physics acceptance flight.

This check does not explain the original image or rule out a transient rendering/streaming gap. The finding remains unresolved; no repair or exhaustive appearance claim is made. The close-out decision preserves the previously agreed bounded appearance checks and records this higher-altitude limitation explicitly. Night/cloud stills further limit visual inspection. No new acceptance rule, feature or roadmap item is added.

## Frozen source, validation and reproduction

The b19s initial pull found a clean main at `2038dd9` (10.956). Appearance/LOD evidence and accepted flights 42/73 use `5ec0cd5` (10.953); b19r full excluded 1337 attempts use `ff0613e` (10.954); all three b19s full attempts use `d93f312` (10.957). Production source across these captures is byte-identical except `src/core/Version.ts`. Full source-file sets and hashes, runtime identity, route poses and archived hooks remain recorded. No production terrain, physics, collision, scoring or route revision changes are made.

The runner performs one airborne reset, then uses control axes and throttle only. The original hook hash remains `5e56e767f56ab99b1626e69b8b9686fef864e81bb63c9fbe661e803f8a9df6f6`. Historical endurance starts/headings stay pinned to `docs/reviews/stability-10.941/` for 42, 73 and 1337. The authorized alternatives use their existing `routes.json` poses. Seed 1 uses x -92800, z -13600, heading 1.1780972450961724 and 650 m starting clearance.

`node scripts/summarize-terrain-closeout.mjs docs/reviews/terrain-closeout-b19 --final` validates **21 complete required records**. It checks source identity excluding release metadata, hook hashes, stills, both cameras, durations, flight states, coverage, pinned route poses and the original endurance timing thresholds. `endurance-selection.json` explicitly selects 42, 73 and 1; `summary.json` has `completeEvidence: true`, plus retained open performance and image findings. Record completeness is distinct from the manual scoped appearance decision. No supplemental or diagnostic run counts as accepted. The ten validator regression checks include rejection of changed routes, runtime, timing, coverage, diagnostic/short evidence and unauthorized seeds.

To reproduce, run a Vite source server and supply external Playwright through `PLAYWRIGHT_MODULE`, browser path through `CHROMIUM_PATH` and optional `REVIEW_URL`. Copy unchanged `routes.json` to a fresh directory and run `CLOSEOUT_SEEDS=1 node scripts/review-terrain-closeout.mjs <directory> endurance`. Keep new evidence separate from archives and do not overlap tests/builds/profiles. Diagnostic-only duration/profile options are described in `hitch-1337.md`.

## Delivery and scope

- **10.954, `ff0613e`:** inherited six-seed/LOD evidence, two clean flights and mission loading checks; 135 focused checks and production build pass. See `verification/part-a.txt`.
- **10.955, `a8ccf70`:** two full excluded seed-1337 attempts; 86 focused checks and production build pass. See `verification/part-b.txt`.
- **10.956, `2038dd9`:** historical open-bar report; 119 focused checks and production build pass. See `verification/final.txt`.
- **10.957, `d93f312`:** recurring seed-1337 stall attributed to review instrumentation; 119 focused checks pass after README length repair, production build passes. See `verification/b19s-part-a.txt`.
- **10.958, `edd98d9`:** three b19s full records, third accepted flight, excluded evidence and validation guards; 16 focused checks and production build pass. See `verification/b19s-part-b.txt`.
- **10.959:** scoped final bar decision, roadmap step 1 DONE, synchronized Version/README/ROADMAP/CHANGELOG, final evidence summary; 16 focused checks and production build pass. See `verification/b19s-final.txt`.

The existing build bundle-size advisory remains. No new feature, mission type, system or roadmap item is added. Load-factor telemetry, G readout, instruments, navigation/glide guidance, flight physics, collision, scoring and resource budgets remain intact. City/roads redesign stays closed. Vegetation/props, the warning strip and blackout/redout veils remain paused. No b20 work is started.

# Terrain close-out b19r, final report, 10.956

B19s update, 10.957: [the hitch investigation](hitch-1337.md) attributes the recurring stall to the injected review pilot. The authorized alternate-seed endurance flight is still pending; the original b19r decisions and excluded records below remain historical evidence.

**The complete good enough bar is not met. Roadmap step 1 stays OPEN.** The three appearance/LOD items pass within the reviewed routes. Seeds 42 and 73 supply two clean ten-minute flights, but both fresh full seed-1337 attempts have unexplained frame intervals and are excluded. No production terrain defect is causally established, and no terrain or physics change is made.

## Four bar decisions

| Required item | Decision | Evidence |
| --- | --- | --- |
| No visible seams, gaps or floating objects on six seeds in low-altitude chase and cockpit | Met in the reviewed routes | Six fresh 45-second flights, 36 inspected stills under `final/`, following the independent `audit/` set |
| Distinct alpine, desert/badlands, green, volcanic and coastal biomes | Met | Snow ridges on 42; tan slopes/orange badlands on 2026; green rolling ground on 9001; charcoal cinder relief on 1; sand and blue coastal water on 73; city/hinterland on 1337 supplements object contact coverage |
| No obvious LOD popping at normal flight altitude | Met in the retained sequences | Six passes longer than 25 seconds, sampled AGL 565-909 m, six continuous 1280 x 720 WebMs and 240 inspected half-second frames under `lod/` |
| Three clean ten-minute flights | **Open: two of three** | Accepted seeds 42 and 73 exceed 650 simulation and wall seconds; seed 1337's full b19r attempts contain unexplained intervals over 100 ms |

The remaining work is exactly the third accepted clean ten-minute seed-1337 flight on the pinned route. The repeat allowance in this batch is exhausted. The recurring interval near 171.9 seconds needs attribution before any corrective terrain change; then the complete route needs rechecking. No additional terrain appearance polish, mission work or physics work is added to this acceptance list.

## Retained appearance evidence

| Seed | Reviewed group | Fresh low-altitude duration | Sampled low-altitude AGL |
| --- | --- | ---: | ---: |
| 42 | Alpine | 45.950 s | 135-361 m |
| 2026 | Desert/badlands | 46.000 s | 35-595 m |
| 9001 | Green | 45.317 s | 103-202 m |
| 1 | Volcanic | 45.233 s | 44-360 m |
| 73 | Coastal | 45.300 s | 96-233 m |
| 1337 | City/green hinterland | 45.233 s | 290-609 m |

All 36 fresh low-altitude stills, all twelve LOD sequence sheets and all 88 stills from the two accepted and two full excluded endurance flights were inspected during b19r. No visible seam, uncovered gap, floating building or broken/floating road was reproduced. `visual-review.md` records the appearance findings and sequence timing limits. One seed-1 missing-height query occurs at 0.0167 seconds after the airborne reset in both final and LOD telemetry. No coverage query is missing after the five-second reset warmup, and every retained final/LOD picture pose has resident mesh coverage.

LOD sequence sheets sample approximately 5.0-24.5 seconds after reset. Startup and the first five seconds are outside the sheets; raw videos retain them. Timestamp alignment is approximate, based on video duration minus measured flight wall duration. The cameras switch deliberately, including brief paired screenshot captures. No obvious terrain silhouette jump, opening crack or abrupt terrain patch is observed between the retained sequence frames. This is bounded temporal and route evidence, not exhaustive inspection of every rendered frame or world coordinate.

`mission-loads.json` verifies the five featured missions and Random world select and launch with no recorded application/console errors. It is a loading smoke check only. No current mission is polished or claimed complete by this check.

## Long-flight acceptance and exclusions

| Record | Simulation / wall seconds | Gaps over 100 ms | Terrain update maximum | Peak observed main JS heap | Acceptance |
| --- | ---: | --- | ---: | ---: | --- |
| `endurance/42.json` | 650.500 / 650.520 | None | 27.3 ms | 218.3 MB | Clean |
| `endurance/73.json` | 650.333 / 650.382 | None | 25.3 ms | 236.9 MB | Clean |
| `endurance-supplemental/1337.json`, original b19 attempt | 372.333 / 372.324 | 116.6 ms at 171.883 s | 26.0 ms | Not used for acceptance | Excluded, deliberately stopped |
| `endurance-partial/1337-usage-limit/1337.json` | 116.667 / 116.692 | None in partial record | 33.3 ms | Not used for acceptance | Excluded, usage-limit interruption |
| `endurance-supplemental/1337-b19r-attempt-1/1337.json` | 650.233 / 650.259 | 100.1 ms at 171.883 s | 26.0 ms | 190.0 MB | Excluded |
| `endurance-supplemental/1337-b19r-attempt-2/1337.json` | 650.450 / 650.824 | 300.0 ms at 3.700 s; 133.4 ms at 171.867 s | 27.4 ms | 186.7 MB | Excluded |

All four complete endurance flights have zero aircraft crashes, ground contacts, browser/application errors and missing terrain queries. The two accepted flights each retain 22 paired minute stills, with p95 frame intervals of 33.4 ms and maximum intervals of 66.7 ms and 83.3 ms respectively. Automatic weather and lighting remain active. Poor visibility in some night/cloud stills limits their appearance evidence; the dedicated clear-daylight passes carry the six-seed appearance review.

The event near 171.9 seconds recurs around x 56063-56066, z 34982. The preceding terrain updates measure 0 ms in the original attempt, 0.1 ms in b19r attempt 1 and 0 ms in b19r attempt 2. The early 300 ms event has a preceding 2.3 ms terrain update. These measurements do not identify where the whole frame interval was spent and do not rule out terrain, worker publication, deferred GPU work, review instrumentation or other application work. No causal attribution or speculative fix is claimed. The early event is retained rather than waived as reset warmup.

Frame timing excludes the declared 1.5-second screenshot windows per image. All listed gaps occur outside those windows. Terrain update timing includes screenshot periods. Heap is observed against the approximate 200 MB target; accepted flights exceed that reference, and no memory optimization or performance improvement is claimed.

## Frozen source, validation and reproduction

The required initial pull found origin/main current at `5ec0cd5` (10.953). The inherited final/LOD and accepted endurance records were captured on that commit. Both fresh full seed-1337 flights use frozen commit `ff0613e` (10.954), with identical source hashes, pinned route, browser/GPU runtime and archived hook. All production source remains byte-identical to the original audit runtime except `src/core/Version.ts`. No test, build, profile or other review flight overlaps either b19r capture.

The pilot performs one airborne reset, then controls pitch, roll, yaw and throttle only. Production physics, collision, weather, terrain streaming and chase/cockpit cameras stay active. Long-flight starts/headings are pinned to `docs/reviews/stability-10.941/`; seed 1337 starts at x 18000, z 35000, heading pi/2, with 650 m starting clearance and a 650-second target. The hook hash is `5e56e767f56ab99b1626e69b8b9686fef864e81bb63c9fbe661e803f8a9df6f6`. This controls pilot is not a manual-handling acceptance test.

`node scripts/summarize-terrain-closeout.mjs` validates 20 complete accepted-stage records, full source-file sets and current runtime hashes excluding release metadata, hook hashes, still existence/counts, both cameras, flight states, durations, coverage and pinned clean endurance routes/timing. All five archived hook filenames independently match their contents. `summary.json` remains `completeEvidence: false`; no excluded or partial seed-1337 attempt is counted. Passing `docs/reviews/terrain-closeout-b19 --final` correctly fails on the missing accepted `endurance/1337.json`. `verification/part-b-records.json` separately validates both complete excluded attempts.

To reproduce a new capture, run a Vite source server and provide an external Playwright installation through `PLAYWRIGHT_MODULE` plus `CHROMIUM_PATH`. Use `CLOSEOUT_SEEDS=1337 node scripts/review-terrain-closeout.mjs <new-review-directory> endurance`, first copying `routes.json` into that directory. Keep new evidence separate from these archives and avoid overlapping tests/builds/profiles. The runner automatically archives the hook and source hashes. See `audit.md`, `part-a.md` and `part-b.md` for the staged evidence and method.

## Delivery and scope

- **10.954, `ff0613e`:** validated inherited six-seed/LOD evidence, two clean long flights, mission loading smoke check and explicitly excluded partial/supplemental runs; 135 focused checks and production build pass. See `verification/part-a.txt`.
- **10.955, `a8ccf70`:** archived both complete seed-1337 attempts and validated their frozen identities and exclusions; 86 focused checks and production build pass. See `verification/part-b.txt`.
- **10.956:** final bar decision, precise open item and synchronized Version, README, ROADMAP and CHANGELOG. All 119 final focused checks and the production build pass, including terrain, biome, road contact, settlement, mission loading logic and release metadata coverage. Final verification is retained in `verification/final.txt`.

The build retains the existing bundle-size advisory. The appearance review is bounded to the retained routes and sequences. No new feature, mission type, system or roadmap item is added. Flight physics, collision, load telemetry, G readout, scoring, landscape/route revisions and resource budgets remain unchanged. City/roads redesign stays closed. Vegetation/props, warning strip and blackout/redout veils remain paused. No b20 work is started.

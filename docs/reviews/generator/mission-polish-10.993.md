# Migrated mission polish proof, 10.993

This closes only the Oct 22 option B approval for polish of the 72 migrated generator missions: gate faults, spawn faults, theme mismatches and docs synchronization. Parts A and B are shipped as `bc55a07e` and `d73da127`. No theme, mission, mission type, objective, feature, system, mode or roadmap item is added, and no gameplay overhaul is started. Any further theme or feature requires separate approval. Step 3 remains STARTED.

Exactly five themes remain approved: Desert run, Mountain valley run, Coastal island run, Volcanic run and Waterway. The final fixed recipe counts are 13 Desert, 47 Mountain valley, seven Coastal island, two Volcanic and three Waterway. The 72 existing mission IDs, contract-selection seeds, objectives, gameplay profiles, weather, weatherShift, timeOfDay, windSide and scoring/medal evaluators are preserved.

## Findings and repairs

| Category | Found | Fixed or disposition | Remaining in reviewed cases |
| --- | --- | --- | --- |
| Broken gates | 0 reproduced | Keep existing geometry, ordering and radii; strengthen all-mission regression | 0 |
| Bad spawns | 0 reproduced | Keep dry flat stationary runway starts; verify ordinary takeoff and collision | 0 |
| Wrong terrain recipe | 1 mission | River Run now uses the existing inland Waterway recipe instead of ocean-only Coastal island | 0 |
| Stale descriptions | 39 missions | Correct absent biomes, old route shapes, night wording and exploration-contract promises | 0 |
| Misleading names | 10 missions | Correct names on the same existing mission IDs | 0 |
| Stale route labels | 70 missions | Briefings and HUD use the actual generated theme; challenge and objective labels remain intact | 0 |

These presentation categories overlap. All 72 identities had at least one copy, recipe or route-label correction; this is not 120 distinct mission failures. The two volcanic route labels were already accurate, but their old climb/spiral copy needed correction. The [Part B table](mission-polish-10.992.md) lists all changed names and descriptions. The other 71 fixed recipe assignments and generated specifications remain unchanged. River Run automatically uses the existing bounded Waterway record identity; older records are retained. No parallel record system is introduced.

## All-mission before and after table

Every row covers seeds 42, 1337 and 9001, the existing proof seeds from the generator reviews. Gates and spawn columns report actual faults, not rejected audit assumptions. Label names below describe the actual generated recipe; mission IDs remain stable.

| Existing mission ID | Gates before / after | Spawn before / after | Theme/presentation found | After |
| --- | --- | --- | --- | --- |
| training-orbit | 0 / 0 | 0 / 0 | Route label | Fixed; desert-run |
| contour-circuit | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| weather-approach | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| range-sweep | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| precision-slalom | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| ridge-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| canyon-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| coastal-run | 0 / 0 | 0 / 0 | Route label | Fixed; coastal-island-run |
| fjord-run | 0 / 0 | 0 / 0 | Name, Description, Route label | Fixed; coastal-island-run |
| river-run | 0 / 0 | 0 / 0 | Wrong inland recipe, Route label | Fixed; waterway-run |
| volcanic-run | 0 / 0 | 0 / 0 | Description | Fixed; volcanic-run |
| volcanic-ops | 0 / 0 | 0 / 0 | Description | Fixed; volcanic-run |
| rift-ops | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| desert-dash | 0 / 0 | 0 / 0 | Route label | Fixed; desert-run |
| alpine-pass | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| storm-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| night-ops | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| aurora-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| timberline-run | 0 / 0 | 0 / 0 | Name, Description, Route label | Fixed; mountain-valley-run |
| glacier-run | 0 / 0 | 0 / 0 | Name, Description, Route label | Fixed; mountain-valley-run |
| frostline-ops | 0 / 0 | 0 / 0 | Name, Description, Route label | Fixed; mountain-valley-run |
| rainforest-run | 0 / 0 | 0 / 0 | Name, Description, Route label | Fixed; mountain-valley-run |
| mesa-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; desert-run |
| badlands-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; desert-run |
| saltflat-run | 0 / 0 | 0 / 0 | Name, Description, Route label | Fixed; desert-run |
| savanna-run | 0 / 0 | 0 / 0 | Name, Description, Route label | Fixed; desert-run |
| tundra-run | 0 / 0 | 0 / 0 | Name, Description, Route label | Fixed; mountain-valley-run |
| tundra-ops | 0 / 0 | 0 / 0 | Name, Description, Route label | Fixed; mountain-valley-run |
| swamp-run | 0 / 0 | 0 / 0 | Name, Description, Route label | Fixed; coastal-island-run |
| monsoon-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; waterway-run |
| archipelago-run | 0 / 0 | 0 / 0 | Route label | Fixed; coastal-island-run |
| thermal-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| pattern-approach | 0 / 0 | 0 / 0 | Description, Route label | Fixed; desert-run |
| crosswind-approach | 0 / 0 | 0 / 0 | Route label | Fixed; desert-run |
| traffic-run | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| waterway-tour | 0 / 0 | 0 / 0 | Route label | Fixed; waterway-run |
| thermal-surf | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| high-dive | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| water-skim | 0 / 0 | 0 / 0 | Route label | Fixed; coastal-island-run |
| ridge-trial | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| traffic-dodge | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| precision-landing | 0 / 0 | 0 / 0 | Description, Route label | Fixed; desert-run |
| combo-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| night-flight | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| radar-run | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| precision-chain | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| butter-landing | 0 / 0 | 0 / 0 | Description, Route label | Fixed; desert-run |
| dry-run | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| gust-rider | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| range-run | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| settlement-tour | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| airshow-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| biome-tour | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| scout-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| skyline-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| speed-run | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| terrain-hugger | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| fuel-saver | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| energy-run | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| storm-contract | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| crosswind-run | 0 / 0 | 0 / 0 | Route label | Fixed; desert-run |
| mach-run | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| burn-run | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| g-control-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; mountain-valley-run |
| deadstick-run | 0 / 0 | 0 / 0 | Route label | Fixed; desert-run |
| clean-circuit-run | 0 / 0 | 0 / 0 | Route label | Fixed; desert-run |
| level-flight-run | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| water-run | 0 / 0 | 0 / 0 | Description, Route label | Fixed; coastal-island-run |
| brake-check-run | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| thermal-control-run | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| front-chaser-run | 0 / 0 | 0 / 0 | Route label | Fixed; mountain-valley-run |
| shoreline-run | 0 / 0 | 0 / 0 | Route label | Fixed; coastal-island-run |

## Deterministic and headless proof

The final geometry and trigger matrix passes all 216 mission/seed cases. It checks production terrain and water-contact heights, settlement collision shapes in flown/adjacent cells, airfield boxes, full gate trigger disks, aircraft body padding, finite local route bounds, heading normals and leg spacing/slope. Gate corridors use five lateral offsets sampled every 25 m within their existing 34 m or 52 m half-width. Actual production gate updates reject reverse crossings and points just outside the trigger radius, accept points just inside it and progress through all five gates in order. Precision radius remains 27.64 m; ordinary radius remains 36 m. The infinite world has no artificial map edge.

Across the final matrix, the minimum sampled full-opening clearance above terrain or water is 84.0 m. Leg spacing is 1,260-4,338 m, maximum climb/descent slope is 9.04 degrees and the smallest sampled intended corridor reserve margin is -0.129 m, inside the retained 0.5 m sampling tolerance. Runway flatness and clear final approaches also pass the existing migrated-route regressions.

A second pass flies every case from a stationary runway reset, through all gates and into the runway footprint using the verbatim existing controls pilot at 60 Hz and normal production aircraft physics. All 216 cases take off, accept five gates with zero misses, avoid immediate failure and touch down within the 18 by 120 m runway. Airfield obstacle collision remains active. The pilot never overwrites pose, velocity, orientation, gates, scoring, results or clock after the ordinary reset. This fast node simulation uses analytic terrain and no wind, rather than rendered mesh contact or weather. It does not establish browser appearance, medals, timing or long-duration memory acceptance. Existing contract/weather proof and the browser flights below supplement it.

The initial false geometry flags came from overly wide desert probes and an assumed diagonal taxi toward the first Waterway gate. They were corrected as audit assumptions, with straight departure checked by actual controls flights and obstacle corridors checked after the first 800 m. Every gate opening is still checked in full. No production defect was hidden by changing physics or suppressing collision.

The theme regression covers all 72 identities on all three seeds, including generated labels, briefings, contract copy, fixed weather/time/wind, replay, the unchanged 71 specs and real river/lake classifiers for River Run. Part B completed-GPU-frame chase/cockpit stills were inspected for the remapped river mission and rainy valley copy. They are separate from timing flights.

Receipts: [before geometry/catalog](mission-polish-a/geometry.json), [final geometry/catalog](mission-polish-c/geometry.json), [final headless flights](mission-polish-c/simulation.json), and [strict proof audit](mission-polish-c/proof.json). Each final runtime receipt is compared with current source hashes. The auditor also verifies complete matrices, immutable browser build manifests, the unchanged base controls pilot, raw native frame metrics and protected-source identity.

## Browser completions, heap and frame spikes

Three sequential production-mode Playwright flights use capture OFF, profiler OFF, fixed chase, Balanced quality, 1280x720, scale 1, native RAF and ordinary adaptive resolution. No local tests, builds, node simulations or other review browsers overlap timing. Timing begins after the ordinary launch panel hides. Only the first ten RAF intervals are omitted; every remaining contiguous timestamped interval is retained, including slow frames. Counts are strictly above 50 or 100 ms. Heap is the largest approximately one-second main-thread used-JS-heap sample including the final sample, not worker, GPU or total browser memory.

Every final browser flight clears five gates, receives five ordinary capped 25% nitro refills, lands inside the runway footprint and reaches the existing gold/complete result. Runtime errors and sampled resident coverage misses after ten seconds are zero. The production WebGL context remains desynchronized.

| Mission | Seed | Cohort | FPS | p95 ms | >50 ms | >100 ms | Max ms | Peak heap MB |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| coastal-run | 42 | 10.990 | 39.3 | 33.4 | 51 | 0 | 83.4 | 160.2 |
| coastal-run | 42 | 10.990 repeat | 46.3 | 33.4 | 17 | 0 | 50.1 | 121.9 |
| waterway-tour | 1337 | 10.990 | 44.4 | 33.4 | 33 | 0 | 83.3 | 122.2 |
| coastal-run | 42 | 10.993 | 45.9 | 33.4 | 14 | 0 | 66.7 | 116.9 |
| waterway-tour | 1337 | 10.993 | 45.0 | 33.4 | 33 | 0 | 83.4 | 131.4 |
| river-run | 42 | 10.993 | 41.0 | 33.5 | 58 | 0 | 66.8 | 130.6 |

The matched comparison retains both original 10.990 Coastal observations rather than replacing the noisier row. Gate positions and forward vectors match the retained 10.990 receipts exactly for Coastal Run and Waterway Tour. All production source outside Version, catalog copy, recipe selection and route labels is byte-identical to 10.990, including the b20 physics, b21 nitro, b24 10.978 desynchronized context and 10.989 seam-copy/shader-warmup repairs. No collision, water, city/roads or budget changes are present. No heap chase is attempted.

The matched Coastal Run and Waterway Tour observations show no frame-spike regression against the retained 10.990 envelope: Coastal has 14 intervals over 50 ms versus 17 and 51; Waterway has 33 versus 33. Both retain a 33.4 ms p95 to timer precision, and no accepted final flight has an interval over 100 ms. Peak sampled heap across the three final flights is 131.4 MB. River Run supplies a new-recipe completion check, rather than a matched old-terrain performance comparison. These bounded observations do not establish a universal or statistically reliable FPS improvement.

## Verification and limits

The final focused run passes 893 tests in nine files, including the new 216-case gate/spawn and 216-case theme matrices, existing migration route/contract checks, seam and shader-warmup regressions, README and version checks. The production build and isolated review build pass. See [focused log](mission-polish-c/focused.txt), [production build](mission-polish-c/production-build.txt) and [review build](mission-polish-c/review-build.txt). Earlier completed Part A and B tests and browser checks remain in their own reports.

No known broken gates, bad spawns or theme mismatches remain among the 72 fixed missions in the reviewed seeds. This is a three-seed course proof, not an all-seed guarantee. Short-course sampled heap remains below about 200 MB; broader long-duration memory acceptance, the historical b19 seed-1337 hydrology look-ahead and high-altitude appearance limits remain open in ROADMAP. The three rotating Ops entries are outside the fixed 72-mission inventory and retain their existing shared-period proofs and objective overrides. Their river-profile recipe selector now uses the existing inland Waterway recipe when appropriate, without changing period seeds.

Vegetation/props, blackout/redout veils and the entire flight-warning strip remain removed. Instruments, altitude/load telemetry, G readout, scoring, flight physics and collision remain intact. City/roads redesign stays closed at 10.942. Weapons, combat, multiplayer and parallel record systems remain non-goals. Any further theme or feature requires separate approval. No further work is started.

Reproduce deterministic proofs with `POLISH_PART=mission-polish-c node scripts/audit-mission-polish.mjs` and the same part for `node scripts/simulate-mission-polish.mjs`. Build the browser proof with `REVIEW_ADDENDUM=scripts/observe-mission-polish.js node scripts/build-generator-review.mjs`, serve `/tmp/blackout-generator-production` on 5176, then run `scripts/review-generator.mjs` sequentially with `REVIEW_PART=mission-polish-c-browser`, `REVIEW_CAPTURE=0` and course/seed pairs Coastal Run/42, Waterway Tour/1337 and River Run/42. Use a new part directory to preserve existing observations. Audit with `node scripts/audit-mission-polish-proof.mjs`.

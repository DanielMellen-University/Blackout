# Existing-mission generator migration proof, 10.985

This closes only the approved migration of existing missions onto the existing mission generator and terrain pipeline. It adds no theme, mission type, system, mode, feature or roadmap item. Step 3 remains STARTED. Any further theme or feature requires separate approval. The four themes remain exactly Desert run, Mountain valley run, Coastal island run and Volcanic run.

The migration preserves every original mission id, label, detail, gameplay profile, objective, contract-selection seed, scoring focus, medal evaluator, weather, weatherShift, timeOfDay and windSide. Only the generated route and landscape change. Per-flight fixed-mission seeds use ordinary launch, retry, new-world and copied-link replay. Daily, Weekly and Monthly Ops retain their shared UTC period seeds. The existing bounded score/history/ghost retention and FlightRevision r32 remain in use; migrated route and landscape revisions add 100 and retain separate mission suffixes. There is no parallel record system.

| Catalog group | Desert run | Mountain valley run | Coastal island run | Volcanic run | Migrated fixed identities |
| --- | ---: | ---: | ---: | ---: | ---: |
| Authored runs | 8 | 14 | 5 | 1 | 28 |
| Supported contract catalog | 5 | 33 | 3 | 1 | 42 |
| Total | 13 | 47 | 8 | 2 | 70 |

The three rotating Ops entries choose an existing recipe by their existing period profile and objective. They are additional to the 70 fixed identities. The full mission-to-recipe table is in [Part A](legacy-migration-10.982.md). Part B is [authored and rotating migration](legacy-migration-10.983.md); Part C is [contract migration](legacy-migration-10.984.md).

Two of the 44 fixed contract entries remain as is: `monsoon-run` and `waterway-tour`. Their existing Waterway tour objective requires two waterway types. The existing generated recipes suppress inland hydrology, and Coastal island supplies ocean only. Supporting a second waterway type would require unapproved capability work. Rotating Ops periods assigned that same objective also retain their original worlds. No objective or identity is substituted.

The fixed proof seeds are 42, 1337 and 9001, separate from tuning seeds 73, 808 and 2026. Rotating proof uses the actual shared seeds for three days, three weeks and three months, listed in `migration-d-smoke/jobs.json`. The existing period-seed range begins at 1,000, so forcing seed 42 would violate shared-period identity. Unsupported periods remain explicitly excluded from migration, rather than changing their objectives.

The automated solvability matrix checks all 70 fixed missions on all three seeds, plus the nine rotating periods. Every gate corridor is sampled along each leg and across its width, with bounded climb slope, no route fallback, flat runway footprints and clear aligned landing approaches. The period audit now samples the complete gate corridors as well as the existing replay, modifier and approach checks. The 126 supported-contract fixtures use the real generated-world environment for objective support and exercise the original event tracker and capped score. Good-flight fixtures can earn gold; poor delayed flying is denied gold.

Browser smoke checks ordinary takeoff, gate one and the ordinary nitro refill for all 210 fixed mission/seed pairs and nine shared periods. Each receipt is checked against the source/pilot hashes, original catalog settings, live contract assignment, scoring modifier and migrated record identity. The chase/cockpit sessions may use two isolated browser processes and are excluded from timing acceptance.

Timing follows 10.981: sequential complete production-mode browser flights, capture OFF, profiler OFF, fixed chase, balanced quality, 1280x720, device scale 1, native RAF and ordinary adaptive resolution. No tests, builds or other review browsers overlap timing. Timing begins after the ordinary launch panel hides. Only the first ten intervals are omitted, and every remaining raw timestamped interval is retained, including slow intervals. Counts are strictly greater than 50 and 100 ms. Heap peak is the largest approximately one-second sample of main-thread used JS heap, excluding worker, GPU and total browser memory. These short flights do not replace long-duration memory acceptance.

The external pilot sets ordinary controls, and the observers read state. Aircraft pose, velocity, gates, scoring, clock, results, terrain and physics are not overwritten. Normal production builds contain no review hook. The b20 physics, b21 nitro, 10.978 compositor fix, collision, water and budgets remain unchanged. No heap tuning is applied. City/roads redesign remains closed at 10.942.

The b25t relaunch repeats 417 focused adapter, route and contract checks in three files and the full suite of 2,142 Vitest tests in 176 files, plus two frame-metrics checks. The production build and separate production review build pass. See [focused checks](migration-d-verification/focused.txt), [full suite](migration-d-verification/full-suite.txt), [production build](migration-d-verification/production-build.txt) and [review build](migration-d-verification/review-build.txt). Verification log typography and trailing whitespace are normalized without changing results. Part C CI is [green on 32502770](https://github.com/DanielMellen-University/Blackout/actions/runs/39583963100).

The relaunch independently revalidates every accepted receipt against the exact current source hashes, including Version.ts, the retained pilot hash and immutable build manifests. It confirms the complete catalog/seed matrix, launch boundary, contiguous raw timing intervals, gold results, sampled coverage and heap, then recomputes all five summaries. All required measurements are recorded, so the original proof flights are retained without rerunning Parts A, B or C or replacing timing observations. Both completed-frame contact sheets and the full-size Coastal, Canyon and Volcanic views are inspected again. See [receipt audit](migration-d-verification/receipt-audit.txt) and [visual check](migration-d-verification/visual-check.txt). No review or development server is needed for this relaunch.

The first 219 smoke receipts all pass takeoff, gate-one and refill checks. The summary deliberately stopped on one stricter resident-coverage sample in Thermal Run seed 9001 at 13.667 seconds during two-browser capture. Its original receipt and images remain in [the parallel observation](migration-d-coverage/parallel-observation/). Four isolated smoke repeats on identical source and hook hashes have no sampled coverage miss. An additional isolated, capture-free Thermal Run seed-9001 flight lands with gold, five refills and no sampled coverage miss; its maximum interval is 66.8 ms and sampled heap peak is 90.4 MB. See [the complete repeat](migration-d-coverage-full-results.md). The accepted 219-flight summary includes the isolated replacement receipt; the original observation is retained, not silently dropped.

All ten original contact sheets were inspected. Some two-browser stills contain pale or sky-colored rectangles, so those suspect views are retained as diagnostic evidence rather than accepted appearance proof. Further isolated and paired replays, including deliberate three-times CPU throttling and live read-only CDP inspection of the original bundle, did not reproduce a corresponding terrain fault. Instrumented rays intersect the terrain in the replayed Canyon view. The diagnostic sessions are excluded from performance acceptance. The original observation is not fully attributed; resource contention and an unfinished read of the desynchronized canvas remain hypotheses, not established causes. See [live observer and captures](migration-d-coverage/).

The visual harness now explicitly captures a completed GPU frame: resolve the existing renderer through its observer closure, hold only drawing through the existing review control, render normally, wait for GPU completion, take the still and restore native drawing in a finally block. Physics, controls, mission evaluation and the flight clock continue. The renderer, terrain pipeline and 10.978 desynchronized production context are unchanged. Each new still retains its fence observation. Capture OFF flights never create this CDP connection or hold drawing. This improves the reliability of the visual evidence without changing the game or claiming a production terrain repair.

All 33 completed-frame visual flights pass the source, identity, gate-one, refill, resident-coverage and per-picture fence checks. They cover Training Orbit, Range Sweep, Coastal Run, Volcanic Run, Canyon Run, Burn Run, Mach Run, Ridge Run, Butter Landing, Deadstick Run and Thermal Run on all three proof seeds. Both contact sheets, containing 66 chase/cockpit gate stills, were inspected. The large pale rectangles in the suspect original views are absent in these replay views; the terrain, water joins, weather, gates and instruments are coherent within this envelope. This is accepted appearance evidence for the representatives and suspect cases, without asserting that the earlier observation has a proven cause. See [completed-frame rows](migration-d-completed-visual-results.md), [verified summary](migration-d-completed-visual-summary.json) and [stills](migration-d-completed-visual/).

The twelve representative flights all land with gold on all three proof seeds: Training Orbit, Range Sweep, Coastal Run and Volcanic Run. Together with the extra Thermal Run seed-9001 repeat, Part D has thirteen verified migrated-mission gold landings. Every flight clears five gates, receives five ordinary refills, uses boost and lands within the runway footprint with the completion panel open. Runtime errors and sampled resident-coverage misses are zero in these accepted complete flights. No test, build, diagnostic or other review browser overlaps their timing. See [representative summary](migration-d-full-summary.json) and [Thermal repeat summary](migration-d-coverage-full-summary.json).

| Mission or theme | Recipe | Seed | Medal | FPS | p95 ms | >50 ms | >100 ms | Max ms | Heap MB |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| training-orbit | desert-run | 42 | gold | 41.5 | 33.4 | 19 | 0 | 66.8 | 76.6 |
| training-orbit | desert-run | 1337 | gold | 41.2 | 33.4 | 36 | 0 | 66.8 | 91.1 |
| training-orbit | desert-run | 9001 | gold | 41.8 | 33.4 | 35 | 0 | 83.4 | 88.5 |
| range-sweep | mountain-valley-run | 42 | gold | 40.8 | 33.4 | 32 | 0 | 66.8 | 94.7 |
| range-sweep | mountain-valley-run | 1337 | gold | 40.5 | 33.4 | 26 | 0 | 66.7 | 110.3 |
| range-sweep | mountain-valley-run | 9001 | gold | 41.7 | 33.4 | 38 | 0 | 66.7 | 114.1 |
| coastal-run | coastal-island-run | 42 | gold | 39.5 | 33.5 | 50 | 0 | 66.7 | 131.2 |
| coastal-run | coastal-island-run | 1337 | gold | 39.2 | 49.9 | 48 | 0 | 66.7 | 128.6 |
| coastal-run | coastal-island-run | 9001 | gold | 39.7 | 33.5 | 41 | 0 | 83.3 | 149.2 |
| volcanic-run | volcanic-run | 42 | gold | 41.6 | 33.4 | 30 | 0 | 83.4 | 106.1 |
| volcanic-run | volcanic-run | 1337 | gold | 40.6 | 33.4 | 37 | 0 | 66.7 | 114.0 |
| volcanic-run | volcanic-run | 9001 | gold | 40.8 | 33.4 | 38 | 0 | 83.3 | 163.5 |
| thermal-run | mountain-valley-run | 9001 | gold | 45.2 | 33.4 | 32 | 0 | 66.8 | 90.4 |

All four original generator themes also complete seed 42 with gold, five gates, five ordinary refills and runway landing. Original theme record identities and landscape/route revisions remain unchanged. Their timing, source and pilot checks pass, including the approximate 100 ms maximum target. See [theme regression rows](migration-d-regression-results.md) and [verified summary](migration-d-regression-summary.json).

| Mission or theme | Recipe | Seed | Medal | FPS | p95 ms | >50 ms | >100 ms | Max ms | Heap MB |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| desert-run | original theme | 42 | gold | 42.0 | 33.4 | 29 | 0 | 66.8 | 81.2 |
| mountain-valley-run | original theme | 42 | gold | 40.9 | 33.4 | 29 | 0 | 66.7 | 90.7 |
| coastal-island-run | original theme | 42 | gold | 40.0 | 33.4 | 53 | 0 | 66.7 | 131.6 |
| generated-volcanic-run | original theme | 42 | gold | 41.7 | 33.4 | 29 | 0 | 66.7 | 105.5 |

The following aggregate table retains the completed Part B and Part C observations for the whole batch. Part D is the final runtime proof; the earlier rows remain their original shipped cohorts. FPS is the per-flight range, p95 is the largest per-flight p95, interval counts are summed, and maximum interval and heap are the largest observed values in each group.

| Proof group | Gold flights | FPS range | Worst p95 ms | >50 ms | >100 ms | Max ms | Heap MB |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| B authored representatives | 12 | 38.9-49.3 | 49.9 | 378 | 0 | 100.0 | 138.7 |
| C supported contracts | 12 | 39.4-42.3 | 49.9 | 441 | 0 | 83.4 | 137.5 |
| D migrated representatives and repeat | 13 | 39.2-45.2 | 49.9 | 462 | 0 | 83.4 | 163.5 |
| D original-theme regression | 4 | 40.0-42.0 | 33.4 | 140 | 0 | 66.8 | 131.6 |

The final runtime proof meets the approximate 100 ms interval and 200 MB sampled-heap targets without tuning either budget. Full native flights have no interval over 100 ms. Capture and diagnostic intervals are excluded for the stated method, with their original data retained. The parallel capture observation remains an unattributed verification limitation; clean repeat checks do not prove that every workload is free of transient coverage or presentation issues. It is not represented as a repaired production defect.

The approved existing-mission migration is complete with the documented Waterway tour exceptions. Step 3 remains STARTED, and further themes, features, mission types, systems or roadmap items require separate approval. Historical b19 seed-1337 hydrology look-ahead and high-altitude appearance limits remain in ROADMAP; these short generated-course flights do not close them. Vegetation/props, blackout/redout veils and the flight-warning strip remain removed. Load telemetry, G readout, scoring and physics remain intact. Weapons, combat, multiplayer and parallel record systems remain non-goals. City/roads redesign stays closed at 10.942.

Reproduce the normal review build with `node scripts/build-generator-review.mjs`, served from `/tmp/blackout-generator-production` on port 5176. Use `MIGRATION_STAGE=d MIGRATION_MODE=smoke MIGRATION_CONCURRENCY=2 node scripts/review-legacy-migration.mjs` for the full smoke matrix, then `REVIEW_PART=migration-d-smoke node scripts/summarize-legacy-migration.mjs`. Completed-frame visuals use a distinct `REVIEW_PART`, `MIGRATION_COURSES` listing the eleven reviewed identities above, and the same smoke runner. Run complete representatives with `MIGRATION_STAGE=d MIGRATION_MODE=full node scripts/review-legacy-migration.mjs`, followed by its summary. Original-theme regression uses `REVIEW_PART=migration-d-regression REVIEW_SEEDS=42 REVIEW_CAPTURE=0 node scripts/review-approved-polish.mjs` and the matching summarizer. Use new part names or archive existing receipts to retain observations. Never overlap tests, builds or other review browsers with timing.

The relaunch focused command is `npx vitest run tests/legacyMigrationRoutes.test.ts tests/legacyMigrationContracts.test.ts tests/legacyMissionGenerator.test.ts --maxWorkers=4`. Run the full suite with `npm test -- --maxWorkers=4` and the normal production build with `npm run build`.

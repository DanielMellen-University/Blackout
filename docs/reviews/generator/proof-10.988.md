# Waterway generator migration proof, 10.988

This closes b26 Part C under the Oct 21 option B approval for one Waterway theme and migration of the existing Waterway missions. Parts A, [10.986](waterway-10.986.md), and B, [10.987](legacy-migration-10.982.md#waterway-migration-10987), remain shipped as cb25efab and 7ee1e558. They were not redone. Exactly five themes are approved: Desert run, Mountain valley run, Coastal island run, Volcanic run and Waterway. Any further theme, feature, mission type, objective, system, mode or roadmap item requires separate approval. Step 3 remains STARTED; this approved batch is complete.

Waterway generates a seeded dry floodplain airfield, rounded inland valley walls, a broad meandering river and a connected warped lake. Seeded origin, runway heading, elevation, river bend, shoreline and gate heights supply variation. The first gate crosses river and the second crosses lake outside the river-bank classification influence. The existing hydrology shapes, carved terrain, shared water surfaces, collision and survey classifier provide two real families, `river` and `lake`. There is no ocean substitution. Five gates lead back to the aligned runway landing. The standalone theme keeps `generated-waterway:r32:l36:q39`; migrated identities use `l136:q139` and their existing mission/period suffixes. FlightRevision remains r32.

All 72 fixed catalog identities, comprising 28 authored and 44 contract missions, plus all Daily, Weekly and Monthly Ops periods now resolve through the existing generator. The final two fixed exceptions, `monsoon-run` and `waterway-tour`, and rotating periods assigned Waterway tour use Waterway. The previous 70 fixed mappings remain unchanged: 13 Desert, 47 Mountain valley, eight Coastal island and two Volcanic. The two Waterway identities bring the total to 72. There is no original-world mission exception left. Random world and Free flight retain their natural pipeline because they are outside this migration; the five standalone theme entries remain generator entries.

Original mission id, label, detail, gameplay profile, objective, contract-selection seed, scoring focus, medal evaluator, weather, weatherShift, timeOfDay and windSide remain intact. Fixed missions retain ordinary random launch, retry, new-world and copied-link replay through the existing seed path. Ops periods retain their shared UTC seeds, original scoring modifier and period identity. The [mission mapping](legacy-migration-10.982.md) records the complete catalog and migration history. No objective or identity is substituted, and no parallel record system is added.

The Part C record audit found one real omission: the existing generated-record allowlist did not include `waterway`. The fix adds that token to the existing regex, admitting standalone and migrated Waterway records to the same 12-family manifest. The six existing best, streak, history, badges, trace and ghost sibling keys are pruned together. Three focused regressions cover standalone, monsoon-run and waterway-tour families, with fractional seeds, cap enforcement and preservation of old natural-world and r31 records. The retained [before-fix failure](waterway-c-verification/retention-before-fix.txt) records the three failing cases. Final browser receipts directly observe admission of every non-period Waterway record; Ops continue using existing period retention.

The relaunch pulled origin/main, found 7ee1e558 current, and reviewed every Part C leftover. The 22 complete flights and first twelve smoke flights use exactly the corrected current source and unchanged pilot, so they are retained after fresh audits. The remaining three monthly smoke cases and all four standalone visual flights are completed in this relaunch. Earlier pre-fix Part C observations are retained only in [the diagnostic archive](waterway-c-before-retention/README.md), with their original source manifests and raw telemetry. They are excluded from corrected-source acceptance. No Part A or B receipt is rewritten.

The fresh focused run passes 523 checks in eight files, including Waterway recipe invariance, reachable river/lake classification, route corridors, original contract behavior, catalog identity, generator behavior and bounded storage. See [focused checks](waterway-c-verification/relaunch-focused.txt), [production build](waterway-c-verification/relaunch-production-build.txt), [review build](waterway-c-verification/relaunch-review-build.txt) and [normal-build hook check](waterway-c-verification/normal-build-hook-check.txt). The normal production build has no review hook. The separate minified production-mode review build preserves the external controls-only pilot and read-only observers used in 10.985.

The fresh isolated full suite passes 2,197 Vitest tests in 177 files plus the two frame-metrics checks. See [the isolated full run](waterway-c-verification/relaunch-full-suite-isolated.txt). The earlier [overlapping run](waterway-c-verification/relaunch-full-suite.txt) retains one 5,000 ms timeout in the unchanged generated broad-turning river-union test, with 2,196 tests passing. All nine river-union tests pass in a [2.67-second isolated recheck](waterway-c-verification/relaunch-river-union-isolated.txt), followed by the clean full run with no review browser. No test timeout or production behavior was changed. The original pre-interruption [full-suite log](waterway-c-verification/full-suite.txt) also records 2,197 passing tests.

Fixed proof seeds are 42, 1337 and 9001, distinct from tuning seeds 73, 808 and 2026. Smoke and full completion matrices each cover both fixed missions on all three seeds plus three Daily, three Weekly and three Monthly Waterway tour assignments, for fifteen cases each. Period cases use actual shared seeds rather than forcing fixed seeds into rotating identities. The [jobs manifest](waterway-c-smoke/jobs.json) records all nine period keys, queries and seeds. The additional [1,500-day audit](waterway-c-smoke/period-audit.json) finds eight Waterway tour assignments and verifies river/lake families, unchanged shared seeds and full leg corridors for every one.

All fifteen completed-frame smoke flights pass takeoff, two gates, ordinary nitro refills and the live existing Waterway tour evaluator. Every contract is complete with progress 1. Source/pilot identity, mission settings, scoring modifiers, resident coverage and picture fences pass. These are single-browser capture sessions, excluded from timing acceptance; the relaunch monthly captures overlap regression tests. See [smoke rows](waterway-c-smoke-results.md), [summary](waterway-c-smoke-summary.json) and [smoke receipt audit](waterway-c-verification/smoke-receipt-audit.txt).

Standalone Waterway visual flights cover seeds 42, 1337, 9001 and 31415, with chase and cockpit stills at the dry runway and after two gates. All four pass takeoff, refills, source/pilot identity, existing bounded-record admission and sampled resident coverage. The existing completed-GPU-frame capture method holds drawing only, renders normally, waits for GPU completion, captures the stable canvas and restores drawing in a finally block. Simulation and controls continue. No production renderer or 10.978 compositor setting changes. Per-picture fence receipts remain attached. All five mission/period contact sheets and both four-seed standalone sheets are inspected, with full-size representative stills checked separately. The inland shores, valley, runway, rain/night variants, gates and instruments are coherent within this envelope, without the earlier pale canvas rectangles. See [visual rows](waterway-c-visual-results.md), [visual summary](waterway-c-visual-summary.json), [visual check](waterway-c-verification/visual-check.txt) and [stills](waterway-c-visual/).

Timing uses the 10.985 method: sequential complete production-mode browser flights, capture OFF, profiler OFF, fixed chase, balanced quality, 1280x720, device scale 1, native RAF and ordinary adaptive resolution. No tests, builds or other review browsers overlap accepted timing. Timing begins after the ordinary launch panel hides. Only the first ten intervals are omitted; every remaining raw timestamped interval is retained, including slow intervals. Counts are strictly greater than 50 and 100 ms. Heap peak is the largest approximately one-second main-thread used JS heap sample, excluding worker, GPU and total browser memory. These short flights do not replace long-duration memory acceptance.

The external pilot sets ordinary controls. Aircraft pose, velocity, gates, scoring, clock, results, terrain and physics are not overwritten. Every complete flight clears five gates, receives five ordinary 25% capped refills, uses boost, lands inside the runway footprint and opens the completion panel with gold. The fifteen migrated flights also earn the original maximum 2,000 contract points with Waterway tour complete. Accepted runtime errors and sampled resident-coverage misses are zero. See [migrated completion rows](waterway-c-full-results.md), [summary](waterway-c-full-summary.json) and [receipt audit](waterway-c-verification/full-receipt-audit.txt).

| Mission or theme | Seed | Medal | FPS | p95 ms | >50 ms | >100 ms | Max ms | Heap MB |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| monsoon-run | 42 | gold | 45.7 | 33.4 | 25 | 0 | 66.7 | 117.4 |
| monsoon-run | 1337 | gold | 42.1 | 33.4 | 47 | 0 | 66.8 | 132.4 |
| monsoon-run | 9001 | gold | 43.9 | 33.4 | 41 | 0 | 66.8 | 118.6 |
| waterway-tour | 42 | gold | 41.8 | 33.4 | 47 | 0 | 66.7 | 117.3 |
| waterway-tour | 1337 | gold | 37.1 | 50.0 | 117 | 0 | 100.0 | 134.6 |
| waterway-tour | 9001 | gold | 38.1 | 50.0 | 71 | 0 | 83.4 | 142.1 |
| daily-ops | 231205 | gold | 38.3 | 50.0 | 82 | 0 | 83.3 | 139.6 |
| daily-ops | 113080 | gold | 37.3 | 50.0 | 91 | 0 | 99.9 | 110.1 |
| daily-ops | 836705 | gold | 38.0 | 50.0 | 89 | 0 | 83.3 | 106.4 |
| weekly-ops | 876003 | gold | 37.4 | 50.0 | 99 | 0 | 83.3 | 119.6 |
| weekly-ops | 372436 | gold | 38.6 | 50.0 | 78 | 0 | 100.0 | 113.8 |
| weekly-ops | 418239 | gold | 38.3 | 50.0 | 75 | 0 | 66.7 | 127.8 |
| monthly-ops | 146059 | gold | 37.6 | 50.0 | 98 | 0 | 83.4 | 153.8 |
| monthly-ops | 495484 | gold | 37.8 | 50.0 | 95 | 0 | 83.3 | 127.8 |
| monthly-ops | 896134 | gold | 38.8 | 50.0 | 61 | 0 | 83.4 | 120.8 |

The standalone Waterway theme also completes all three fixed proof seeds with gold. See [standalone rows](waterway-c-theme-full-results.md), [summary](waterway-c-theme-full-summary.json) and [receipt audit](waterway-c-verification/theme-full-receipt-audit.txt).

| Mission or theme | Seed | Medal | FPS | p95 ms | >50 ms | >100 ms | Max ms | Heap MB |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| waterway-run | 42 | gold | 39.3 | 50.0 | 78 | 0 | 83.4 | 168.2 |
| waterway-run | 1337 | gold | 37.3 | 50.0 | 109 | 0 | 83.4 | 167.6 |
| waterway-run | 9001 | gold | 38.1 | 50.0 | 89 | 0 | 83.3 | 122.9 |

The four existing generator themes each complete seed 42 with gold, five gates, five refills and runway landing on the corrected source. Their original record identities and route/landscape revisions remain unchanged. The focused fixture also compares their complete specifications and sampled landscapes against pre-Waterway outputs on six seeds. See [regression rows](waterway-c-regression-results.md), [summary](waterway-c-regression-summary.json) and [receipt audit](waterway-c-verification/regression-receipt-audit.txt).

| Mission or theme | Seed | Medal | FPS | p95 ms | >50 ms | >100 ms | Max ms | Heap MB |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| desert-run | 42 | gold | 42.5 | 33.4 | 29 | 0 | 66.8 | 76.4 |
| mountain-valley-run | 42 | gold | 40.7 | 33.4 | 45 | 0 | 66.7 | 89.3 |
| coastal-island-run | 42 | gold | 39.5 | 49.9 | 46 | 0 | 83.4 | 130.3 |
| generated-volcanic-run | 42 | gold | 41.3 | 33.4 | 33 | 0 | 83.4 | 91.8 |

FPS below is the per-flight range. The p95, maximum interval and heap columns use the largest per-flight observation; interval counts are summed. Only the 22 capture-free Part C gold flights appear in this table.

| Proof group | Gold flights | FPS range | Worst p95 ms | >50 ms | >100 ms | Max ms | Heap MB |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| monsoon-run | 3 | 42.1-45.7 | 33.4 | 113 | 0 | 66.8 | 132.4 |
| waterway-tour | 3 | 37.1-41.8 | 50.0 | 235 | 0 | 100.0 | 142.1 |
| daily-ops | 3 | 37.3-38.3 | 50.0 | 262 | 0 | 99.9 | 139.6 |
| weekly-ops | 3 | 37.4-38.6 | 50.0 | 252 | 0 | 100.0 | 127.8 |
| monthly-ops | 3 | 37.6-38.8 | 50.0 | 254 | 0 | 83.4 | 153.8 |
| Waterway standalone theme | 3 | 37.3-39.3 | 50.0 | 276 | 0 | 83.4 | 168.2 |
| Four original themes | 4 | 39.5-42.5 | 49.9 | 153 | 0 | 83.4 | 130.3 |

All final accepted complete flights meet the approximate 100 ms interval and 200 MB sampled-heap targets. There is no interval strictly above 100 ms in these flights. No budget, heap tuning, physics, nitro or compositor change was needed. The earlier Part B Waterway Tour seed-9001 116.7 ms observation remains in [its original receipt](waterway-b-observations/waterway-tour-9001-original/run.json), with its passing 83.4 ms identical-source repeat and [observation note](waterway-b-observations/README.md). Its cause is unproven. It is not silently discarded, attributed to a proven cause or claimed as a production repair. Capture-session intervals remain available in their own receipts and are excluded by method.

The [final proof audit](waterway-c-verification/proof-audit.json) independently compares every accepted receipt with the immutable current build manifest, checks every tracked source hash including Version.ts, verifies the unchanged pilot hash, validates the complete case matrix and recomputes native timing from contiguous raw intervals. It checks gold, contracts, sampled coverage, heap and visual fences through the accompanying summarizers. The only production-source differences from 7ee1e558 are the two release metadata fields in Version.ts and the Waterway token in the existing retention regex. b20 physics, b21 nitro, collision, water surfaces, streaming/resource budgets and the 10.978 stutter fix remain unchanged.

The approved b26 batch is complete with no delivery blocker. Further themes and features require separate approval. Historical b19 seed-1337 hydrology look-ahead, high-altitude appearance and broader long-duration memory limits remain open in ROADMAP; this short-course proof does not close them. City/roads redesign remains closed at 10.942. Vegetation/props, blackout/redout veils and the entire flight-warning strip remain removed. Load telemetry, G readout, scoring and physics remain intact. Weapons, combat, multiplayer and parallel record systems remain non-goals.

Reproduce with `node scripts/build-generator-review.mjs`, serving `/tmp/blackout-generator-production` on port 5176. Run `REVIEW_PART=waterway-c-smoke WATERWAY_MODE=smoke node scripts/review-waterway.mjs`, followed by `REVIEW_PART=waterway-c-smoke node scripts/summarize-legacy-migration.mjs`. For the standalone visuals use `REVIEW_PART=waterway-c-visual WATERWAY_MODE=visual REVIEW_RUNWAY_VIEWS=1 node scripts/review-waterway.mjs`, then `REVIEW_PART=waterway-c-visual POLISH_THEMES=waterway-run REVIEW_SEEDS=42,1337,9001,31415 REVIEW_CAPTURE=1 node scripts/summarize-approved-polish.mjs`.

Use `REVIEW_PART=waterway-c-full WATERWAY_MODE=full node scripts/review-waterway.mjs` for migrated completions, then the matching legacy summarizer. Standalone full proof uses `REVIEW_PART=waterway-c-theme-full REVIEW_COURSE=waterway-run REVIEW_SEEDS=42,1337,9001 REVIEW_CAPTURE=0 node scripts/review-generator.mjs` and the approved-polish summarizer with `POLISH_THEMES=waterway-run`. Original-theme regression uses `REVIEW_PART=waterway-c-regression REVIEW_SEEDS=42 REVIEW_CAPTURE=0 node scripts/review-approved-polish.mjs` and its matching summarizer. Use new part names or archive receipts to retain observations. Do not overlap tests, builds or other review browsers with timing. The final case audit is `node scripts/audit-waterway-proof.mjs`.

The focused command is `npx vitest run tests/waterwayGenerator.test.ts tests/legacyMigrationRoutes.test.ts tests/legacyMigrationContracts.test.ts tests/legacyMissionGenerator.test.ts tests/courseRecordRetention.test.ts tests/missionGenerator.test.ts tests/courseLibrary.test.ts tests/generatedThemePolish.test.ts --maxWorkers=4`. The production command is `npm run build`.

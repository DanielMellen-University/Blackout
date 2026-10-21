# Contract catalog migration, 10.984

This part activates 42 of the existing 44 contract catalog entries. It adds no theme, mission type, system, mode or feature. Step 3 remains STARTED; any further theme or feature requires separate approval. The only terrain recipes remain Desert run, Mountain valley run, Coastal island run and Volcanic run. Random world, Free flight, flight tuning, presentation tuning, water, collision and budgets are unchanged.

The contract mappings use five Desert, 33 Mountain valley, three Coastal island and one Volcanic recipe. The original id, label, detail, gameplay profile, contract-selection seed, objectives, scoring focus, medal evaluator, weather, weatherShift, timeOfDay and windSide stay attached to each mission. Every supported launch chooses a per-flight world seed through the existing generator; retries and copied-link replay retain it. Migrated route and landscape revisions add 100, mission suffixes separate identities, and the existing bounded manifest retains score/history/ghost siblings. Clean Circuit shares that bounded family while staying separate from Desert Dash.

The full mission table and reasons remain in [the mapping](legacy-migration-10.982.md). Monsoon-run and waterway-tour retain their original worlds, seeds and records. Both have the existing Waterway tour objective, which requires two waterway types. Existing generated recipes suppress inland hydrology and Coastal island supplies ocean only. Changing that capability would exceed the approval. The same exception applies to rotating periods with this objective.

The rollback audit reproduced a real scoring defect: after terrain replacement failed, the retained migrated world's altitude modifier became steady. The rollback now restores the captured modifier with the original world, preserving scoring focus. The regression injects a rebuild failure, then checks seed, spawn, terrain, gameplay profile, modifier and scoring focus. No evaluator or physics rule changes. See [failing baseline](migration-rollback-before.txt).

Every supported contract has three generated-world evaluator fixtures on seeds 42, 1337 and 9001. These exercise the original contract events and capped score, including actual generated water, biome diversity, settlement landmarks, traffic and thermal pocket availability where needed. The route matrix also checks every gate corridor and flat aligned runway approach, retaining earned-gold checks for good versus poor delayed flying. The browser smoke matrix checks ordinary launch, takeoff, gate one and refill for every mission and seed. Separate full flights cover Precision Landing, Ridge Trial, Water Skim and Volcanic Ops on all three seeds. Capture sessions may use two isolated browsers and are excluded from timing; full timing flights run sequentially with no other test, build or browser overlap.

Each browser receipt is also checked against the original catalog identity and resolved settings: label, detail, gameplay profile, weather, weatherShift, timeOfDay, windSide, contract catalog flag, stable contract-selection seed, terrain mapping and scoring modifier. The live HUD contract label must match the original assignment. These checks use read-only observations and do not complete objectives artificially.

The relaunch pulled `origin/main` at c51a7d23, reviewed the Part C changes and retained 34 passing smoke receipts only after checking their complete source and pilot hashes against the current build. Fresh focused verification passes 493 checks across catalog activation, objective fixtures, all fixed route corridors, period replay, bounded records, revisions, generator behavior and world rollback. The production build and separate production review build pass. See [focused checks](migration-c-verification/focused.txt), [production build](migration-c-verification/production-build.txt) and [review build](migration-c-verification/review-build.txt). The preceding source-current full suite passed 2,142 Vitest tests plus two frame-metrics checks. Normal UI receipts cover random Clean Circuit launches and explicit Precision Landing replay, retry, fresh worlds and copied-link replay in [seed lifecycle evidence](migration-seed-lifecycle/).

All 126 browser smoke flights pass on seeds 42, 1337 and 9001. Each takes off, clears gate one and receives the ordinary 25 percent nitro refill with the production clamp. The summary verifies every receipt's runtime/pilot hashes, original mission settings, contract assignment, modifier, migrated record identity and resident coverage. The six contact sheets contain all 252 chase/cockpit gate stills and were visually inspected: the four terrain recipes, retained weather, gate corridors, water joins and cockpit views remain coherent in these views. Smoke and screenshot stalls are excluded from performance acceptance. See [smoke rows](migration-c-smoke-results.md), [raw summary](migration-c-smoke-summary.json) and [visual evidence](migration-c-smoke/).

All twelve complete browser flights pass with gold: Volcanic Ops, Water Skim, Ridge Trial and Precision Landing on all three proof seeds. Every flight clears all five gates, receives all five ordinary gate refills and lands within the runway bounds with the completion panel open. Runtime errors and sampled resident-coverage misses are zero. Capture and profiling stay off, the chase camera stays fixed and no test, build or other review browser overlaps timing.

Full-flight FPS spans 39.4-42.3; the worst p95 is 49.9 ms. There are 441 intervals strictly over 50 ms and zero over 100 ms. The maximum is 83.4 ms; sampled main-thread used JS heap peaks at 137.5 MB. No physics, nitro, compositor, water, collision or budget tuning is applied. The original medal rules still award gold to good flying and deny it to the poor delayed-flight fixtures. See [source-verified full summary](migration-c-full-summary.json).

| Mission | Profile | Seed | Medal | FPS | p95 ms | >50 ms | >100 ms | Max ms | Heap MB |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| volcanic-ops | volcanic-run | 42 | gold | 41.0 | 33.4 | 31 | 0 | 66.7 | 98.5 |
| volcanic-ops | volcanic-run | 1337 | gold | 40.3 | 49.9 | 47 | 0 | 66.7 | 119.9 |
| volcanic-ops | volcanic-run | 9001 | gold | 40.3 | 33.4 | 47 | 0 | 66.8 | 135.4 |
| water-skim | coastal-island-run | 42 | gold | 40.0 | 33.4 | 34 | 0 | 83.4 | 128.3 |
| water-skim | coastal-island-run | 1337 | gold | 39.4 | 49.9 | 53 | 0 | 66.8 | 137.5 |
| water-skim | coastal-island-run | 9001 | gold | 39.6 | 33.5 | 45 | 0 | 83.3 | 131.8 |
| ridge-trial | mountain-valley-run | 42 | gold | 41.1 | 33.4 | 35 | 0 | 66.7 | 90.9 |
| ridge-trial | mountain-valley-run | 1337 | gold | 40.5 | 33.4 | 35 | 0 | 66.8 | 92.0 |
| ridge-trial | mountain-valley-run | 9001 | gold | 41.5 | 33.4 | 28 | 0 | 66.7 | 112.9 |
| precision-landing | desert-run | 42 | gold | 41.9 | 33.4 | 29 | 0 | 66.7 | 80.9 |
| precision-landing | desert-run | 1337 | gold | 41.6 | 33.4 | 28 | 0 | 66.7 | 87.1 |
| precision-landing | desert-run | 9001 | gold | 42.3 | 33.4 | 29 | 0 | 66.7 | 92.2 |

The supported contract migration is complete. The two Waterway tour exceptions remain unchanged for the documented capability reason. Step 3 stays STARTED, and further themes or features require separate approval. Vegetation/props, blackout/redout veils and the flight-warning strip remain removed. Weapons, combat, multiplayer and parallel record systems remain non-goals.

# Migrated mission gate and spawn audit, 10.991

Approval: Oct 22 option B permits only polish of the 72 existing migrated missions: gate faults, spawn faults, theme mismatches and docs synchronization. Any further theme, mission, mission type, objective, feature, system, mode or roadmap item requires separate approval. No gameplay overhaul is started.

Main was pulled at f6bbd9a4 with a clean worktree. There were no uncommitted leftovers to retain or discard.

All 72 fixed identities pass seeds 42, 1337 and 9001, reusing the existing generator proof seeds. No broken gate or bad spawn was reproduced, and production route generation is unchanged. The three rotating Ops entries are outside this fixed 72-mission inventory; their existing period proof is retained.

The dense geometry proof uses production terrain including water contact heights, production settlement collision shapes in flown and adjacent cells, airfield boxes, full gate trigger disks and aircraft body padding. Gate-to-gate corridors are sampled every 25 m at five lateral offsets within the existing 34 m or 52 m corridor. It checks finite local course bounds, 900-6500 m leg spacing, slopes below 25 degrees, forward normals, flat dry gear-height spawn and heading. The world is infinite, so there is no artificial world boundary. Actual ordered gate updates reject reverse and outside-radius crossings and accept the inside edge of each gate in sequence. The 27.64 m precision and 36 m ordinary trigger radii are preserved.

A separate headless pass extracts the existing controls pilot verbatim and flies all 216 cases at 60 Hz through normal aircraft physics from a stationary reset, through five gates and touchdown inside the 18 by 120 m runway. All cases have zero missed gates and no immediate failure. This checks takeoff and flight reachability without long manual flights. Airfield collision remains active. The node simulation uses analytic terrain without rendered mesh contact or weather and does not certify medals, browser timing or visual appearance. Browser and existing weather/contract proofs supplement it.

Initial diagnostic probes incorrectly assumed a full-width corridor beside the runway and diagonal departure toward the first Waterway gate. These flags were rejected as audit assumptions, not game defects: normal aircraft take off straight before turning. Departure obstacle acceptance uses the controls simulation and the corridor after 800 m; every gate disk is checked in full. An over-wide desert probe was also corrected to its existing 34 m corridor. No failed game case is discarded or patched by changing physics.

| Mission | Gates before / after | Spawn before / after | Simulated seeds |
| --- | --- | --- | --- |
| training-orbit | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| contour-circuit | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| weather-approach | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| range-sweep | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| precision-slalom | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| ridge-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| canyon-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| coastal-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| fjord-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| river-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| volcanic-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| volcanic-ops | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| rift-ops | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| desert-dash | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| alpine-pass | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| storm-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| night-ops | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| aurora-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| timberline-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| glacier-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| frostline-ops | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| rainforest-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| mesa-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| badlands-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| saltflat-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| savanna-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| tundra-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| tundra-ops | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| swamp-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| monsoon-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| archipelago-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| thermal-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| pattern-approach | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| crosswind-approach | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| traffic-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| waterway-tour | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| thermal-surf | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| high-dive | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| water-skim | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| ridge-trial | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| traffic-dodge | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| precision-landing | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| combo-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| night-flight | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| radar-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| precision-chain | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| butter-landing | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| dry-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| gust-rider | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| range-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| settlement-tour | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| airshow-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| biome-tour | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| scout-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| skyline-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| speed-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| terrain-hugger | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| fuel-saver | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| energy-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| storm-contract | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| crosswind-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| mach-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| burn-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| g-control-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| deadstick-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| clean-circuit-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| level-flight-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| water-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| brake-check-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| thermal-control-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| front-chaser-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |
| shoreline-run | Pass / unchanged | Pass / unchanged | 42, 1337, 9001 |

Receipts: [geometry](mission-polish-a/geometry.json), [controls simulation](mission-polish-a/simulation.json). Both retain source hashes. Reproduce with `node scripts/audit-mission-polish.mjs` and `node scripts/simulate-mission-polish.mjs`. The deterministic regression is `tests/missionPolish.test.ts`, covering all 216 gate/spawn cases.

Focused gate, migration-route, README and version checks pass 480 tests in five files. The production build passes. A production-mode Playwright Waterway Tour seed-42 takeoff/gate-one check supplies browser verification. This smoke flight makes no timing claim.

Theme presentation defects are recorded for Part B. Physics b20, nitro b21, the 10.978 desynchronized context and 10.989 frame-spike fixes, collision, water and budgets are unchanged. No heap tuning or city/roads redesign is included. Vegetation/props, blackout/redout veils and the entire flight-warning strip remain removed. Weapons, combat, multiplayer and parallel record systems remain non-goals.

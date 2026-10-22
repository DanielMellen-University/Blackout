# b30 variable mission gates

Daniel approved exactly this gameplay change on October 22, 2026: minimum 15 and maximum 100 gates in every scored mission. Other gameplay overhaul work still needs separate approval. Free flight retains zero gates and no scoring. Vegetation, props, warning strips, blackout/redout veils and their removed infrastructure stay paused. City/roads redesign remains closed.

## Deterministic distribution

The existing normalized mission seed and theme select one integer uniformly from each inclusive band, using the next draw after the existing terrain and route recipe draws. Training Orbit uses 15 to 24; Desert uses 15 to 40; Volcanic uses 25 to 60; Coastal uses 35 to 75; Mountain Valley uses 45 to 100; Waterway uses 55 to 100. Theme bands reflect the shorter desert runs and longer cross-terrain circuits. Training retains its shorter count even on replay. Fixed missions, Daily challenge, Contour circuit, Weather approach and Daily/Weekly/Monthly Ops all resolve through these same recipes and period seeds. There is no wall-clock dependency after resolving a period seed. Different seeds can legitimately select the same count.

Seed 67 Desert selects exactly 15. Seed 6 Mountain Valley and seed 20 Waterway select exactly 100. Training seed 42 selects 16.

## Corridor and bounded runtime

The existing seeded width, outbound reach, home return, runway, terrain reshaping and landscape revisions remain. A stadium-shaped corridor with rounded outbound and inbound reversals replaces the sharp original five-anchor reversals. Gates are sampled by horizontal travelled distance, leaving the first departure and final runway alignment intact. The terrain solver clears both endpoints of each short leg, probes the existing corridor and raises neighbouring gates to keep inter-gate slopes at or below 12 degrees. Departure retains its existing climb ramp. All this work occurs at route creation.

One shared torus geometry and existing shared materials serve a preallocated pool of 100 gate objects. The route trace has a reusable 100-point buffer. Updates continue to evaluate only the active gate; no per-frame gate allocation is added. HUD, minimap/navigation and ghost sampling already use the actual route count or continuous trajectory. Split persistence now accepts up to 100 entries. Briefings include the actual gate count. Normal Free flight creates no active gates.

## Balance and records

Gate scoring already uses average crossing quality, preserving the same total at any N. The existing time allowance is 45 seconds plus the actual route and runway-return distance at 150 m/s. Nitro gate refill is now `0.25 * 5 / N`: the b21 uncapped run total stays 1.25 reserves, with the existing full-reserve clamp. The 12-second reserve, 45-second passive refill, restart threshold and flight physics stay unchanged. At 15 gates each award is 8.333%; at 100 it is 1.25%. Medal thresholds remain gold 88,000, silver 76,000 and bronze 64,000.

Route revisions increase by 10: generated q46 to q49, migrated q146 to q149. Landscape revisions and b20 flight r32 remain unchanged. Existing score/history/ghost/trace families use the new route key; the existing read-only history display can show PRE-B30 records. Old records are never rewritten or copied into new-route bests. Existing bounded record retention still applies. Historical review documents and captured five-gate receipts describe their original builds and remain historical evidence, not current gate-count specifications.

## Verification

Part 1, 10.995:

- 587 focused tests pass across ten files, including every one of the 72 fixed missions on seeds 42, 1337 and 9001 with dense corridor, gate-disk, spawn, obstacle and real ordered crossing checks. The themed generator checks include the exact 100-gate seeds.
- A further 76 focused crossing/pool tests pass, including all 100 trace coordinates, 100-gate to short Training retry, hidden unused gates and Free flight reset with retained object/buffer identity.
- Score and nitro tests compare 15, 24, 55 and 100 gates against the old five-award budget and verify 100 stored splits. Daily/Weekly/Monthly period checks pass. New route IDs are separate and PRE-B30 historical lookup is read-only.
- Production build, TypeScript and release metadata checks pass. Vite retains its existing large-chunk advisory.
- The initial broad suite had 28 assertions tied to old gate positions/counts and three unrelated five-second test timeouts under default worker contention. Updated affected checks and isolated weather/river/pond regressions pass with two workers. A complete two-worker suite follows in Part 2.
- Browser visuals use the production-mode review build with the existing external controls-only pilot. No aircraft pose, velocity, gate state, physics, clock or scoring overrides are used. Desert seed 67 has 15 gates; Mountain Valley seed 6 has 100. Chase and cockpit gate stills and raw receipts are under [b30-visual](b30-visual/). These smoke flights verify appearance and counters, not whole-run completion or timing acceptance.

## Part 2, 10.996

`npm test -- --maxWorkers=2` passes all 180 files / 2,741 tests, plus both native frame-metric node tests. No timeout is increased. The fixed-mission geometry matrix now includes each mission's own catalog seed as well as 42, 1337 and 9001. Production build, TypeScript and release metadata checks pass with the existing Vite large-chunk advisory.

The repeated [all-catalog controls simulation](b30-simulation/simulation.json) passes 216 cases across all 72 fixed identities, with zero misses and touchdown inside the runway footprint. The [endpoint simulation](b30-extremes/simulation.json) passes another 15 cases across five representative missions, including exactly 15 gates, Valley 100 and Waterway 100. These are 60 Hz controls-only flights using production physics and analytic terrain, without wind or streamed mesh. Browser evidence supplies rendered contact and timing checks.

Both full production-mode browser runs land, earn gold, accept every gate, receive every scaled refill and open the completion panel. Runtime errors and sampled resident-coverage misses after ten seconds are zero. Source hashes match the inspected visual build; only Version.ts release metadata advances. See the [machine summary](b30-timing/summary.json), [15-gate raw receipt](b30-timing/desert-run-67/run.json.gz) and [100-gate raw receipt](b30-timing/mountain-valley-run-6/run.json.gz). Gzip preserves every native frame interval, sample, award and immutable build manifest without expanding the repository with large JSON text.

| Flight | Gates / refills | Medal / score | FPS | p95 / max ms | >50 / >100 ms | Peak sampled heap |
| --- | ---: | --- | ---: | --- | ---: | ---: |
| Desert seed 67 | 15 / 15 | Gold / 102,324 | 42.88 | 50.0 / 133.4 | 70 / 6 | 80.5 MB |
| Valley seed 6 | 100 / 100 | Gold / 98,386 | 38.32 | 50.0 / 83.3 | 123 / 0 | 74.3 MB |

Capture and profiling are off throughout these full flights. No tests, builds or other review browser overlap either measurement. The first ten native intervals are omitted using the existing receipt policy; all later slow intervals are retained. The 100-gate sample has no interval above 100 ms and no return of the earlier large b24-style stall. The 15-gate sample has six 116.6 to 133.4 ms intervals between 6.9 and 14.7 seconds after launch, so it does not meet a strict 100 ms ceiling. Themes and seeds differ, so the FPS and spike counts are not a causal comparison of gate counts. These short runs do not certify long-duration memory or universal stutter-free performance. No heap tuning is made.

## Part 3, 10.997

The final fixed-five copy audit is closed. Known replay and Ops seeds use their real gate count in picker contract previews. Fresh worlds defer the numeric pace target until launch resolves their seed. Free flight has no preview contract. The preview helpers default to the approved minimum; explicit historical five-gate helper calls remain compatible. Live contract definitions, targets and payouts are unchanged. The terrain-theme identity lookup uses the approved minimum as its positive gate-count sentinel.

Launch instructions now say to fly every gate. Two remaining capitalized five-gate mission descriptions use 15 to 100 gates. Initial HUD markup starts without an active gate instead of advertising 1/5; the ordinary runtime HUD supplies the actual count. Historical audits, changelog entries and immutable receipts retain their original five-gate facts, with the current decision called out in this report and the generator index.

All 502 focused tests across eight files pass, covering the previews, Ops/replay/Training counts, contract compatibility, HUD, picker and theme mappings. Production build, TypeScript, release metadata and both fresh/replay production picker checks pass. Inspected [fresh](b30-preview/fresh.jpg) and [replay](b30-preview/replay.jpg) stills show `TIME TARGET SET AT LAUNCH` and the seed-67 45-gate Speed run's matching `LAND UNDER 188S`. See [picker receipts](b30-preview/summary.json). No runtime error occurs.

Part 3 changes selection copy and preview helpers only, plus release metadata. The route generation, gate pool/crossing/trace, nitro application, flight loop and physics measured in Part 2 are unchanged. The full 2,741-test result belongs to 10.996; the final preview/copy delta is covered by the 502 focused checks. The remaining limits are the short-run nature of timing/memory evidence and the retained early 15-gate frame spikes described above. No further gameplay feature is implemented or approved.

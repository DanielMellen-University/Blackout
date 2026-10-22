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

Part 2 will retain full flights and capture-free frame-time evidence.

# b19 terrain audit, 10.953

Base: origin/main 10.952, `897807f`. Main was clean and the required pull was already current. There were no uncommitted leftovers to finish or discard. This part changes review tooling and release metadata only. No terrain, physics, collision, mission or paused-system code changes.

Six sequential hardware-Chromium Free flights use Balanced, 1280 x 720, fixed pixel ratio 1, clear daylight, production chase/cockpit cameras and one airborne reset followed only by control inputs. Each runs for over 45 simulation and wall seconds. Stills at approximately 5, 20 and 35 seconds give 36 inspected views. The pilot aims at 180 m clearance, or 350 m above ground through the city skyline; actual altitude varies with relief and aircraft response.

| Seed | Coverage | Sampled AGL range | Browser errors | Frame gaps >100 ms |
| --- | --- | ---: | ---: | ---: |
| 42 | Alpine snow ridges | 139-363 m | 0 | 0 |
| 2026 | Desert/badlands, inland slope and valley | 36-591 m | 0 | 0 |
| 9001 | Green plains and rainforest hills | 98-202 m | 0 | 0 |
| 1 | Volcanic ash and dark cinder relief | 34-361 m | 0 | 0 |
| 73 | Coastal land/water contact | 94-239 m | 0 | 0 |
| 1337 | City roofs, foundations, roads and green hinterland | 290-612 m | 0 | 0 |

All 36 stills under `audit/` were inspected. No visible terrain seam, uncovered gap, floating building or broken/floating road is reproduced. Snow ridges, tan dry slopes, green rolling ground, charcoal volcanic relief and sand/water coast are visually distinct. The six records retain exact flight poses, seed, biome, camera, streaming state, browser/GPU identity, pilot hash and all production-source hashes. Source is frozen at 10.952 during these captures.

Terrain update maxima range from 16.8 to 27.9 ms. Frame histograms omit screenshot capture windows of 1.5 seconds per image; terrain timings do not. These short flights do not establish the long-flight hitch criterion. One seed-1 height-coverage query is null during the airborne-reset stream transition; no missing ground is visible in its retained views. The final runner will retain the exact time of any such query so reset coverage can be distinguished from flight coverage.

## Failures and work still required

No production terrain defect was found in the inspected area, so there is no justified terrain repair yet. The complete bar is **not met by this audit alone**:

- Fresh repeat of all six low-altitude passes remains pending.
- Temporal LOD appearance at normal flight altitude remains unverified; stills alone cannot close it.
- Three fresh, clean ten-minute browser flights remain pending.

Step 1 stays open until those checks pass. This is bounded route evidence, not a claim about every coordinate in every seed.

## Review-route corrections retained

`pilot/` retains the initial 90-second seed-42 harness flight with automatic weather. `supplemental/` retains the original seed-2026 sea-facing run, the seed-808 mountain-facing run and the failed first city run. The sea and mountain runs are not used to certify the intended dry and volcanic coverage. The fixed set uses an inland badlands heading and seed 1's volcanic core instead. `routes.json` pins the final six starts/headings for the repeat.

The initial seed-1337 pilot flies into a tower at 2.633 seconds, 194 m AGL. `city-contact/1337-failure.jpg` reproduces the tower strike, with no aircraft terrain-impact snapshot. This is an obstructed review path, not a terrain gap or unexplained crash. Raise this review flight to 350 m clearance; the accepted city flight clears the skyline and finishes. No obstacle, collision or physics code is changed. Rejected and supplemental runs remain available rather than being counted as clean flights.

## Reproduce

Install Playwright outside the repository and supply its entry point in `PLAYWRIGHT_MODULE`, plus `CHROMIUM_PATH` and optional `REVIEW_URL` for a running Vite source server. Run `node scripts/plan-terrain-closeout.mjs` once to reproduce `routes.json`, then `node scripts/review-terrain-closeout.mjs docs/reviews/terrain-closeout-b19 audit`. `CLOSEOUT_SEEDS` selects seeds. No tests, builds, profiles or other review browser overlap accepted flights. Exact injected pilot versions are archived by SHA-256 under `hooks/`; the runner archives each new hook automatically. `summary.json` validates records and source identity.

The runner injects review-only pilot/observer code into the served module. Flight physics is unmodified. Heap remains an observation against about 200 MB, with no memory optimization. City/roads redesign stays closed; all paused exclusions remain in force. Existing mission loading will receive a smoke check only.

Verification before this commit: all 165 test files and 1,625 tests pass on an isolated full-suite rerun with the unchanged five-second test limit. The first run had one existing hydrology test time out while the build overlapped; that run is not reported as passing. Production build and version metadata checks pass, with the existing bundle-size advisory. The six-record summary and archived hook hashes validate.

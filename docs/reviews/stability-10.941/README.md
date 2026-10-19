# Long-flight stability closure, 10.941

Criterion 3 passes. Three sequential Free flights use the unchanged current default review pilot, production weather/day cycle, aircraft physics, collision, fuel, streaming, settlements and HUD. Each exceeds ten simulation minutes and ten wall-clock minutes. No application exception, shader/console error, browser-page crash, unexplained crash or pilot-induced terrain strike occurs.

| Seed | Simulation seconds | Wall seconds | Sampled horizontal distance | Minimum sampled AGL | Errors | Terrain strikes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 73 | 650.583 | 652.459 | 146.69 km | 569.23 m | 0 | 0 |
| 42 | 651.783 | 653.118 | 144.59 km | 146.99 m | 0 | 0 |
| 1337 | 653.400 | 653.411 | 144.27 km | 450.64 m | 0 | 0 |

Each raw seed record retains 129 observations, eleven minute-spaced stills and the final airborne state. Distance sums horizontal travel between those observations, excluding the initial interval; minimum AGL is the sampled minimum, not an all-frame bound. All 33 stills are visually inspected. Seed 73 continues beyond the historical 616.5-second ridge strike using the already-existing eight-kilometre-lookahead pilot. No pilot or physics change is needed in this part.

The pilot resets airborne once before measurement, then changes only control axes, throttle and assist. The production simulation owns subsequent poses and contacts. Seed 73 crosses clear, cloudy, overcast, rain and snow regions. Seed 42 also crosses storm; seed 1337 crosses clear, cloudy, overcast and snow. Weather is not forced clear or locked for these runs. These are controls-only automated flights, rather than prescribed trajectories or manual handling acceptance.

`source.json` records base commit `d3cfac2`, every source-file hash, the exact pilot hash and the sole pending production-source diff: 10.941 release metadata. All source hashes still match after the three flights. `summary.json` records the verified outcomes. Every sample has the requested world seed, Free flight identity, pixel ratio 1, an OK aircraft state and no ground contact. The runner exits successfully after all three runs.

The review-only runner now captures every console error and browser-page crash, alongside application exceptions. It suppresses only the irrelevant favicon request. Production error behavior and the pilot remain unchanged. The existing raw heap field is retained without analysis, profiling or optimization; the target remains about 200 MB.

Verification: six focused ridge-contact, collision, resident-surface, weather-director, paused-system and release files pass 45 checks. The production build passes with its existing bundle-size advisory. Landscape revision 29, route revision 30, water, all physical/resource limits and paused exclusions remain fixed. No production crash fix is necessary. Arbitrary routes and manual pilot safety are outside this bounded stability result.

Reproduce with `FLIGHT_SEEDS=73,42,1337 FLIGHT_SECONDS=650 node scripts/review-endurance.mjs docs/reviews/stability-10.941`, supplying the live source server in `REVIEW_URL` and the installed `PLAYWRIGHT_MODULE`/`CHROMIUM_PATH`. The default hook is `scripts/browser-endurance-review.js`. Run no other review browser, build, tests, offline survey or profiler during the flights. Run `npx vitest run tests/ridgeContact.test.ts tests/collision.test.ts tests/terrainSurface.test.ts tests/weatherDirector.test.ts tests/removedSystems.test.ts tests/version.test.ts` afterward.

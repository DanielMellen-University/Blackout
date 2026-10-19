# Road integrity closure, 10.940

Criterion 2 passes on seeds 42, 73, 808 and 1337. The generated audit covers the complete roads emitted for the sixteen-village corpus, deduplicating shared regional links. It finds zero floating ground cross-sections, buried deck cross-sections, unsupported sampled bridge/viaduct sections, nonfinite points, oversized/zero profile steps, detached regional endpoints, missing dry junction aprons or unexpected truncated streets. No production repair is necessary.

| Seed | Local roads | Regional roads | Segments | Engineered sections | Supports |
| --- | ---: | ---: | ---: | ---: | ---: |
| 42 | 19 | 3 | 5,368 | 206 | 15 |
| 73 | 20 | 3 | 4,504 | 19 | 3 |
| 808 | 19 | 4 | 5,984 | 105 | 10 |
| 1337 | 20 | 4 | 6,389 | 127 | 17 |
| Total | 78 | 14 | 22,245 | 457 | 45 |

There are 21,880 independently resampled ground cross-sections. Maximum centre/left/right offset error is below 0.000000001 m. Every consecutive profile step is positive and at most 24 m. All 28 regional endpoint joins coincide with an original local-street point in XYZ and accept a dry junction apron. Engineered sections are checked against newly sampled centre/edge terrain, and each bridge/viaduct point must be within 144 m of an emitted support; embankments use the existing continuous soil fill.

The 156 local street ends comprise 78 street junctions, 75 planned lane termini and three service-arterial termini. Reconstructing the deterministic layout verifies the exact endpoints of every accepted street, so these termini are intentional rather than truncated profiles. Thirty complete proposed streets are rejected by the existing terrain/resource validators; no partial rejected road is drawn. The explicit seed-73 regional skip remains in the 10.939 ledger. This audit does not label a farm lane as an unintended failed regional highway.

`before.json` and `after.json` retain all per-road numbers, source hashes, highest-risk stations and street-end coordinates. Routing/rendering source hashes are identical: the before/after names describe inspection checkpoints, not a claimed geometry repair. `scripts/audit-road-integrity.mjs` and `tests/helpers/roadIntegrity.ts` implement the reproducible audit. Negative controls detect raised ground sections, broken steps, a support-cap-exhausted viaduct and a detached join.

The generated rendered-contact regression now includes seeds 42 and 808 alongside seeds 73, 1337 and the earlier steep seed 1. Actual asphalt and shoulder meshes are refitted through far/near/far resident terrain. Ground vertex, triangle edge and face-interior probes remain required, while fixed engineered anchors must remain unchanged. Existing junction geometry and collision checks remain required.

Visual evidence uses 1280 x 720, pixel ratio 1, 30 m road clearance and production chase/cockpit cameras. Each checkpoint captures both the highest-risk station, ranked by terrain clearance plus grade, and the far village street join on each seed. Exact cumulative profile distances select the risk station. The sixteen before and sixteen after stills inspect supported crossings, dry fills, road/terrain contact and street transitions. These are fixed resident inspection poses, not a manual road drive or a proof of the infinite graph. The initially abandoned capture facing away from a junction is excluded and overwritten by the accepted approach-facing capture.

Verification: six focused files pass 27 checks, followed by the strengthened independent-terrain audit's five checks. The production build passes with its existing bundle-size advisory. Both accepted visual records contain zero page/console errors. All 32 stills are visually inspected. No floating or broken road is observed in these views. Physical limits, landscape revision 29, route revision 30, aircraft physics/collision, water, resource ceilings and paused exclusions remain fixed. The heap target remains about 200 MB; no performance or heap investigation is included.

Reproduce with `node scripts/audit-road-integrity.mjs OUTPUT.json` and `npx vitest run tests/generatedRoadIntegrity.test.ts tests/generatedRoadContact.test.ts tests/roadJunctionReview.test.ts tests/roadCollision.test.ts tests/removedSystems.test.ts tests/version.test.ts`. Run `scripts/review-road-integrity.mjs DIRECTORY LABEL docs/reviews/roads-10.939/coverage.json` with `ROAD_INTEGRITY=docs/reviews/roads-10.940/after.json`, the live review server in `REVIEW_URL` and the installed `PLAYWRIGHT_MODULE`/`CHROMIUM_PATH`.

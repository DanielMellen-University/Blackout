# Continuous coastal coverage, 10.936

Baseline is `24530be` (10.935). Six deterministic sea-contour routes run for 180 simulation seconds / 45 km each at 250 m/s and 90 m clearance, with production chase and cockpit cameras alternating every 30 seconds. Seeds 73, 1337, 7 and 31415 extend the earlier four-seed wet-edge corpus; 2026 and 808 retain previously reviewed seeds on new continuous coastal paths. Each baseline/candidate flight retains seven stills and roughly three-second resident-geometry scans. Route points and hashes, actual active camera/seed/ratio assertions, served method bodies, raw samples and errors are retained.

## Transition defects and publication order

A tile marked `fadingOut` can remain fully opaque while missing replacement leaves finish. The seam scheduler and publisher previously discarded those still-resident neighbors, and refused to publish updated banks owned by a held coarse tile. An unrelated edge rebuild could therefore remove an existing connector even though the fallback continued drawing. The generated seed-2026 fixture reproduces a connector with 811 vertices being stripped back to its 543-vertex prefix. Both fallback roles now remain eligible until actual removal from the resident map. Retirement still restores the original skirt/index state.

The first seed-73 continuous run confirms the issue in actual resident geometry: frozen baseline records uncovered bank intervals in 12 of 58 sampled states, including held fallback neighbors with no seam work pending. The first repair leaves one sampled state with seven intervals while an ordinary new-neighbor seam is queued. `pilot-fallback-only/after/73.json` preserves that intermediate result. Final new tiles now wait for their already-queued adjacent bank owners before starting the ordinary fade. Existing opaque coverage remains in place while those uploads use the same queue and deadline. Contact sampling sees the same resident grids at the same installation point; the fence changes presentation only.

The inherited fence-only candidate was rejected after its full six-flight audit. Ready results were published before banks, starving the queue that released fades and fallback roots. Seed 7 ended with 1,694 resident tiles, while the baseline ended with 628. `pilot-fence-queue/` retains those records and stills. The final queue drains already-pending banks before admitting new tile results, using the same deadline and upload cap; a new continuing-ready-stream regression proves that priority.

The new dependency sets exist only until a tile can start its first fade. Work uses the existing upload/time cap, worker slots, terrain publication queue and draw families. No extra height probes, per-tile mesh/buffer families, generated-tile requests, detail reductions or distance changes are introduced. Serving banks first can delay ordinary tile admission and retain existing fallback meshes longer; the final resident and queue counts below make that tradeoff explicit. Existing terrain normals/tints and all core/contact arrays remain unchanged. The common 17.5 m lighting derivative from 10.932 is retained, with added near-water mixed-grid regressions on four new coastal seeds.

## Evidence

Final counts are in `summary.json`; each counted interval is a sampled exposed wet-bank gap between actual opaque contact owners. Coverage is tested against the real resident seam/skirt triangles on either side at three heights. The scan includes still-opaque fallback owners and checks the actual contact tile on each side of the edge. Shared wet vertices independently compare RGB and normals. This extends the older stationary review, which excluded all fading-out tiles.

| Seed | Baseline gap states / intervals | Final gap states / intervals | Final bank intervals | Final shared wet points | Peak / end resident tiles |
| --- | ---: | ---: | ---: | ---: | ---: |
| 73 | 12 / 36 | 0 / 0 | 1950 | 72600 | 959 / 644 |
| 1337 | 18 / 61 | 0 / 0 | 2411 | 74743 | 891 / 622 |
| 7 | 26 / 102 | 0 / 0 | 958 | 65837 | 1129 / 614 |
| 31415 | 48 / 477 | 0 / 0 | 3167 | 88890 | 1156 / 756 |
| 2026 | 53 / 437 | 0 / 0 | 1321 | 59919 | 679 / 614 |
| 808 | 30 / 170 | 0 / 0 | 1338 | 35432 | 669 / 644 |

All six final flights finish 180 seconds / 45 km with seven production-camera stills each, zero sampled bank gaps, exact shared wet normals/RGB, and no application/shader errors. All 42 final stills are visually reviewed. The frozen baseline records 1283 uncovered intervals across 187 sampled states under its narrower owner filter. Counts are not frame totals or matched rates.

Peak resident tile count is 1156 versus 667 in the baseline. Ready-result queues peak at 19, and blocked new tiles at 17. These are increased transient residency/admission costs under unchanged configured budgets, not a performance improvement. The final FPS sample is reported separately in 10.938. Coarse parents are not hidden to make the geometry check pass.

`pilot-overview/` is excluded: an initial development-host capture retained its orbit camera/focus after framing, so it did not exercise the intended moving production camera or streaming focus. The accepted hook validates the actual rendered camera before every observation. `pilot-fallback-only/` contains the useful first repair and an interrupted second-seed capture; it is separate from the final six candidate flights.

## Verification and limits

Four generated transition regressions fail against frozen 10.935 and pass on the candidate. They cover retained neighbor coverage, publication on a held owner, queued-bank presentation readiness and service ahead of a continuing result stream, with unchanged contact height and a one-upload cap. Four new generated lighting regressions preserve exact shared wet normals and colors. The 11 affected streaming/LOD, seam, water/contact, worker lifecycle, removed-system and metadata files pass 131 checks. The production build passes with the existing bundle-size advisory.

This is prescribed terrain-following travel, not real-physics/manual handling acceptance. Baseline and candidate visual pipelines run concurrently, and may overlap offline checks; their timing is not a performance measurement. Geometry is observed at about three-second cadence for opaque contact owners, not every pixel or frame. Fine/coarse contact-height differences, coastline silhouette steps, nonshared intermediate lighting, independent water-surface stitching and universal coast acceptance remain open. Physics, collision sampling, water generation/levels/materials, landscape revision 29, route revision 30, all configured budgets and saved records remain unchanged. No incompatible ghost bump is needed. Vegetation, G-load veils/tones and flight-warning strips remain excluded.

The heap target remains about 200 MB, as confirmed for 10.931. No heap snapshots, allocation analysis or memory optimization are performed. The concurrent captures here are not a city-route FPS/stutter measurement. A separate isolated measurement belongs with the subsequent field review; no performance improvement is claimed here.

Reproduce paths with `scripts/plan-coastal-review.mjs`. Serve the frozen baseline with `node docs/reviews/coastal-flight-10.936/baseline-server.mjs` (port 5175), candidate with ordinary Vite. Run `scripts/review-coastal-flight.mjs DIRECTORY before/after` with `REVIEW_URL`, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and optional `COAST_FLIGHT_SEEDS`. Validate with `scripts/summarize-coastal-flight.mjs DIRECTORY`. The frozen regression configuration is `baseline-test.config.mjs`; run it with Vitest's `--config` option to repeat the expected three failures.

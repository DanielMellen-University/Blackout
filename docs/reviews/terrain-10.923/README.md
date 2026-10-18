# 10.923 four-seed terrain review and dry edge color continuity

Before is pushed 10.922, `d1d99d4`. Source manifests identify both sides; the after manifest includes the uncommitted candidate diff. This pass changes only dry terrain boundary colors. It does not change height samples, normals, topology, water, collision, detail, distances, workers, uploads, settlement limits or other budgets. Landscape revision remains 28, with records and every paused-system exclusion preserved.

## Reproduced defect and correction

The previous rock tint used the tile's finite-difference slope. Two tiles could sample the same world vertex and base biome palette but bake different colors because their grid spacings differed. The four new browser scenes expose actual shared-vertex jumps from 0.019 to 0.114 RGB. The independent CPU generator reproduces all four; the new regressions fail on 10.922.

Dry boundary colors now evaluate slope on the same 17.5 m world spacing as the near contact lattice. Ordinary dry near edges reuse their already equivalent gradient. Coarser or shore-corrected dry edges take four height-only probes, within the existing prepared hydrology margin. Wet boundary treatment remains unchanged. The original gradient arrays still supply mesh normals, so lighting geometry and physical surfaces are not replaced by material shading.

| Seed / landscape | Selected shared-vertex RGB jump before | After | Two-tile warm build median before / after ms |
| --- | ---: | ---: | ---: |
| 42 / alpine snow near volcanic relief | 0.0191621 | 0 | 2.938 / 3.768 |
| 2026 / mesa and badlands | 0.1144231 | 0 | 7.682 / 8.393 |
| 9001 / plains and green hills | 0.0318369 | 0 | 3.984 / 4.694 |
| 808 / volcanic terrain | 0.0749232 | 0 | 3.605 / 3.990 |

`before-edges.json` and `after-edges.json` retain the actual points, both tile requests, every timing sample, RGB values and non-color buffer digests. All four pairs keep identical heights, normals, indices, bounds, water and other attributes. The six older independent terrain/water payload checks also pass unchanged. No snapshot expectation is raised or replaced. Four edge regressions, geometry/LOD, sliced/interleaved generation, biome weighting, water-bed and paused-system checks pass: 96 tests. The production build passes.

These CPU timings are isolated from browsers, with eight runs per pair and the first excluded from the warm median. The extra 0.4-0.8 ms per measured pair is real build work. There is no frame-rate or heap improvement claim. The 10.922 color-function optimization remains unchanged; a full matched flight comparison after this visual change has not been run.

## Low-altitude review

The additional seeds are 42, 2026, 9001 and 808, beyond the earlier two-seed field review. Each scene covers landscape silhouettes, mixed-LOD edge measurements, an actually loaded road and actual sea contact. Production chase and cockpit cameras are used at 160 m landscape clearance, 30 m road clearance and 90 m coastal clearance, at 1440 x 900 and pixel ratio 1 with clear weather and fixed daylight. The road fixture uses a resident regional connector where available and an actual local street when none is loaded, rather than inventing connectivity. Coast refinement confirms wet ocean samples and points the camera toward water.

The final before/after manifests retain poses, headings, actual seed, biome, camera identity, stream state and edge measurements. After seam headings and coastal positions/headings are pinned to the saved before values. These are stationary field inspections, not manual flight handling, maximum-speed travel or completed landing approaches. All 32 before/after pairs are saved and inspected. X/Z, heading, seed and camera mode match in every pair, with no application exceptions. The broad settled-edge scans improve from 0.019-0.114 RGB to at most 0.000000030 RGB. Three initial coastal chase poses differ in altitude by 1.82, 0.18 and 0.13 m as their sampled LOD settles; the paired cockpit altitudes match exactly. Those chase stills are qualitative contact checks, not exact pixel comparisons. See `pose-comparison.json`.

`pilot-heading/` preserves the initial inland-facing coastal views and the occluded seed-42 seam direction. `pilot-after-heading/` preserves after pilots whose direction changed when the worst color vertex changed. Both are excluded from acceptance; the corrected captures replace them without changing game source between captures on either side. The development browser blocks Vite's local websocket connection. Those infrastructure console messages are retained separately from application exceptions and are not shader failures; the rejected initial manifest retains the original logging classification.

## Remaining work

The original geometry/normal mismatch is not hidden by claiming complete seam acceptance. Initial settled dry-edge scans also find normal differences and small shore-correction height differences, including about 3.65 m in the seed-42 region and about 0.21 m in seed 2026. Nonmatching intermediate vertices, skirt/contact appearance, close cliff silhouettes, broader coastal network connectivity and excavated road cuts need further work. This color-only pass leaves those surfaces untouched. It does not certify every biome or coastline.

The latest full matched performance result remains 10.922: northeast peak 214.7 MB against the 155.4 MB target, plus a retained 400 ms flight hitch. Current-revision matched performance, northeast heap, sustained/workerless acceptance and actual landing approaches/debrief follow-through remain open. Vegetation, flight-warning UI/tones/probes and blackout/redout effects remain paused and excluded.

## Reproduce

Set `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and optional `REVIEW_URL` for the running Vite server. Run `node scripts/review-terrain-seams.mjs docs/reviews/terrain-10.923 LABEL`. `POLISH_SEEDS` selects comma-separated seeds; `POLISH_STAGE=seam` or `coast` recaptures only that stage. Complete seeds resume from the manifest. The browser-only review hooks are injected into Vite's HTML proxy module; no production review API is added.

With browsers closed, run `node scripts/review-terrain-edge-colors.mjs BEFORE_VISUAL.json OUTPUT.json`. Supply the frozen 10.922 TerrainGeometry source through `TERRAIN_GEOMETRY_BASELINE_SOURCE` for the before version. Keep the measured source frozen while taking stills. Use the saved before manifest for after headings rather than choosing a new best-looking direction.

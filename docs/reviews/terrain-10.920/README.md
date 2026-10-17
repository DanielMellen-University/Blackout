# 10.920 first terrain and biome polish pass

Dry biome detail effects now use the same normalized palette weights as the base color. Ash, salt crust, frost, lowland breakup, riparian tints, dune/alluvial/badland/karst/glacial bands, foothills and alpine exposure no longer switch with the categorical biome winner. Full geography weights retain their existing squared normalization; the two-biome fallback retains its linear mix. Temporary color targets and material weights use fixed synchronous scratch storage instead of allocating a new tuple or record for each detail effect.

Geometry, terrain heights, normals, indices, bounds, collision, water attributes, distances and all existing budgets are unchanged. The landscape revision stays 28 because this pass changes colors only. No paused system is restored.

## Numerical acceptance

The test straddles a dominant-biome switch with weights 0.500001 and 0.499999 at the same position, elevation, climate and landform. Channel values are on the 0-1 RGB scale. This isolates the discontinuity from ordinary geographic variation.

| Material boundary | Largest channel jump before | After |
| --- | ---: | ---: |
| Plains / snow | 0.213027 | 0.000000688 |
| Mountain / snow | 0.102433 | 0.000000201 |
| Plains / volcanic | 0.058435 | 0.000001015 |
| Tundra / plains | 0.091825 | 0.000000636 |
| Salt flat / desert | 0.065414 | 0.000001235 |
| Savanna / swamp | 0.062211 | 0.000001087 |
| Mesa / desert | 0.066644 | 0.000000862 |

With identical full weights, exchanging the dominant biome label produces identical colors. The same continuity checks pass for the two-biome fallback. Four independent samples for each of fourteen pure dry biomes preserve 10.919 colors to 12 decimal places, including interleaved calls that exercise shared scratch reuse.

Independent 10.919 non-color payload hashes match all six terrain fixtures: near, skirted mid, pond, far water, far fallback and runway pad. These include all water colors as well as heights, topology and normals. Sliced and direct generation remain identical, including interleaved and cancelled builds. Original 10.891 full-payload hashes are archived separately rather than silently replacing the old appearance baseline with new values.

## Cost

`before-materials.json` uses the exact 10.919 terrain sampler supplied to the same loader and harness. `after-materials.json` uses shipping source. Both keep all raw timings. These are CPU-only diagnostics, without the browser running, not controlled FPS measurements.

For 1,200 cached-climate color evaluations, warm median increases from 0.745 to 2.323 ms. Blending several active material effects costs more than evaluating only the winner. Reused scratch avoids extra transient target arrays but does not remove this arithmetic/noise cost.

| CPU terrain fixture | Before warm median ms | After warm median ms | Payload bytes, both |
| --- | ---: | ---: | ---: |
| Near | 6.883 | 7.921 | 39,412 |
| Skirted mid | 1.172 | 1.280 | 26,068 |
| Pond | 15.258 | 14.771 | 225,588 |
| Far water | 1.960 | 2.186 | 10,516 |
| Far fallback | 1.125 | 1.112 | 10,356 |
| Runway pad | 3.889 | 5.369 | 39,412 |

Each terrain row has five timed warm builds after preparation; this is a small diagnostic, not a broad throughput result. There is no FPS or heap improvement claim. The 10.917 northeast heap failure remains open, and the matched flight benchmark has not been repeated after the road tessellation and color polish.

## Browser verification and limits

Fresh hardware Chromium with ANGLE Vulkan, 1,440 x 900, pixel ratio 1. Eight final low-altitude stills use actual loaded roads and production chase/cockpit cameras at 30 m road clearance. The coastal connector and steep terrain retain continuous shoulders and stable visible surfaces. Four exact road poses have 10.919 before images copied from the already inspected road acceptance capture. Colors blend through the visible lowland/foothill/alpine scene without the previous categorical detail switch. `after-visual.json` records all poses and no page or console errors.

The initial HMR pilot lost road poses when source cleanup reloaded Vite. It is retained in `rejected-hmr-pilot/` and excluded from acceptance. The final run began after source edits finished and checks every pose before capture.

This starts the requested polish phase. It does not certify every biome seam, coastline, coarse terrain silhouette or manual flight. Broader low-altitude landscape coverage, actual terrain excavation under roads, mixed-LOD seam acceptance, subjective audio balance and current-revision performance/heap acceptance remain open. Vegetation and the removed warning/blackout categories remain excluded.

## Reproduce

Run `node scripts/review-biome-materials.mjs OUTPUT.json`. For the before version, save `git show 4cb7b78:src/world/terrainSample.ts` to a temporary file and set `TERRAIN_BASELINE_SOURCE` to its absolute path. The hook changes only that source module for the diagnostic loader. Run the installed Playwright Chromium through `scripts/review-road-surfaces.mjs` with output directory and label, plus `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and optional `REVIEW_URL`.

The focused terrain set passes 118 checks. The production build, three release-metadata checks and browser review also pass. No full-suite run is claimed.

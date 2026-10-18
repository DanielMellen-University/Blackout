# Shoreline bank stitching, 10.929

The next unfinished non-performance world phase after regional weather is terrain/biome polish. This part completes a bounded feature within that phase: render-only shoreline bank coverage between resident mixed-LOD terrain edges.

The prior connector rejected an interval whenever either edge was within two metres of water. That left visible near-water cracks, including cases where one bed was submerged but the other bank remained above water. Connectors now span the exposed gap down to the higher interpolated water surface plus 2 cm. Fully submerged beds remain open. Terrain crossings, terrain/water crossings and switches between the two water grades become explicit knots, preventing folded walls, submerged dams and protrusion above the original higher bank.

No contact sample or independent water vertex changes. Core ground positions/indices and all water/contact buffers have identical hashes in the paired review. Landscape revision 29, saved records, render distances, instance budgets, workers, attachment cap and upload deadline remain unchanged. Connectors use the existing terrain draw and near back pass. More seam geometry is published, so this is not a performance or memory improvement.

## Verification

The new submerged-bank and near-water regressions fail on 10.928 and pass with the feature. Synthetic cases cover fully submerged rejection, crossed water grades, the 2 cm clip, no protrusion, unchanged source/contact buffers, non-nested grids and restored missing-neighbor skirts. Two real generated gaps from seeds 2026 and 9001 are pinned with independent triangle-coverage checks.

The four focused terrain files pass 54 tests in total, including the final added real-fixture checks. Release metadata checks and the production build pass. The production build retains the existing bundle-size advisory.

`before.json` and `after.json` record actual resident tile pairs at fixed clear-weather coast poses in seeds 2026 and 9001. Paired chase/cockpit stills are captured at 90 m clearance, 1280 x 720, pixel ratio 1. All eight stills are visually inspected. The coast, water, aircraft and terrain remain present with no application/shader errors. These broad poses do not make every small distant crack legible at pixel scale.

`buffers-before.json` and `buffers-after.json` independently generate those measured tiles and project every connector triangle into the shared edge plane. All 120 test points across 24 gaps are uncovered before and covered after. The largest sampled exposed gap is 0.346153 m. All physical/core hashes match. The seven unique isolated owner/neighbor fixtures add 24, 236, 52, 68, 40, 76 and 48 vertices respectively. These pairwise counts are not a whole-scene geometry total. Regenerate with `scripts/review-shore-buffers.mjs`; `SHORE_BASELINE_SOURCE` accepts the original TerrainSeams source for the comparison. `scripts/review-shores.mjs` records the resident views.

The 24 selected actual gaps lie in the near-water exclusion band. The one-submerged-bank case is verified synthetically, not claimed as a newly observed generated fixture. This does not stitch independent water meshes, reshape shorelines, certify every coast or remove the visible coarse shoreline steps. Terrain excavation and arbitrary cliff/contact continuity remain open. Concurrent endurance flights make these visual runs unsuitable as performance benchmarks. All paused systems remain excluded.

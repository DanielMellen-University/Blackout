# Water review 11.045

## Far coast

Sea triangles now clip against the corrected drawn terrain bed, including vertices whose original biome was dry. Previously the coarse shore-bed correction could lower those vertices below sea level while the original binary biome mask still excluded their water. That mismatch cut cell-sized steps into the coast. Freshwater retains its river/basin mask; the direct water-builder compatibility path retains its previous default. Hydrology generation is unchanged.

Reproduction: `/dev/terrain.html?destination=ocean&seed=1`, with the review camera at `(-10904.482029513456, 9000, -16945.05757175386)`, looking at `(-11904.482029513456, 15, -11945.05757175386)`. This is the seed-1 regional sea, Clear weather, 1600 by 1000, pixel ratio 1. Both captures settled for 45 seconds and reported 554 loaded tiles, zero pending/in-flight/ready terrain jobs and four workers. The renderer was real Chrome with ANGLE/Vulkan on Intel Xe Graphics. These stills are visual evidence, not frame-performance measurements.

Before, `b9e1ac86`:

![Before, sea shoreline from 9000 m](before-ocean-seed-1-9000m.png)

After:

![After, sea shoreline from 9000 m](after-ocean-seed-1-9000m.png)

Both images were inspected. The large steps at the left shore and the upper end of the inlet are removed. Coarse bank shading remains visible along the left edge. This does not certify all coasts or low-altitude transitions.

Run `scripts/review-water-coast.mjs before|after` with Node 22, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and optionally `REVIEW_URL` (default `http://127.0.0.1:5186`). Start Vite on that port with `--strictPort`. The script only exposes the existing development review camera through a browser response override; it adds no player UI. Destination, seed and settling time can be set with `REVIEW_DESTINATION`, `REVIEW_SEED`, and `REVIEW_SETTLE_MS`. Capture details are in the adjacent JSON files.

Validation: 52 checks across `waterCoarseCoast`, `waterSystem`, `waterMeshSteps`, `terrainGeometrySteps`, and `terrainWaterBed`, plus `npx tsc --noEmit`, pass on Node 22. Existing hash expectations are unchanged. The focused regression covers submerged formerly dry corners, the interpolated zero-height crossing, all-dry cells and preserved freshwater masks.

## Cold generation and foreground review

Measurements and final verification are pending the next ordered steps of this review.

The paused vegetation, flight-warning and blackout/redout systems remain excluded. No camera, mission, gate, scoring, featured-card, Free flight landing behavior or release metadata changes are included.

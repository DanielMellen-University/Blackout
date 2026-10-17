# 10.919 coastal connectivity and rough road review

The seed-73 coastal village now connects to its northern neighbour. Regional asphalt, gravel shoulders and paint follow the rendered terrain triangle interiors through LOD changes. Gravel has a raised inner lip and closed soil edges. All existing collision, water, support, grade, distance and scheduling limits remain in force. No paused system is restored.

## Coastal route

`coastal-before.json` and `coastal-departure-diagnostic.json` record the four rejected links in 10.918. The shore endpoint was clear, but a forward-only corridor with tapered ends could not approach it around the local buildings. Other candidates correctly failed the 96 m structure height, 1,200 m dry span or 1,800 m wet span limits.

`coastal-after.json` records the first accepted link, `-5,-2|-5,-3`: 927 profile points, 40 wet bridge points and a roughly 20.12 km road. The bounded two-way search can move sideways or briefly backtrack. It replaces coastal local refinement within the existing 5,000-probe allowance, with at most four complete profiles and four neighbour attempts. Non-coastal refinement is retained. Exact joins, building/service clearance, dry endpoints, grade engineering, supported water crossings and every rejection limit still apply. Routing is canonical in either query direction. The recorded 30.4 ms planning time is a single CPU diagnostic, not a frame-time measurement or throughput result.

The focused generated-world check independently samples wet centerline points, verifies that they are raised bridge decks, checks span/height/support limits and reverses the endpoint order. This proves the selected fixture, not universal connectivity across every generated coastline. Water may be crossed by the existing bounded bridge system; ground roads do not terminate in water.

## Road surface contact

Draped vertices were insufficient: straight triangles between those vertices could pass through a terrain diagonal. The ground artwork is now clipped at the near terrain grid and its diagonals. All coarser terrain edges lie on that lattice too. Existing source vertices, profile detail, fixed engineered triangles and collision geometry remain. The clipping generator yields every 64 source triangles. The draper still publishes atomically with the same 1,024-vertex and 0.8 ms limits. No work is added to every frame once the terrain revision is unchanged.

Contact probes check triangle centroids and edge midpoints, only when all three vertices have actual terrain data. Engineered anchors are excluded from ground conformity assertions. Values below are asphalt height above rendered ground in metres; the intended value is 0.45 m. All final sampled interior offset errors are below 0.002 m.

| Fixture and LOD | Before min/max | After min/max | Before buried / gaps over 1 m | After buried / gaps over 1 m |
| --- | --- | --- | --- | --- |
| Seed 1337 city approach, far | -0.0653 / 0.7155 | 0.44997 / 0.45003 | 2 / 0 | 0 / 0 |
| Seed 1 steep road, far | -2.3705 / 2.5186 | 0.44988 / 0.45006 | 85 / 73 | 0 / 0 |
| Seed 1 steep road, near | 0.3866 / 0.4579 | 0.44994 / 0.45006 | 0 / 0 | 0 / 0 |

The before and after sample counts differ because clipping creates more faces. These are geometric correctness counts, not comparable frame-stall counts. Complete per-fixture values, shoulders, near/far passes and triangle counts are in `contact-*.json`. The second far pass returns the same result. The local coastal road remains on the previous artwork path and is also checked.

There is a real geometry cost. For the steep fixture, asphalt grows from 4,460 to 32,408 triangles; the city approach grows from 5,464 to 48,756. This adds faces rather than lowering terrain, road, collision, water or distance detail. Existing draw/material families and all admission/worker/profile/support/drape limits are retained. This batch does not claim an FPS or heap improvement. Current-revision continuous performance and broader mixed-LOD seam coverage remain useful follow-up work.

Ground roads retain their terrain-following cross-section. Existing engineered gullies and approaches retain their fills, sidewalls and piers. This change does not add a new terrain excavation system or flatten the landscape under roads.

## Browser verification

Hardware Chromium/ANGLE Vulkan, 1,440 x 900, pixel ratio 1, clear weather, production chase and cockpit cameras at 30 m road clearance. Eight final stills cover the coastal connector at 50% and 90%, and the steep seed-1 road at 50% and 65%. `after-visual.json` records the actual streamed road keys and poses, with no page or console errors. The inspected road edges and visible approaches are continuous. These are prescribed actual-road views, not manual aircraft handling or a controlled FPS comparison.

The `before-*.png` stills are before surface fitting but already include the coastal route fix. They are not screenshots of the disconnected 10.918 coast. The original disconnected result is preserved in the routing diagnostics. Terrain colors remain unchanged here; obvious broad biome bands are part of the next phase.

## Reproduce

Run Vite, then use `scripts/review-road-surfaces.mjs` with `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and optional `REVIEW_URL`; positional arguments are output directory and capture label. For contact diagnostics, temporarily copy `contact-probe.test.ts.txt` into `tests/roadContactDiagnostic.test.ts`, run that file with Vitest, then remove it. Set `ROAD_ARTWORK_BASELINE=1` for the old triangle/shoulder path. The baseline override removes the newly added soil faces, restores the 0.3 m inner gravel offset and bypasses clipping. It preserves the same generated road so route changes do not confound artwork contact.

The shipping regression checks are `generatedRoadContact`, `roadTerrainFit`, `generatedRoadConnectivity`, `roadShoulderBands`, and the existing road/clearance/collision/worker/assembly checks. Independent 10.916 structure buffer fixtures remain exact for bridge decks, sides, fills and piers. Landscape revision 28 rejects incompatible ghost paths while preserving saved records.

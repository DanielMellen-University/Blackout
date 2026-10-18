# Wet mixed-LOD edges, 10.932

Baseline is main at 9b18a25, 10.931. The previous batch already closes exposed wet-bank gaps with 10.929 connectors. This part retains that coverage and extends the 10.923/10.924 common 17.5 m slope derivative to wet tile boundaries. Lake, river and shore-bed corrections can vary with tile spacing, so their grid derivatives cannot provide matching lighting at a shared vertex. The common derivative changes render normals and slope tint only.

The same 34 generated tile pairs contain 156 shared wet vertices. Resident coast pairs from the four-seed browser scan are supplemented with deterministic generated lake and river pairs. All terrain core positions, indices, contact heights, water levels and every independent water attribute/index have matching SHA-256 digests. Landscape revision 29, collision, scene detail, render distances, worker/admission/upload/draw budgets and saved records remain unchanged. There is no memory optimization or FPS improvement claim. Extra boundary height probes add CPU work.

| Seed | Pairs | Shared wet points | Maximum normal difference before | After |
| --- | ---: | ---: | ---: | ---: |
| 42 | 8 | 28 | .062722 | 0 |
| 2026 | 6 | 33 | .158399 | 0 |
| 9001 | 11 | 55 | .011695 | 0 |
| 808 | 9 | 40 | .046092 | 0 |

Shared wet RGB differences are already zero in these selected baseline points and remain zero. This is not a measured color improvement. `attributes-before.json` and `attributes-after.json` retain actual jobs, coordinates, attributes, feature classifications and physical digests. `coverage-before.json` and `coverage.json` independently project seam triangles at five heights in each of 48 real exposed bank gaps. All 240 probes are covered on both sides, with the largest sampled gap 1.433811 m. No new uncovered gap was found in this set, so no second connector implementation is added.

## Verification

Four new actual lake/river regressions fail on frozen 10.931 and pass after the derivative change. The archived failure output is `regression-before.txt`. The 90 focused terrain, cooperative generation, seam, streaming, water/collision and removed-system checks pass. Three cooperative lifecycle assertions now use the existing independently frozen physical hash, rather than a full hash that includes the intentionally changed wet normals and colors. They retain the original expected physical value, and direct/cooperative full-payload equivalence remains covered. Six metadata/README checks and the production build pass, with the existing bundle-size advisory.

The four seeds use the saved 10.923 coastal poses at 90 m clearance, clear weather, fixed daylight, 1280 x 720 and pixel ratio 1, in production chase and cockpit cameras. `before.json` and `after.json` retain the actual resident tiles and camera positions. All 16 stills are visually inspected. Coast, water contact, aircraft and terrain remain present, with no application/shader errors. All paired positions and headings match, including altitude. These are stationary low-altitude inspections, not handling or landing acceptance. The baseline TerrainGeometry is frozen in a Vite transform; `source-manifest.json` identifies both sources. Initial browser starts without GPU-device access stalled before capture and are excluded. The accepted runs use hardware GPU access and record application/shader errors separately from Vite infrastructure messages.

## Quick city-route FPS and stutter

One isolated 120 s / 81.6 km city-corridor run on seed 1337 records **40.22 mean FPS**, a **16.7 ms median**, **33.4 ms p95**, **50.0 ms p99** and **66.7 ms maximum** frame interval. There are **15 intervals over 50 ms** and **0 over 100 ms** across 4,827 flight intervals. Mean FPS is 1,000 divided by the arithmetic mean of the actual RAF intervals. Paused/hidden periods are excluded by the existing recorder; startup is retained separately in the raw result.

The fresh Chromium 153 process uses the Intel Vulkan hardware renderer, Balanced quality, 1280 x 720, fixed pixel ratio 1 and four terrain workers. No other review browser, tests, builds, allocation sampler or trace runs during measurement. `fps/current/city-1.json` retains every interval, startup measurements, hardware details and source identities; `fps/summary.json` records the calculation. This is the existing maximum-speed prescribed FlightReview route, separate from the controls-only Training playthrough. A single run is a quick measurement, not a before/after speedup, sustained acceptance or proof that the historical 400 ms hitch is fixed. Reproduce with `scripts/profile-flight.mjs`, `REVIEW_ROUTES=city`, `REVIEW_RUNS=1` and `REVIEW_PROFILE=0`.

## Reproduction and limits

Run `scripts/review-shores.mjs` with `SHORE_SEEDS=42,2026,9001,808`, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and `REVIEW_URL`. Serve frozen baseline TerrainGeometry for before and the candidate for after. Run `scripts/review-wet-edge-attributes.mjs BEFORE.json OUTPUT.json` with `TERRAIN_GEOMETRY_BASELINE_SOURCE` for baseline attributes. The same option now lets `scripts/review-shore-buffers.mjs` verify baseline physical/coverage invariants. Run `scripts/summarize-wet-edges.mjs` against this directory to check matching pairs and poses.

Independent water-surface stitching, coarse shoreline steps, every coast/cliff silhouette and collision height continuity remain open. The shared-point check does not claim that nonmatching intermediate samples have identical derivatives. Existing connectors cover the sampled vertical gaps. The active heap target remains about 200 MB, already set by 10.931; no active 155.4 MB check or fixture remains in src/scripts/tests. Historical measurements retain their original limits. Vegetation, flight-warning strips and G-load veils remain excluded.

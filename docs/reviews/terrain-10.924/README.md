# 10.924 mixed-LOD geometry and normals

Baseline: pushed 10.923, `be994dc`. Same four seeds and saved seam poses/headings as 10.923, now at **1280 x 720, pixel ratio 1**, with production chase and cockpit cameras, clear weather and 160 m terrain clearance. These are stationary inspections, not handling or landing acceptance. Source identities are in `source-manifest.json`.

## Evidence and fix

Two independent defects were reproduced. Shared dry vertices used different normal-probe spacings. Dry-edge lighting now reuses the canonical 17.5 m derivatives already calculated for the 10.923 tint fix, stored through the same Float32 gradient arrays. No extra geography probes are needed. Four actual seed-based normal regressions fail on 10.923 and pass after the change.

The old coarse skirt extended only 60 m downward. It missed fine edges above its top, gaps below its bottom, and intermediate vertices on non-nested water-promoted grids. A resident coarse tile now joins both actual edge polylines at their union of knots. Crossing profiles split at their intersection. Partially wet intervals clip at the dry boundary, keeping the connector above both interpolated water levels with 2 m clearance. No connector projects above the higher original edge. Covered original skirts are replaced, and missing-neighbor skirts are restored when neighbors retire. The strips stay in the existing terrain draw, including the shared near back pass.

The fix deliberately leaves collision/contact heights and terrain core positions unchanged. Thus the physical shared-height differences remain **3.6494 m on seed 42** and **0.2065 m on seed 2026**. The visible gaps are covered, rather than changing those physical samples or independently clipped water. Other two seeds have zero shared-height difference in the measured fixtures. No configured distance, detail, worker, upload, settlement or scheduling budget changes. Publication uses the existing attachment deadline and upload count; no additional draw or persistent geometry cache is introduced. Landscape revision remains 28 and saved records are preserved.

## Measured edge deltas

`before-edges.json` and `after-edges.json` regenerate the same actual resident tile pairs. They include original 10.923 color-selected fixtures and the new height/normal-selected fixtures, deduplicated by pair. The baseline uses frozen 10.923 TerrainGeometry source. Shared vertices, all union knots and their interval midpoints are measured. Connector triangles are checked at 10%, 50% and 90% of each dry vertical gap. Baseline coverage assumes its coarse downward skirt is available, so missing-skirt cases can only make the old result worse.

| Seed | Tile pairs | Largest edge height delta m, unchanged | Largest shared normal delta before / after | Uncovered dry gap m before / after | Maximum added connector vertices per pair |
| --- | ---: | ---: | ---: | ---: | ---: |
| 42 | 10 | 5.0018 | 0.106003 / 0 | 5.0018 / 0 | 96 |
| 2026 | 4 | 161.2786 | 1.154958 / 0 | 101.2786 / 0 | 416 |
| 9001 | 8 | 14.7646 | 0.173051 / 0 | 14.7646 / 0 | 96 |
| 808 | 12 | 64.4717 | 0.693055 / 0 | 64.4717 / 0 | 96 |

These are physical edge-profile differences, not new terrain displacements. The original broad browser scan finds shared normal maxima of 0.1421, 1.1550, 0.1731 and 0.6931 respectively; every final dry shared-vertex normal maximum is zero. Physical-buffer and terrain-core hashes match in all 34 CPU fixture pairs, including every water attribute and index. The six historical physical-payload fixtures are independently reproduced from frozen 10.923. Old normal-inclusive hashes remain archived; only ground normals are excluded from the physical invariant, with dedicated seam regressions replacing that assertion.

This adds connector vertices and attachment work. It is not an FPS or heap improvement claim. The largest fixture adds 416 vertices within one existing terrain draw; no triangle-merging or detail reduction is hidden in the result.

## Verification and limits

The 114 focused checks cover geometry, shared colors/normals, water-bed preservation, cooperative/interleaved generation, non-nested grids, higher fine edges, profile crossings, dry clipping, repeated publication, retirement, attachment caps, LOD/layout/streaming, paused systems and release metadata. The production build passes. The full suite is left to CI.

All eight before/after chase/cockpit pairs are retained and visually inspected. The narrow dark edge lines improve in the alpine, green and volcanic scenes. The seed-2026 water/shore view retains its water contact; the CPU fixture exposes the severe distant intermediate-vertex gap that this broad pose does not isolate at pixel scale. The seed-42 pose retains the large existing nearby slope at the right of the frame. It appears on both sides and is not presented as a corrected silhouette. All paired aircraft positions and headings match; final resident seam queues are empty. Application exceptions are absent. Vite's blocked local websocket messages are kept separately in the manifests and are not shader errors.

An earlier midpoint check exposed a 0.758 m dry opening beside a wet endpoint. Whole-interval wet rejection was replaced by dry clipping, and the final midpoint check returns zero. `pilot/` retains the initial partial stills and excludes them from acceptance. Geometry and lifecycle behavior stay frozen during the final captures; release metadata and explanatory comments are updated separately.

Wet-edge surface stitching and universal shoreline/cliff appearance are not certified. Neither are collision height continuity, manual handling, landings, northeast heap or the 400 ms hitch. Landing follow-through is next. Vegetation, the flight-warning strip and its tones/probes, and blackout/redout effects remain removed and excluded.

## Reproduction

Set `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, optional `REVIEW_URL`, `POLISH_STAGE=seam` and `POLISH_POSES=docs/reviews/terrain-10.923/before.json`. Run `node scripts/review-terrain-seams.mjs docs/reviews/terrain-10.924 LABEL`. Before captures require frozen 10.923 production source; preserve the final candidate while taking after captures.

Run `node scripts/review-terrain-edge-geometry.mjs docs/reviews/terrain-10.924/after.json OUTPUT.json`. Set `TERRAIN_GEOMETRY_BASELINE_SOURCE` to frozen 10.923 TerrainGeometry for before. Timings and screenshots are separate from performance acceptance. Sensible scope calls: retain collision samples, use actual resident neighbor profiles, cover dry gaps in the existing draw, leave independent water clipping and all paused systems untouched.

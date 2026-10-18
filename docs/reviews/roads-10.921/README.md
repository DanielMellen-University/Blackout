# 10.921 road CI repair

Base: `1a9acab`, chunk 10.920. No expectation is raised to accept the 16,207-vertex asphalt result.

The 10.919 fitter clipped every regional ground triangle at every near-grid edge and diagonal, including perfectly planar terrain. On the flat 24 km regression this needlessly raised asphalt vertices from 3,027 to 16,207. The fitter now retains a source triangle only when its underlying plane agrees within 0.00001 m with every enclosing terrain vertex at all dry near, mid, single-far, horizon and reduced-fallback spacings. Checks include coarse vertices outside the ribbon: a flat near profile cannot hide a coarse bend. Wet samples fail the certificate. Height sampling is cached only for the current geometry build. Nonplanar and fixed engineered triangles keep their previous paths.

The unchanged long-road assertions now pass: 3,027 asphalt vertices, 12,072 indices, and exactly one refit probe per physical vertex. New regressions cover planar slopes, a hidden near-grid crest, a hidden coarse-grid bend, and wet rejection. The existing generated seed-1, seed-73 and seed-1337 far-near-far checks still probe triangle interiors and edge midpoints to within 0.002 m of the rendered surface.

The shoulder failure was an obsolete topology assertion. Its expected 24 vertices described six four-vertex rows before lattice fitting and closed outer soil edges; 148 includes those deliberate additions. The raised inner lips are at the asphalt boundary, not across its interior. Replacing the old count with a triangle-by-triangle lane exclusion assertion directly protects the 10.913 rule. Both sides must stay at least half the asphalt width from its centreline, including every added soil triangle. The original asphalt junction vertex/index assertions remain unchanged and pass. The generated contact checks and separate local/regional band regressions also pass. No gravel cap was found, so no speculative cap-removal change is claimed.

This repairs the flat-road work regression. Curved terrain still needs lattice-fit faces; this does not claim a measured whole-flight performance or heap win. All existing detail, distance, admission, worker, profile, support and drape limits, engineered anchors, collision, revision 28 and saved records remain. Vegetation, flight warnings and blackout/redout systems remain paused.

## Verification

The 18 focused checks across road junctions, terrain fitting, shoulder bands and generated contact pass. The production build and metadata gate pass. One full-suite run completed with 1,525 passing checks and three unrelated five-second water-test timeouts while browser capture was active. Re-running just those three files serially passes all 26 checks; no timeout or expectation was changed. The full suite contains 1,528 checks in 150 files. Remote CI is checked after the push.

Eight final 1440 x 900, pixel-ratio-1, clear-weather stills cover two positions on both the seed-73 coastal connector and seed-1 steep road, using production chase/cockpit cameras at 30 m clearance. All eight images were inspected: asphalt remains continuous and the shoulders stay beside it. `after-visual.json` retains exact streamed road poses with no page or console errors. This is prescribed camera review, not manual handling or a performance run. The partial HMR capture is explicitly rejected in its own directory.

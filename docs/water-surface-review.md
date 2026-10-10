# Water surface review - 10.877

## Change and visual boundary

River mouths no longer force optical depth to 0.08 m at lake shores. Receiving lakes query the same channel triangles and insert inlet points along their existing shoreline chords. A separate 120 m radial shoreline band keeps the shallow transition away from the lake's large interior fan. Depth coloration reaches deep-water tones over a few metres rather than tens of metres. Submerged channel beds are not raised inside the lake join.

Generated basin preparation queries complete basin bounds, yields cooperatively, caches only complete results under existing weak node ownership, and rejects world-seed changes while suspended. Water footprints, levels, collision surfaces, render distance, worker/upload caps, draw passes, and texture reads are unchanged. Additional shoreline geometry does increase upload size.

Visual checks used the existing terrain review: seed 1337 Small ponds in overview and seed 1 River valley at the terminal mouth, unobstructed first person, Clear weather. The shallow lip is reduced and the low-altitude water transition is cleaner. Browser error logs were empty. A broad triangular patch remains on the very wide seed-1337 inlet/bend; this batch does not fix every overlapping channel ribbon or complete water artwork. The browser was throttled near one frame per second, so these observations cannot establish gameplay frame time or sustained-travel memory.

## Same-machine CPU comparison

Baseline is 10.876. Both runs used seed 1337 and the same Node/Vite geometry builder on this machine, without an additional HTTP server. Each tile was built 12 times; the first build is excluded from the warm median and p95. These are CPU geometry timings, not FPS, GPU frame times, startup times, or heap measurements.

| Tile / origin / size | Baseline median / p95 (ms) | 10.877 median / p95 (ms) | Payload before / after (bytes) |
| --- | --- | --- | --- |
| Pond near / 9660,19740 / 420 | 28.171 / 39.571 | 28.272 / 60.488 | 216372 / 230772 |
| Mouth near / 10080,18480 / 420 | 27.602 / 28.590 | 25.148 / 31.430 | 257124 / 309828 |
| Far shore LOD 2 / 10080,16800 / 3360 | 4.353 / 12.605 | 5.130 / 13.358 | 132724 / 196660 |

Near-tile medians are similar in this limited sample, but pond p95 is worse and the water-heavy far payload grows approximately 48%. This is a visual correction with a measured geometry cost, not a general performance improvement. The largest measured cooperative phase in these samples was 8.643 ms before and 6.793 ms after; that alone does not prove hitch-free streaming.

## Verification and remaining work

Focused tests compare independently interpolated Float32 waterDepth, waterFlow, and waterKind across 12 m and 100 m inlet fixtures, verify existing polygon shores are unchanged, compare whole-basin and tile-clipped geometry, and cover generation order, cancellation, cached reuse, and suspended seed changes. Existing shared surface/collision and cooperative geometry checks remain required.

Wide-channel self-overlap, complete depression/spill connections, regional weather delivery, and controlled foreground maximum-speed travel/memory comparisons remain unfinished. Vegetation, flight warnings, and blackout/redout remain paused. Actual EST rollover wiring and per-level world generation are deferred.

# Water surface review - 10.879

## 10.879: actual lake outlets and bank-aware grades

The initial three-seed/nine-region audit found 59 inland lakes, four outlet labels, but only one source-node river. Three labels pointed at dry parent nodes without an emitted outlet. Outlet metadata now records actual local water connections, not the existence of a lower parent alone. Optional through-lakes follow at most three existing descending edges within 6 km; accepted streams terminate in a compatible lake, sea, or formed river. Failed local routes retain closed basins, never dry-ending channel stubs. Cached plans retain coordinates and scalars, not node object chains, under the existing 16,384-node FIFO cap. No new workers, persistent global index, larger region halo, render-distance reduction, lake-frequency increase, or upload-budget increase is introduced.

Lake tributaries participate in a shared level junction before incident ribbons are cached. If an established river already emerges from a submerged node, reuse it instead of adding a parallel stream that can dip and rise at their first crossing. Existing river routing now tests the full bank influence against nearby lake levels, not only the centerline. This fixes the pre-existing seed-2026 `-6:24:0:6` rise near a lower lake. Carving, visible geometry, and collision consume the same new reaches. Ghost landscape revision 8 rejects incompatible playback without deleting records or traces.

The extended ten-seed/250-region review sampled 401,769 actual water levels with no downstream rise above 0.15 m. All 19 added downstream ends joined an independent lake or a matching next channel. Focused tests pin the seed-73 lake/river junction, seed-42 submerged-node reuse, seed-2026 wide-bank grade, closed-pond metadata, query order, cache eviction, physical wet coverage, and endpoint agreement. Existing sparse-water and width/branching checks remain unchanged. Cooperative deterministic snapshots intentionally advance for changed grades and outlet metadata.

Same-machine seed-73 catchment preparation, eight independent cold preparations per version: baseline median/p95 28.689/55.315 ms, revised 31.831/51.452 ms. Largest measured channel phase increases from 3.541 to 3.882 ms; owned reaches increase from 234 to 240. This is about an 11% median CPU cost in this small sample, not a general speedup or gameplay-FPS result. Loaders close and use a separate dependency cache without another HTTP server. Region/cache ownership and existing rendering budgets are retained.

The new `Lake outlet junction` terrain-review destination uses seed 73. Clear-weather overview and unobstructed low-altitude first-person checks show the lake connected to the receiving river without a doubled water panel; error logs were empty. Shoreline corners remain visibly polygonal. Background browser throttling limits this review to still appearance, not sustained maximum-speed frame times or memory. Broader global depression/spill routing, complete water-artwork review, regional weather delivery, and the controlled foreground travel/memory comparison remain unfinished. Paused vegetation, warnings, and blackout/redout are untouched; actual EST rollover and per-level generation remain deferred.

## 10.878: one visible river surface

The seed-1337 wide confluence previously had 800 overlapping wet sample points on the fixed 25 m grid, including 557 approximately coplanar points with differing optical depth. River union now clips losing coverage against the higher face, then against the deeper profile on level joins; stable face identities resolve exact ties. The focused regression retains more than 2,500 wet samples, their original upper water heights and deepest level profiles, without duplicate coverage. Separate fixtures cover crossing slopes and folded triangles within a single wide ribbon. Independent existing Float32 rendering/collision checks still cover five fixed seeds.

Complete neighborhood queries, deterministic sorting, cooperative yields, cancellation/seed guards, and a weak per-reach result cache preserve streaming order independence without retaining a neighbor graph. Temporary spatial bins are released after each build. No new worker, persistent strong cache, draw pass, texture lookup, or render-distance reduction is added. Clipping produces more vertices and first-time CPU work; warm reuse does not make that cost disappear.

Mouth half-cap rims now match the depths of their physically shared cross-section banks. Freshwater shares one shallow/deep palette instead of a separate river-flow paint layer. World-space broad coloration no longer changes phase with river/lake kind. Shallow depth/foam detail fades per fragment between 450 m and 1,800 m, retaining close-up shallows while avoiding large vertex-gradient panels at flight distance. This is optical detail fading, not reduced physical water coverage or view distance. Sea water retains its deeper palette; local current ripples remain width-dependent.

Same-machine seed-1337 comparison against 10.877, with 12 builds per tile and the first excluded from warm statistics:

| Tile / origin / size | Baseline median / p95 (ms) | 10.878 median / p95 (ms) | Cold before / after (ms) | Payload before / after (bytes) |
| --- | --- | --- | --- | --- |
| Pond near / 9660,19740 / 420 | 30.033 / 52.555 | 27.506 / 51.218 | 183.970 / 149.099 | 230772 / 230772 |
| Mouth near / 10080,18480 / 420 | 28.230 / 40.172 | 25.939 / 35.931 | 63.688 / 200.966 | 309828 / 340500 |
| Far shore LOD 2 / 10080,16800 / 3360 | 5.275 / 11.296 | 5.327 / 7.479 | 16.243 / 63.340 | 196660 / 245188 |

The mouth payload grows approximately 10%, and the water-heavy far tile approximately 25%. First-time mouth/far preparation is substantially slower because the union is constructed, rather than reused. These CPU timings do not prove frame-time or startup performance; no general speedup is claimed. The largest sampled cooperative phase after this change is 4.820 ms (climate), and the far tile's largest water-river phase is 1.679 ms. Comparison loaders close after completion and use a separate temporary dependency cache to avoid disturbing the existing review server.

Visual checks used seed 1337 Small ponds in overview and seed 1 River valley at the terminal mouth, unobstructed first person, in Clear weather. After nearby terrain streamed in, the previous broad bright inlet panel was no longer apparent, and the mouth had a continuous rippled surface without doubled stripes. The overview still shows polygonal shoreline corners; this batch is not a claim that all shoreline artwork is finished. Browser error logs were empty.

The browser review remains limited by approximately one-frame-per-second background throttling and intermittent observation delays. It is not evidence of normal gameplay FPS or sustained memory. Full low-altitude/maximum-speed foreground review, complete depression/spill connections, and regional weather delivery remain required before declaring the water/weather goal finished.

## 10.877: river/lake optical joins

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

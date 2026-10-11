# Water surface review - 10.883

## 10.883: connected-basin search cost

Spill discovery now walks raw upstream branches connected to the basin floor. It stops at the existing eight-node search envelope and 400 m breach ceiling instead of resolving every unrelated root in a 17x17 square. Candidate ties use the same geographic ordering, not discovery order. Temporary visitation storage is 289 bytes; the bounded queue is released with the cooperative generator. An impassable-shoulder fixture now samples exactly five nodes, rather than the surrounding square. Cancellation still cannot publish a partial route.

Same-machine, same-seed cold catchment preparation, 12 samples per case, exact 10.882 core versus optimized core:

| Seed / region | Before median / p95 (ms) | After median / p95 (ms) | Before / after work slices | Owned reaches |
| --- | --- | --- | --- | --- |
| 73 / 0,0 | 44.991 / 55.027 | 21.148 / 33.690 | 5,919 / 941 | 0 / 0 |
| 1 / -2,-2 | 51.263 / 60.913 | 31.297 / 37.016 | 6,892 / 1,270 | 528 / 528 |
| 1337 / -2,0 | 56.601 / 82.589 | 34.174 / 65.022 | 7,089 / 1,166 | 470 / 470 |

`node scripts/profile-drainage.mjs --baseline=9654364` now loads both historical RegionalDrainage and DrainageRouting. The three-seed/256 km-square review retains exactly 38 systems, 52.484 km mean stems, 1,817 formed edges, 3,630.771 km total formed length and zero dry terminals. CPU time is 1,023 ms before versus 557 ms after in that run. Existing fixed-seed water snapshot hashes remain identical. These are CPU-only measurements, not startup, GPU frame-time or sustained-memory evidence. The optimized search admits connected reverse paths within the envelope; generation revision 11 conservatively rejects old ghosts without deleting records. No terrain, water geometry, render-distance or streaming-budget reduction is used. The previously inspected stills remain representative of the unchanged review fixtures. Angular shoreline polish, controlled foreground performance comparison and final Free flight review remain open.

## 10.882: longer connected river systems

Shared four-neighbour drainage edges breach bounded local depressions into lower basin roots. The same graph carries accumulated rainfall, non-rising water grades, river widths, native lake outlets, carving and visible/collision surfaces. The existing 16,384-node FIFO owns coordinate/scalar caches; no second persistent graph is added. Spill preparation publishes only complete plans and yields cooperatively. Recreated upstream nodes are prepared even when their terminal's cached totals survive eviction.

`node scripts/profile-drainage.mjs` compares seeds 1, 42 and 1337 over the same 256 km-square node review per seed against commit e4c122a (10.881). Baseline: 364 selected systems, 12.764 km mean, 11.627 km median, 30.313 km maximum. New: 38 systems, 52.484 km mean, 50.191 km median, 76.674 km maximum. Mean main-stem length is 4.112x baseline; total formed channel length is 67.5% of baseline, not a density increase. Both have zero selected terminals lacking receiving water. These are whole-system graph lengths, including connected lakes, not a claim that every individual rendered span is four times longer.

Optional lakes now occupy actual raw depressions. Their contours stop before lower channels; safe arms grow to retain substantial pond area, and optional footprints too constrained to hold a useful pond are rejected. Broad single-trunk corners receive the shared level bend zone previously reserved for confluences. Independent lake-outlet ribbons are removed in favour of ordinary node-owned river edges. Rarer braids and deltas retain split/rejoin geometry; the 8 km source taper remains.

Affected tests cover actual downhill surfaces across five seeds and 125 regions, native lake-shore exits, closed basins, broad turning trunks, generation order, cancellation, eviction, independent Float32 mesh/collision agreement, substantial concave ponds, sparse coverage, river widths and maximum-speed fallback retirement. The retirement fixture now compares resident keys with the last scheduled layout and requires empty pending/fallback work, rather than replanning a few metres beyond its half-cell refresh position. No render distance or budget is reduced to pass it. Generation revision 10 rejects incompatible ghost playback without deleting records.

Same-machine seed-73 catchment 0,0, ten cold preparations: baseline median/p95 24.982/54.443 ms, connected routing 50.236/98.355 ms. Largest sampled connected phase is 3.006 ms, versus approximately 14 ms before cooperative preparation. This is an increased cold CPU cost, even though this region has zero new owned reaches versus 87 old ones. Neither warm reuse nor smaller work slices establish an FPS improvement. The graph-only review takes approximately 619 ms baseline versus 992 ms new across all three seeds; it is not a browser startup benchmark.

Clear-weather first-person river and overview/chase lake-outlet stills show continuous water connections. Angular shores and temporarily incomplete terrain during streaming remain apparent; complete water artwork is unfinished. Browser review is throttled near one frame per second, so its frame timings cannot establish normal gameplay performance. Controlled foreground startup, sustained maximum-speed frame-time/memory comparison, water polish and the final Free flight review remain required. Regional weather and half-strength delayed assist are already shipped; actual EST reset wiring, per-level generation and paused exclusions remain unchanged.

## 10.881: slower source taper, not longer river routes

Formed rivers blend from a 10 m half-width toward their existing runoff/gradient-derived width across 8 km of upstream channel distance, rather than reaching that width over one roughly 2 km edge. Distance follows the longest formed upstream stem, so a short tributary cannot restart an established trunk's taper. The same node width feeds every incident channel. One scalar is cached per existing node; the 16,384-node FIFO, catchment ownership, halos, worker/upload budgets, render distance, and graph routes remain unchanged. This narrows young channels without adding river frequency, ponds, or water coverage. Generation revision 9 skips incompatible ghosts without deleting saved records.

The water triangle containment tolerance now matches independent rendered Float32 checks. A synthetic regression covers sub-millimetre rounding beside an upper triangle over lower water, and rejects genuinely outside points. Source-profile tests pin the 8 km curve, monotonic transition, and more than 1,000 matching generated cross-sections. Existing order/cancellation/eviction, actual downhill water, lake outlet, and visible-surface/collision tests remain required.

Same-machine seed-73 catchment 0,0 preparation, ten cold preparations per version: 10.880 median/p95 29.963/57.766 ms; taper median/p95 22.431/52.610 ms. Owned reach counts stay 87 in both runs; the largest sampled channel phase rises from 2.717 to 3.574 ms. Separate closed middleware loaders use temporary dependency caches and no additional HTTP server. These small CPU samples include JIT/GC variability and do not establish an FPS, startup, or sustained-memory improvement.

The River headwaters review destination frames an actual source instead of the broadest trunk. Clear-weather low-altitude first-person inspection shows a narrow channel carved into rounded terrain; the route and a receiving lake remain visible downstream. Initial overview stills exposed partially streamed terrain, and shoreline segmentation remains visible. Browser error logs were empty. Background throttling around one frame per second prevents a useful maximum-speed performance judgment; full foreground travel comparison and complete water artwork remain unfinished.

The requested roughly 4x average river length is NOT implemented in this batch. Baseline terminal-system main-stem length averages 12.370 km across 261 selected systems in seeds 1, 42, and 1337 over a 256 km-square node sample per seed. A coarse-routing prototype reached longer stems but removed too many local waterways. Independent basin-spill links averaged only 14.096 km in the comparable sample and later routed variants crossed existing water at incompatible heights. Those prototypes were backed out rather than shipped. Longer rivers require canonical connected drainage/junctions and valid depression spills, not stretching ribbons or stopping them on land. Regional weather and delayed half-strength flight assist remain shipped; actual EST reset wiring, per-level generation, and all paused-system exclusions remain unchanged.

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

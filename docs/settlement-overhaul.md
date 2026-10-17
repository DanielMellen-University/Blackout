# Roads and settlements overhaul

## Approved direction

Overhaul shared roads, villages, cities and rural development. The user approved
planning followed immediately by implementation, independent decisions, and
regular commits/pushes. Keep terrain/water generation and flight handling intact.
Weather acceptance is separate unfinished work, not part of this delivery.

## Delivery order

1. Grounding and scale: replace unsupported grade-lifted roads with grounded
   cross-sections, explicit bridge decks, supported approaches and viaducts.
   Sample both shoulders. Reduce oversized buildings and road widths using
   actual metre-scale dimensions; keep city extent and population meaningful.
2. Settlement structure: road-led village clusters, town centres, connected
   neighbourhoods and distinct city residential/commercial/industrial districts.
   Preserve rarity, seeded variety, dry foundations and airfield clearance.
3. Places and architecture: houses, apartments, offices, workshops, warehouses,
   civic landmarks, country gas stations, barns and agricultural plots. Add
   parks/plazas and paths as planned open space, not leftover gaps.
4. Integration/review: bridges across actual rivers, bank-connected ramps,
   terrain-contact checks at near/far LOD, building/bridge collision agreement,
   deterministic reloads and fixed-seed low-altitude visual checks.

## Performance and safety

- Keep planning off-thread, streaming/cache/upload budgets bounded, and shared
  instanced geometry/materials. No per-frame terrain sampling for every building.
- Retain four loaded settlements, 1,500 buildings and six regional road links
  unless measurements justify an explicitly documented adjustment.
- Use bounded additional batches for structures and ground features. Decorative
  detail follows distance/quality settings; no extra shadow passes or lights.
- Parks use open ground, paths and plazas. Vegetation, removed warnings and
  blackout/redout remain excluded. No combat, traffic simulation or interiors.
- Preserve records/settings/favourites. Advance ghost compatibility if changed
  obstacle geometry makes old trajectories unsafe; do not delete saved records.
- Verify each coherent batch with affected tests, production build, saved
  rendered evidence and synchronized release metadata before commit/push.

## Current evidence

The existing regional road grade limiter only raises samples; it can lift dry
roads far above ground while only wet samples receive bridge supports. Regional
shoulders are also forced to centre height instead of sampling their own ground.
Village lots currently start around 180-440 m wide and 145-390 m tall. Cities
include kilometre-scale towers. Both need physical-scale correction, not camera
changes. Existing city/village placement, worker ownership and instance budgets
can be retained as the foundation of this overhaul.

## Batch 1: grounding and scale checkpoint (10.898)

- Village footprints use .075 of the previous dimensions; visible building
  heights use .06, capped at 28 m before foundation depth. City footprints use
  .22 and heights .14, capped at 320 m before foundations. Placement/overlap,
  foundation sampling, rendering and collision all consume the actual smaller
  dimensions. Roof/civic accents scale down too. City extent stays 8.5-10 km.
- Smaller lots made 37.3% of the three-seed sample cells viable villages, above
  the existing 35% ceiling. Candidate chance changes from .48 to .42 to retain
  the established rarity range; protected city/village anchors remain.
- Regional road widths become 10 m rural / 18 m city-connected. Dry centre and
  both road/outer-shoulder edges sample their own terrain instead of inheriting
  a raise-only grade envelope. Profiles subdivide to at most 24 m per segment.
- Wet cross-sections get level decks at least 7 m above water, anchored to both
  banks. Only their approaches can rise above dry ground: low lifts receive soil
  embankments, higher lifts explicit viaduct supports. Decks have sides and rails;
  asphalt/soil exclude deck spans to avoid coplanar material fighting.
- Limit profiles to 8,192 points, individual wet spans to 1.8 km, structure
  clearance to 96 m and supports to 192 per regional link. Try the bounded
  alternative bends when a crossing cannot fit. No global cache or per-frame
  terrain probes are added. Four settlements/1,500 buildings/six links remain.
- Dash phase continues across the denser segments instead of accidentally
  turning every short segment into a solid line. Physical markings narrow too.
- Ghost generation revision 17 rejects incompatible playback without removing
  saved records, favourites or settings. Terrain/water generation is unchanged.

The first 56 focused road/profile/rendering/budget/scale checks pass; the 17
settlement placement checks and six ghost checks also pass. Production build
passes with the existing Three.js size warning. Final metadata/build verification
is repeated before shipping.

The [seed-73 clear-weather village checkpoint](reviews/settlement-scale-checkpoint-10.898.png)
shows 13 smaller buildings and one regional road. The old layout now reads too
sparse and the flat green is oversized/partly floating. The flight-scale view
can be blocked by a nearer hill. These are diagnosed remaining problems, not
approved final artwork. Browser rendering is again near 1 FPS, so no smooth
travel or FPS claim is made. Full real river-crossing, near/far terrain-contact,
bridge-collision and sustained performance acceptance remain open. The next
batch must deliver road-led building clusters and grounded, planned open spaces
before calling the settlement design finished.

## Batch 2: districts and places (10.899)

Replace broad disk scattering with compact village branches and road-frontage
lots. Large city footprints contain linked, unequal centre, residential,
commercial and industrial neighbourhoods. Houses, apartments, offices, shops,
workshops, warehouses, civic buildings, barns and country service stations have
distinct physical dimensions, height bands, roof choices and colours. Country
farms and stations get early lot proposals, but still fail closed on wet/steep
ground. Generated flat-terrain tests require actual surviving barns, service
canopies, fields, parks and all city district types, not just proposal metadata.

Reserve open-space parcels before building placement. Parks/plazas, crossing
paths, fields and forecourts use sampled terrain triangles; submerged or steep
triangles are omitted. One vertex-colour mesh batches the ground surfaces.
Canopies, columns and pumps share a box batch; barn silos share a cylinder batch.
Canopies/columns/pumps use matching indexed collision boxes with open space below
the canopy. These are scenery, not traffic, interiors or vegetation.

Bound ground to 24 patches/30,000 vertices and local streets to 20,000 profile
points per settlement. Temporary street buckets avoid scanning every dense road
segment for every lot. Keep four settlements, 1,500 buildings and six regional
links. Ghost revision 18 preserves saved data. The main remaining integration
work is road/ground contact against the actual streamed terrain LOD, local water
crossings, and regional bridge collision. Browser still throttles near 1 FPS;
this batch makes no frame-rate or sustained-memory improvement claim.

The [seed-73 layout checkpoint](reviews/settlement-layout-checkpoint-10.899.png)
shows the tighter 13-building cluster and removal of the old oversized green.
Some road/ground sections still disappear into the coarser rendered terrain.
This is evidence for the next actual-LOD contact correction, not final artwork
acceptance. The 17 placement/distribution/anchor checks pass, along with 54
focused layout/scale/rendering/budget/ghost checks and the production build.

## Batch 3: streamed contact and bridge integration (10.900)

Ground road/park/field/forecourt vertices now refit to the actual rendered
terrain heightfield after its sampler revision changes. A caller-owned draper
processes at most 1,024 vertices per update with a .8 ms sampling deadline,
stages the changes, then publishes a complete mesh. Unchanged revisions do no
height sampling. Normal/bounds recomputation and the final buffer upload happen
once per completed mesh, not per sampled vertex; the sampling deadline is not
a claimed hard bound on total publication/upload cost. Remove registrations on
stream eviction and clear them on reseed/disposal. Decks, viaducts and engineered
fills do not collapse onto terrain. Marking metadata preserves that distinction.

Local streets now share the regional profiler, independent shoulders, level
water decks, supported ramps, embedded footings, rails and soil fills. Reject
crossings without dry end banks or enough approach length to return to ground.
Retain 20,000 local points and at most 192 supports per settlement. Ground patches
check cell centres for water and reject heavily fragmented remnants instead of
leaving isolated field/park triangles. Terrain/water generation itself is unchanged.

Bridge decks, piers and soil approaches reuse the existing spatial collision
index for both point and high-speed swept probes. Under-deck space remains open;
support placement is shared with rendering. Regional obstacle plans have separate
bounded ownership and do not inflate the building budget. The developer review
can inspect an actually loaded bridge rather than synthesizing a flattering
crossing. Ghost revision 19 keeps saved records and skips incompatible playback.

The [seed-73 terrain-contact view](reviews/settlement-contact-10.900.png) shows
previously buried village road sections joining visibly across the shelf.
Full real river-bridge artwork, near/far travel, gameplay frame-time percentiles,
startup comparison and sustained memory acceptance remain open under the review
browser's roughly one-frame-per-second throttling. No smoothness/performance win
is claimed. Weather acceptance remains a separate unfinished task.

The [actually streamed 652 m crossing](reviews/settlement-bridge-10.900.png) near
(-13688.9, -13034.1), seed 73, shows the deck, markings, rails, piers and both
bank approaches over receiving water with a connected channel behind it. This
is a real streamed link, not synthetic road geometry. It is one inspected still,
not complete maximum-speed/chase/first-person or every-crossing acceptance.
The final affected run passes 116 rendering, road, collision, draping, worker,
streaming, lifecycle and ghost checks; the 17 settlement placement/distribution
checks also pass. The production build passes with the existing bundle warning.

## Batch 4: city review correction (10.901)

The standard seed-1337 preview loaded all 1,196 buildings but exposed too many
independent highways meeting at one central point. The revision brings three
central districts and nearby neighbourhoods into a stronger urban core, uses
parent/secondary-loop connections for the outskirts, and replaces that central
junction with a small civic ring. Fewer branches in outer districts retain the
existing sub-128 road-proposal bound. City extent and population ranges remain.
Tests require substantial central frontage density with no road converging on
the exact origin, plus surviving outskirts and all district uses.

The old protected-landmark cones floated 120 m above the highest roof and were
260/520 m tall. They are now modest 18/45 m rooftop antennas at actual building
coordinates, using blue/orange rather than turquoise. Their indexed collision
matches the new rooftop placement. One shared low-poly draw per anchor remains;
radar identity and protected landmark generation are unchanged. Ghost revision
20 preserves records. Continuous chase/first-person travel, controlled startup/
frame-time comparison and sustained memory acceptance still remain open.

The [revised seed-1337 city](reviews/settlement-city-10.901.png) renders all 1,196
buildings with a stronger central skyline and linked outer neighbourhoods.
Clear is selected while the prior cloud banks fade; this is layout evidence,
not weather acceptance. No browser rendering errors are reported. The final
45 focused layout/scale/rendering/collision/draping/ghost checks and production
build pass, as do six targeted generated-terrain rarity, rough-anchor, scale,
skyline and foundation checks. Shared buffers use a dynamic update hint; worker
ground payloads are length-checked before traversing their numbers. No measured
frame-rate improvement is claimed.

## Batch 5: street joins and clearance (10.902)

Three new reproducing checks failed on 10.901: a furthest bridge point prevented
a valid regional link, reverse direct discovery produced a different road, and
a lot on a nearby ground street could overlap a dry viaduct. Rank only actual
ground-street points, deduplicate the eight-point shortlist and test five
positions across the full connector/shoulder width per candidate. No valid
attachment means no fabricated centre road. Canonical endpoint ordering now
applies even to direct/review callers, not just graph requests.

Elevated local segments reserve their footprint, including gravel/fill shoulders,
but never count as building frontage. Keep the same temporary street buckets,
graph density, four settlement/1,500 building/six link limits, four route bends,
20,000 local points and structure/support caps. Ghost revision 21 preserves data.

An on-demand developer pose inspects an actually loaded connector/street join.
Its close-up exposed a wedge at angled ribbon ends and a second geometry issue:
wide ground strips discarded the already-sampled centre height. Add dry-checked,
12-triangle junction aprons to existing asphalt meshes, not separate draw calls.
Each apron uses 13 attachment-time probes and is omitted if wet. Do not cap
gravel across the incoming lane: its differently triangulated surface can cover
asphalt between samples even when lower at the shared centre. Existing side
shoulders remain. Their initial centre heights now use the same .3 m offset as
their refitted surface, instead of retaining a .07 m centre bump.
Wide ground strips now include their centreline; thin markings and engineered
decks retain two-column sections. Road ribbons and apron fans use shared indexed
vertices, including welded ground centres across separate street strips. This
prevents duplicated triangle corners being refitted at different times and
tearing apart during streaming. Long wide strips now use about three physical
vertices per point rather than six per segment in 10.901; added indices retain
the centreline triangles. A crossing-street fixture draws 48 triangle indices
from 17 physical vertices and refits those 17 once. Point counts, draw calls and
the draper's 1,024-vertex/.8 ms sampling budget remain fixed. Steady vertex/probe
counts are reduced, but no controlled FPS/startup/heap improvement is claimed.

The junction review can report an on-demand barycentric height snapshot from
the actual local/connector/shoulder mesh triangles. It does not substitute plan
metadata for rendered contact or run these scans in the gameplay update loop.

The goal remains city/road improvement, not just these fixes. Further network
connectivity and rough/coastal-route review, consistent protected-anchor plans
across neighbour discovery, continuous chase/first-person travel and controlled
startup/frame-time/memory comparison remain required. The protected-anchor item
is an audit target from differing normal/forced plan ownership, not a verified
failure yet. Vegetation, removed warnings, blackout/redout, weather, terrain/water
generation and flight handling remain excluded from this batch.

The [settled seed-1337 junction](reviews/road-junction-10.902.png) for link
`-1,2|1,1` shows a continuous asphalt join without the overlapping gravel cap.
The actual mesh snapshot reports local/connector Y 1810.39 m and shoulder Y
1810.24 m. No browser rendering errors were reported. Recent rolling-frame HUD
times are visible in the image, but are not a controlled travel/performance run.

The final 77 focused road, join, clearance, rendering, lifecycle, budget, ghost
and draping checks pass, along with the production build (existing bundle-size
warning). All 17 generated settlement placement/distribution/anchor checks also
pass. A 24 km fixture uses 3,027 asphalt refit vertices versus the former 6,000
edge-only vertices, including both new aprons; 12,072 indices retain the richer
surface topology. This is a verified buffer/probe reduction, not an FPS claim.

Next audit stream-eviction ownership of instanced regional bridge supports and
ready-plan admission when a large city cannot fit but a nearby village can.
These are source-review targets, not asserted runtime failures until reproduced.
Keep the full city/road goal active rather than treating this checkpoint as the
end of the generation and sustained-performance review.

## Batch 6: admission and bridge ownership (10.903)

Four focused checks fail on 10.902: a city that cannot fit beside protected
anchors evicts an ordinary village before rejecting itself; that same blocked
city repeatedly wins ready selection over a village that would fit; a nearer
village prevents replacing a farther city because eviction tier is ranked
before eligibility; and regional bridge piers never dispose their instance
buffers when the road unloads.

Admission now previews the irreducible resident set (protected anchors and,
for ordinary candidates, equally close or nearer settlements). Reject before
evicting anything if that set and the new plan exceed either cap. Ready selection
skips blocked plans without discarding them, and the retained city can load when
capacity becomes available. Eviction filters eligibility before ranking tier
and distance. The preview scans at most four roots, uses squared distances,
allocates no arrays and performs no terrain sampling. It does not increase the
four-settlement/1,500-building/six-link budgets or change generated blueprints.
Ghost revision 21 and saved records remain unchanged.

Regional road removal now disposes bridge support instances, matching local
settlement ownership. Dynamic road geometry still leaves the draper and is
disposed; shared pier geometry/materials survive until system disposal.
The lifecycle check also verifies collision removal and no repeated instance
disposal after clear/reseed cleanup. This fixes a verified resource-release
omission, not a measured FPS or sustained-memory improvement.

All 68 affected admission, collision, junction, rendering, draping and regional
road checks pass, as does the production build (existing Three bundle warning).
The [seed-1337 city checkpoint](reviews/settlement-streaming-10.903.png) shows
1,196 buildings and four streamed regional links with no browser error logs.
This still verifies normal rendering, not a controlled travel/memory benchmark
or visual proof of the synthetic admission-pressure cases above.

Protected fallback-plan consistency across neighbour discovery remains an
unverified audit target. Network/terrain routing, rough/coastal junction views,
continuous gameplay-camera travel and controlled startup/frame-time/memory
comparison remain required. No terrain/water generation, weather, flight,
vegetation or removed warning/blackout work is included.

## Batch 7: protected landmark road plans (10.904)

The previously unverified audit target now has two failing regressions on
10.903. A forced fallback city has a different kind, location and street layout
from the ordinary plan for its cell. Priming the village before choosing the
city locks its neighbour graph to that obsolete ordinary plan. An ordinary
worker reply for an unloaded fallback cell can also restore the wrong site.

Select both protected blueprints before any protected graph discovery. Retain
at most two chosen plan references separately from loaded roots, use them for
source and neighbour discovery, and reuse them for worker completion and
synchronous retries. These are seed/pad-selected plans, not whatever happens
to fit the graphics budget. Clear ownership on world reset/disposal; do not
mutate the global generator or add loading-order-dependent cache overrides.
The neighbour ring stays at 24 lookups, and no new terrain probes or per-frame
graph discovery are added. Retaining two references does keep those blueprints
alive while their meshes are unloaded; no measured heap reduction is claimed.

Three focused checks cover the reproduced fallback graph/reply failures and
compare complete edge blueprints after reversed source discovery with blocked
versus successful mesh admission. Their pressure/fallback fixtures are synthetic,
not a broad real-world coast/rough-terrain acceptance run. Ghost revision 22
rejects old road playback without deleting records, settings or favourites.
All rendering/profile/support caps remain fixed. Terrain-aware routing, broader
visuals, sustained gameplay-camera travel and controlled performance/memory
comparison remain required before calling the city/road overhaul complete.

The 74 affected ownership, admission, road, collision, junction, rendering and
ghost checks pass, plus seven existing generated-terrain anchor/cache checks.
The production build passes with the existing bundle warning. The [settled
seed-1337 normal junction](reviews/road-junction-10.904.png) remains continuous:
the on-demand actual mesh snapshot reports local/connector Y 1810.39 m and
shoulder Y 1810.24 m. Browser error logs are empty. This normal-site visual
guards against regression; it does not visually prove the synthetic fallback
cases or constitute a controlled performance/memory benchmark.

## Batch 8: terrain-aware regional routing (10.905)

The old four broad arcs cannot follow a winding valley. A new S-valley check
fails on 10.904: the route stays on one side, climbs to 1,436 m on 120 m valley
terrain and reaches a 37.8% grade. The new corridor can change direction locally,
with slope, wetness, ridge/valley and turn costs. It is monotone along the
endpoint axis, not an unbounded map-wide search. Two rounding passes preserve
exact street joins; complete 24 m profiles validate the rounded geometry.

Fixed search bounds are 64 stations, 11 lanes and 3,000 sampler calls. A failed
profile can trigger at most four local searches with a shared 5,000-probe cap.
Two broad alternatives remain for constrained coasts; at most four full profiles
are attempted. Existing 8,192-point, 1.8 km wet-span, 96 m structure-height and
192-support limits stay in force. Worker planning does more work than before;
no startup, FPS or heap improvement is claimed.

The real seed-1 village exposed short steep gullies even along its best corridor.
Support them with soil fills below 8 m or explicit decks/piers above that,
capped at 1.2 km for any newly raised dry run. Do not globally lift a road across
valleys or change terrain. Engineering uses bounded profile scans with no new
terrain sampling; reject changed street joins, excessive clearance, long raised
runs and support overflow before mutating any points. Keep contiguous water
decks level. Regional profiles stay below a 24% centre grade ceiling. Existing
mesh, draper and collision consumers use the same structure metadata.

Focused checks cover winding valleys, broad lakes, reversed discovery,
unavoidable cliffs/seas, large-coordinate endpoints, mutable sampler reuse,
probe/rounding/refinement bounds, short dry structures, level wet decks and
atomic rejection of invalid engineering. Actual seed-1337 city and seed-1
village neighbours retain usable routes under the grade ceiling. Dry-viaduct
point/swept collision keeps airspace below the deck open and clears on unload.
A development-only control inspects actually streamed viaducts. Ghost revision
23 preserves records while rejecting incompatible road playback.

Settlement/building/link/profile/support/render-distance budgets are unchanged.
Broader network connectivity, rough/coastal views, maximum-speed chase and
unobstructed first-person travel, and controlled startup/frame-time/memory
comparison remain required. Terrain/water generation, weather, flight handling
and all paused exclusions stay outside this batch.

The 97 affected routing, generated-world, structure, collision, ownership,
admission, junction, rendering, ghost and draping checks pass, along with the
production build (existing Three bundle warning). The winding-valley route now
stays below 300 m rather than climbing to 1,436 m; that is synthetic geometry
evidence, not a gameplay benchmark. Two actual generated-neighbour fixtures
retain a usable link under the grade ceiling.

The [seed-1 streamed 45 m viaduct](reviews/road-viaduct-10.905.png) near
(-156411, -106248) shows an actual supported dry-bank transition. The adjacent
[134 m water bridge](reviews/road-bridge-10.905.png) has a level deck and joined
bank approaches; it is the same generated regional road, not a synthetic fixture.
Browser error logs are empty. These are inspected stills, not complete
maximum-speed/LOD-transition, coastal-network or performance/memory acceptance.

Next measure regional graph discovery on the main thread as well as worker
routing: neighbour lookups can still generate complete settlement plans, so
bounded counts alone do not prove smooth streaming. Also verify alternative
network connectivity when a candidate route is genuinely unbuildable, and
regional road/building clearance beyond the existing local-street reservations.

## Batch 9: off-thread graph discovery (10.906)

A reproducing callback check on 10.905 finds 24 synchronous neighbour-plan
generations when a settlement worker result arrives. Cold neighbour discovery
in the two existing generated-road fixtures takes 749.8 ms (seed 1337 city) and
392.6 ms (seed 1 village) in one Node test run. These are cold, JIT-sensitive
planning timings, not measured browser frames or a controlled gameplay baseline.
Nevertheless, running that work directly in the render-thread callback is a
verified source of potential long stalls, not just an unproven count concern.

Discovery now runs as a graph job in the existing worker. Roots, graph discovery
and road profiles fairly share its one in-flight slot; continued settlement
traffic cannot monopolize it ahead of roads. The graph queue is deduplicated by
nearby source cell, plus the two protected landmarks, and follows source release
and world reset. No second worker or extra background process is introduced.
Protected priming still builds its two immediate landmarks, but no longer scans
their neighbouring settlements synchronously. Healthy completion and priming
checks verify zero neighbour-generation calls and only two source-plan calls,
respectively. Unsupported/broken-worker recovery remains synchronous and may
still stall; it is deferred to dispatch rather than run in an error callback.

Send only the chosen protected cell/tier descriptors to graph jobs. Worker-side
discovery resolves those same forced sites, independently of mesh admission.
Resolve the existing bounded dry-street attachment shortlist there too. Replies
carry at most two canonical links with one ground attachment per endpoint;
neighbour buildings, parks and full street profiles are not cloned back into
road requests. Both real fixed-seed fixtures produce byte-for-byte identical
complete road profiles from full versus compact endpoints; their compact link
JSON is below 2 KB. This changes scheduling/payload ownership, not geography or
road obstacle geometry. Ghost generation revision 23 and saved records remain.

Validate payload shape, link degree/key ordering, source location/tier and
protected ownership. Tests cover one-slot fairness, departed-source cleanup,
old-world replies retaining a new slot, oversized/full-profile/wrong-source
payloads and deferred fallback recovery. Worker checks cover forced source and
neighbour plans and empty cells. Existing terrain distance, settlement/building/
link counts, route/profile/structure/support caps remain unchanged.

Total worker planning is not eliminated, and the single cold measurements do
not establish an FPS, startup or sustained-memory improvement. Alternative
network connectivity, regional road/building clearance, broader rough/coastal
travel and controlled gameplay/startup/frame-time/heap acceptance remain open.
No terrain/water generation, weather, flight or paused-system work is included.

The [actual worker-streamed seed-1337 junction](reviews/road-stream-worker-10.906.png)
for `0,0|1,1` retains joined asphalt and matching street/connector surface Y
680.32 m (shoulder 680.17 m) in the on-demand mesh snapshot. The review has 1,196
city buildings and a streamed regional link, with empty browser error logs.
This verifies the real graph/profile message path and a visible join, not broad
network connectivity or a controlled performance/travel benchmark.

All 111 affected graph, worker, routing, geometry, ownership, admission,
collision, rendering, ghost and draping checks pass. The production build and
release metadata checks pass with the existing Three bundle-size warning.

## Batch 10: regional building clearance (10.907)

Local roads reserve building lots before population; regional connectors were
planned later without any building footprints. A flat-ground reproducer places
a rotated building on a formerly accepted connector near its street endpoint.
The old compact-endpoint route intersects it. The full-plan route now finds a
clear alternative without changing the building or endpoint, and reversed
discovery produces the same profile.

Road jobs recover full blueprints inside the existing worker. Resolve endpoint
ownership by ID, tier, position and radius, and reject stale compact endpoints.
Discover intermediate settlements in a bounded route envelope, independent of
loaded roots and instance admission. The envelope includes the 6.5 km coarse
corridor, seeded guide, both broad alternatives, 600 m local refinement and the
maximum 10 km settlement radius/service-pad extension. At most 49 corridor cells
are queried; endpoint/protected resolution is additional. Always include the
two selected protected landmarks, which can relocate outside their nominal
cells. Existing worker plan-cache ownership and caps are unchanged. Unsupported
worker fallback uses the same resolver and may still stall the main thread.

A temporary 512 m spatial index holds rotated building footprints and actual
25 x 17 m fuel-station canopies. Inflate each by the full shoulder half-width
plus 2 m setback. Segment/rectangle tests catch intersections between samples,
not just road-centre probes. Traverse crossed bins rather than a long diagonal's
whole bounding rectangle, with a 1,024-bin per-query ceiling. No index survives
the job, no new persistent cache or worker is added, and no building payload is
cloned through compact road messages. This adds worker CPU/memory, not a claimed
gameplay speedup. Raised roads conservatively avoid the same footprints; tunnels
and roads over buildings are not introduced.

Use clearance during corridor search and check complete rounded/refined/fallback
paths. If corner rounding clips a footprint, retain the clear unrounded corridor
before profiling. Engineering cannot waive clearance. Reject a blocked street
attachment or impossible path rather than delete buildings or return a partial
road. Keep the existing full-profile, grade, support, graphics and render-distance
limits. Ghost generation revision 24 rejects incompatible old playback while
preserving saved records, favourites and settings.

Focused checks cover rotated/negative-grid/zero-length/reversed/distant segments,
shoulder setback, canopies, near-endpoint rerouting, intermediate and relocated
protected obstacles, bounded/deduplicated lookup, stale ownership and blocked
joins. Both real generated-route fixtures retain usable links and have complete
segment clearance against every resolved corridor plan. Full/compact requests
with the same resolver produce identical profiles. Worker tests verify recovery
of protected full blueprints and rejection without the correct descriptor.

The [seed-1337 rendered junction](reviews/road-clearance-10.907.png) retains all
1,196 city buildings and its usable regional link. Street/connector Y remains
680.32 m, shoulder 680.17 m; the rotated inspection shows clear building spacing
and joined road geometry. Browser error logs are empty. This view is not proof
of every regional route or sustained gameplay performance. All 119 affected
checks and the production build pass, with the existing Three bundle warning.

Alternative connectivity when chosen links fail, wider rough/coastal travel and
controlled gameplay/startup/frame-time/memory acceptance remain required. Weather
acceptance is separate unfinished work. Terrain/water generation, flight handling,
EST/per-level work and all paused systems are unchanged.

## Batch 11: buildable alternative neighbours (10.908)

The graph formerly committed to its nearest ranked proposals before a road
profile was attempted. An impassable preferred hub could therefore consume the
village's only outgoing slot despite another reachable settlement. The flat
sea-barrier regression reproduces this without bypassing bridge rejection.

Select from the same seeded 24-neighbour discovery ring and range gates, retaining
cross-tier preference, distance and stable ID ties. Check at most four ranked
candidates per source, including missing attachments and rejected profiles. Stop
when a village has one successful spoke or a city has two. Each accepted route
still satisfies terrain routing, dry street attachment, building/shoulder
clearance, complete-profile grade and bridge/viaduct limits. Failed roads do not
become bridges across impossible seas, and no collision checks are waived.

Graph selection runs in the existing worker and returns only compact endpoints.
The unsupported-worker path uses the same selection and remains potentially
expensive. No load-order-driven retry state, extra worker or render-thread
planning is introduced. Both endpoints may still discover the same canonical
edge; existing source ownership deduplicates it independently of mesh admission.
The one-slot root/graph/profile dispatch remains fair, though a graph job can now
spend time profiling up to four candidates. A four-attempt cap deliberately does
not guarantee global connectivity or connect every island.

Reuse worker profiles between graph acceptance and road delivery in a small LRU.
Cap it at eight entries, including failed attempts, and 8,192 total retained
profile points. Evict before retaining a profile that exceeds the combined point
budget; oversized entries are not cached. Key exact compact endpoint ownership
and attachment data, not just an edge ID. Reset for seed, airfield position/yaw,
generation and protected descriptors, normalized independently of descriptor
order. Root jobs preserve same-world cached roads but invalidate old-world work.
An evicted profile may be rebuilt; cache contents never change route selection.
This trades bounded worker memory for reduced duplicate planning, not a measured
startup/FPS/memory improvement. All graphics, profile and support caps remain.

Actual seed 73, village `-3,-2`, previously selected `-3,-2|-4,-2`. Its first three
ranked profiles fail; the fourth, `-2,-2|-3,-2`, succeeds. Neither endpoint's old
proposal selected that edge. Pin this generated case, its exact failure sequence,
complete grade validity, ground joins, compact payload and cached handoff in a
regression. The existing seed-1337 city and seed-1 village retain their usable
links. Candidate order/rejection/attempt limits, missing streets, service/ground
clearance, compact worker handoff, protected ownership, cache size/point/context
eviction and error recovery have focused coverage. Ghost revision 25 rejects
incompatible playback while preserving records, favourites and settings.

The developer terrain review now has **Alternative road connection**, a fixed
seed-73 fixture with no airfield deformation. The [streamed replacement junction](reviews/road-connectivity-10.908.png)
is visible at `-64192.9, -32769.2`; local and
regional surface Y both read 578.77 m, shoulder 578.62 m. Two settlements/77
buildings and one regional road are resident, with clear building spacing and
empty browser error logs. This verifies an actual new graph edge through the
worker, profile cache and renderer, not the entire network or travel performance.

All 129 affected checks and the production build pass with the existing Three
bundle-size warning. The final worker-context change also passes its eight
focused worker/cache checks and a new build; the real fixture passes again with
the old-opposite-endpoint assertion. Wider rough/coastal network artwork,
continuous low-altitude/high-speed gameplay and controlled startup/frame-time/
memory acceptance remain open. Weather acceptance remains separate unfinished
work. Terrain/water generation, flight, EST/per-level and paused exclusions are
unchanged.

## Batch 12: city-corridor workload evidence (10.909)

Extend the existing development-only recorder with repeatable city corridors and
actual current/peak settlement, building, road and queue counts. Preserve the
original route, pause/hidden handling, real frame hitches, fixed resource/frame
caps and actual camera reporting. Opt-in terrain following has focused tests,
not completed low-altitude visual acceptance. Production gameplay is unchanged.

Complete historical 10.897 and current 10.908 81.6 km city-corridor runs with
identical instrumentation. The current run exercises up to 1,247 buildings,
including 1,196 in the reviewed city, and retires those roots later in travel.
However, its adaptive pixel ratio ranges from .85 to 1 while the baseline stays
at 1. Mark the pair inconclusive for controlled performance rather than claim
an FPS/startup/memory win. Preserve both raw records, endpoint stills and all
limitations in [the diagnostic comparison](terrain-streaming-performance.md#chunk-10909-settlement-workload-diagnostics-comparison-inconclusive).

The two-minute route does not prove sustained-memory stability, worker-heap
usage, near/far road contact or complete artwork. Six recorder checks and the
production build pass. The user requested pausing after this checkpoint; do not
claim the full road/settlement overhaul accepted. Resume with matching-resolution
repeated measurements and actual low-altitude chase/first-person travel when
requested. Terrain/water, weather, flight handling, ghost revision 25, saved
records, budgets and paused-system exclusions remain unchanged.

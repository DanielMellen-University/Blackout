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

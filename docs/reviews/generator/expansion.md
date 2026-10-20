# Two further approved themes, Oct 20

Exactly four themes are approved: Desert run, Mountain valley run, Coastal island run and Volcanic run. Every further theme needs separate approval. Step 3 remains started. Current missions remain functional and await their later overhaul.

All use the existing flight r32 and the same bounded record store. Profile identity separates the two original themes even where their revision numbers match.

| Theme | Catalog ID | Terrain/route profile | Landscape | Route |
| --- | --- | --- | ---: | ---: |
| Desert run | desert-run | generated-desert | 30 | 33 |
| Mountain valley run | mountain-valley-run | generated-valley | 30 | 33 |
| Coastal island run | coastal-island-run | generated-coastal | 31 | 34 |
| Volcanic run | generated-volcanic-run | generated-volcanic | 32 | 35 |

## Coastal island run, 10.975

A serializable seeded profile drives three bounded islands in the existing Landforms, Geography, Coastline, Hydrology and terrain-worker pipeline. The shared signed coast shapes sandy shelves and sea cliffs, clips the existing sea water and identifies water contact. Ocean-only terrain skips inland drainage. The generated runway is on the home island; five gates follow its coast and cross the channels before the aligned landing leg. The ordinary medal system, captured sortie, history and ghost storage are reused with profile generated-coastal, flight r32, landscape l31 and route q34. Desert and valley retain their l30/q33 records.

The existing village planner receives coastal site/radius parameters for small towns on dry coastal shelves. Cities are suppressed in this recipe. Settlement and anchor caches retain theme isolation through a same-seed switch and return. No settlement redesign, extra world, record store, mesh geology, props or budget changes are introduced.

Focused tests cover all six review seeds, serialized determinism, low wing corridors, replay identity, existing records, real sea/beach/cliff samples, populated coastal villages, same-seed settlement cache isolation, shared LOD samples and sea geometry. The 95 focused checks and the production build pass; the strengthened three-theme cliff/shoulder LOD repeat also passes. Seeds 42, 73 and 808 use the existing controls-only pilot through gate one with paired Playwright chase/cockpit stills under coastal/. Completion and full-cadence measurements follow in 10.977. Physics b20, nitro b21, collision and water rendering remain unchanged. Vegetation, warning strip and blackout/redout effects remain excluded.

## Volcanic run, 10.976

Three seeded giant cones flank a low circuit across dark lava fields. Broad summit bowls form calderas in the shared scalar landform field. The existing volcanic palette supplies charcoal basalt, cooled flows and warm fissures; the existing atmosphere receives an ash horizon tone. There are no lava entities, new effects, world pipelines or budgets. The same serializable profile reaches terrain and settlement workers. The new catalog ID is generated-volcanic-run, labeled Volcanic run (generated), preserving the old volcanic-run mission and seed-8 record unchanged. Five gates and a generated runway landing use the existing medals and bounded record manifest with generated-volcanic, r32/l32/q35, separate from all other themes.

Focused checks cover all six seeds, complete specs, serialized profiles, wide clear gate corridors, cone/rim/caldera dimensions and biome weights, replay and existing record identities, same-seed settlement cache switches and return, pooled summit LOD geometry and the existing missions/physics/nitro/paused exclusions. All 108 focused checks and the production build pass. Paired controls-only Playwright chase/cockpit stills on 42, 73 and 808 are retained under volcanic/. Complete flights, original-theme regression flights and full-cadence measurements follow in 10.977.

## Completion review, 10.977

Part C flies Coastal island run and Volcanic run on 1337, 2026 and 9001, then re-flies Desert run and Mountain valley run on 42. The original Volcanic run catalog entry remains on seed 8 with its existing profile and records. The review build uses the existing controls-only pilot with production fixed-step physics, collisions, streaming, scoring, medals and gate refills. It never writes aircraft pose, velocity, orientation, gate state, simulation time or results. Ordinary dist remains free of the injected pilot.

All eight flights pass with gold, five accepted gates, five actual reserve increases and runway-footprint contact. All 32 completion stills are inspected. No further production bug is reproduced in Part C. Mean FPS spans 34.3 to 41.9, p95 spans 33.4 to 50.0 ms, and sampled main-thread heap peaks span 68.5 to 126.9 MB. Each run retains one interval above 100 ms; worst intervals span 333.3 to 450.0 ms.

See [the full-cadence results](expansion-completion-results.md) and [strict machine summary](expansion-completion-summary.json). Each receipt retains an immutable source/pilot manifest, paired gate chase/cockpit views, low-approach cockpit view and terminal result. Review build identities include all runtime source hashes plus the pilot hash, preventing a later theme build from replacing an earlier build manifest. Timings include camera switches and still capture, and preserve every measured spike. No stutter-free or performance improvement claim is made. Heap figures represent sampled main-thread JS heap only.

The complete local suite passes 172 files / 1,708 checks at two workers, including 108 focused generator, geometry, cache, record, original-mission, physics, nitro, paused-system and version checks. The production build passes. FlightModel, flightConfig, NitroSystem, Collision, WaterSystem, TerrainSystem and RenderQuality are unchanged from 10.974. No budgets or flight tuning change. Step 3 remains STARTED with four delivered approved themes. Further themes and existing-mission overhauls require separate approval. Vegetation, flight warnings and blackout/redout effects remain excluded; city/roads redesign remains closed.

To reproduce: build with `node scripts/build-generator-review.mjs`, serve `/tmp/blackout-generator-production` on 5176, then run `node scripts/review-theme-expansion.mjs` sequentially without a competing local test suite. `node scripts/summarize-theme-expansion.mjs` requires all eight complete flights, exact source and record identities, real refill gains, all five gates, a runway footprint landing, a medal, all stills and resident coverage. The original 10.974 report remains historical evidence for the initial two themes.

# Two further approved themes, Oct 20

Exactly four themes are approved: Desert run, Mountain valley run, Coastal island run and Volcanic run. Every further theme needs separate approval. Step 3 remains started. Current missions remain functional and await their later overhaul.

## Coastal island run, 10.975

A serializable seeded profile drives three bounded islands in the existing Landforms, Geography, Coastline, Hydrology and terrain-worker pipeline. The shared signed coast shapes sandy shelves and sea cliffs, clips the existing sea water and identifies water contact. Ocean-only terrain skips inland drainage. The generated runway is on the home island; five gates follow its coast and cross the channels before the aligned landing leg. The ordinary medal system, captured sortie, history and ghost storage are reused with profile generated-coastal, flight r32, landscape l31 and route q34. Desert and valley retain their l30/q33 records.

The existing village planner receives coastal site/radius parameters for small towns on dry coastal shelves. Cities are suppressed in this recipe. Settlement and anchor caches retain theme isolation through a same-seed switch and return. No settlement redesign, extra world, record store, mesh geology, props or budget changes are introduced.

Focused tests cover all six review seeds, serialized determinism, low wing corridors, replay identity, existing records, real sea/beach/cliff samples, populated coastal villages, same-seed settlement cache isolation, shared LOD samples and sea geometry. The 95 focused checks and the production build pass; the strengthened three-theme cliff/shoulder LOD repeat also passes. Seeds 42, 73 and 808 use the existing controls-only pilot through gate one with paired Playwright chase/cockpit stills under coastal/. Completion and full-cadence measurements follow in 10.977. Physics b20, nitro b21, collision and water rendering remain unchanged. Vegetation, warning strip and blackout/redout effects remain excluded.

## Volcanic run, 10.976

Three seeded giant cones flank a low circuit across dark lava fields. Broad summit bowls form calderas in the shared scalar landform field. The existing volcanic palette supplies charcoal basalt, cooled flows and warm fissures; the existing atmosphere receives an ash horizon tone. There are no lava entities, new effects, world pipelines or budgets. The same serializable profile reaches terrain and settlement workers. The new catalog ID is generated-volcanic-run, labeled Volcanic run (generated), preserving the old volcanic-run mission and seed-8 record unchanged. Five gates and a generated runway landing use the existing medals and bounded record manifest with generated-volcanic, r32/l32/q35, separate from all other themes.

Focused checks cover all six seeds, complete specs, serialized profiles, wide clear gate corridors, cone/rim/caldera dimensions and biome weights, replay and existing record identities, same-seed settlement cache switches and return, pooled summit LOD geometry and the existing missions/physics/nitro/paused exclusions. All 108 focused checks and the production build pass. Paired controls-only Playwright chase/cockpit stills on 42, 73 and 808 are retained under volcanic/. Complete flights, original-theme regression flights and full-cadence measurements follow in 10.977.

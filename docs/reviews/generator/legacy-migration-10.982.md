# Legacy mission generator adapter, 10.982

Approved Oct 20 scope: migrate the existing catalog onto the existing generator. No additional theme, mission type, system, mode, feature or roadmap item is approved. The themes remain exactly Desert run, Mountain valley run, Coastal island run and Volcanic run. Any further theme or feature needs separate approval. Step 3 remains STARTED.

The file matches the supplied list exactly: 72 fixed entries, comprising 28 authored and 44 contract catalog missions, plus three rotating entries. Random world, Free flight and the four generator entries are outside this adapter. Part A adds the specification and tests only; catalog launches remain unchanged.

Every non-rotating migrated launch will choose a per-flight random seed through the existing world seed path. Explicit seed replay uses the existing seed field, copy/link controls and captured sortie. The seed is shown and retained with the existing bounded record and ghost family, with a mission suffix to prevent cross-mission collisions. Retries retain the captured world. Daily, weekly and monthly retain their existing shared UTC period seed, profile choice, contract seed, period pin and replay link. They do not use a random launch seed. Proof uses explicit seeds 42, 1337 and 9001, separate from recipe tuning seeds 73, 808 and 2026; rotating proof uses period seeds rather than overriding the shared challenge.

Mission id, label, detail, original gameplay profile, objectives, contract selection, scoring focus and medal rules remain separate from terrain selection. Fixed missions retain their original contract-selection seed and modifier. Modifier snapshots come from the original fixed-seed natural spawn and the existing routeModifierForSpawn function. Weather, weatherShift, timeOfDay and windSide are copied without reinterpretation as themes. Weather approach resolves its existing seed-dependent weather against its identity seed before choosing a flight seed. Rotating modifiers continue to use the existing period profile and its original natural spawn. Generated route/landscape revisions each add 100 to their existing recipe revision, while FlightRevision remains r32. The four theme records retain their current revisions. Existing bounded storage is extended, with no parallel record system.

The generator supplies randomized geometry and an aligned final. The mission keeps its existing challenge classification, precision gate radius, scoring focus and medal evaluator. Existing terrain clearance and approach validation still apply. Special contract events continue through the existing evaluator. No physics, nitro tuning, collision, water, streaming budget or presentation tuning is part of this change.

| Mission | Group | Existing gameplay profile | Terrain recipe | Reason |
| --- | --- | --- | --- | --- |
| training-orbit | Authored | orbit | Desert run | Flat low circuit and sensible runway approach. |
| contour-circuit | Authored | contour | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| weather-approach | Authored | weather | Mountain valley run | Clear valley runway approach; weather and wind remain mission settings. |
| range-sweep | Authored | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| precision-slalom | Authored | slalom | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| ridge-run | Authored | ridge | Mountain valley run | Wide valley with high mountain shoulders. |
| canyon-run | Authored | canyon | Mountain valley run | Low valley line between mountain walls. |
| coastal-run | Authored | coast | Coastal island run | Existing shoreline and open-water channels. |
| fjord-run | Authored | fjord | Coastal island run | Coastal channels and enclosing island shoulders. |
| river-run | Authored | river | Coastal island run | Low water-side line using existing coastal channels. |
| volcanic-run | Authored | volcanic | Volcanic run | Existing cone and caldera relief. |
| volcanic-ops | Contract | volcanic | Volcanic run | Existing cone and caldera relief. |
| rift-ops | Contract | canyon | Mountain valley run | Low valley line between mountain walls. |
| desert-dash | Authored | desert | Desert run | Existing dry basin recipe. |
| alpine-pass | Authored | alpine | Mountain valley run | High mountain surroundings and clear valley floor. |
| storm-run | Authored | storm | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| night-ops | Authored | night | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| aurora-run | Contract | night | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| timberline-run | Authored | timber | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| glacier-run | Authored | glacier | Mountain valley run | Mountain relief; snow remains governed by the existing climate and mission weather. |
| frostline-ops | Contract | glacier | Mountain valley run | Mountain relief; snow remains governed by the existing climate and mission weather. |
| rainforest-run | Authored | rainforest | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| mesa-run | Authored | mesa | Desert run | Existing dry plateau relief. |
| badlands-run | Authored | badlands | Desert run | Existing dry washes and broken plateau relief. |
| saltflat-run | Authored | saltflat | Desert run | Wide low dry corridor. |
| savanna-run | Authored | savanna | Desert run | Low open dry flying corridor. |
| tundra-run | Authored | tundra | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| tundra-ops | Contract | tundra | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| swamp-run | Authored | swamp | Coastal island run | Low wet coastline with water available. |
| monsoon-run | Contract | monsoon | Coastal island run | Wet coastal line; rain remains a mission setting. |
| archipelago-run | Authored | archipelago | Coastal island run | Existing island channels and water. |
| thermal-run | Authored | thermal | Mountain valley run | Wide valley floor with existing seeded thermal pockets. |
| pattern-approach | Authored | approach | Desert run | Flat final and runway with room to establish the landing line. |
| crosswind-approach | Authored | approach | Desert run | Flat final and runway with room to establish the landing line. |
| traffic-run | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| waterway-tour | Contract | river | Unchanged | Two waterway types cannot be supplied by the existing generated recipes. Inland hydrology is disabled and the coastal recipe supplies ocean only. A new terrain capability is outside approval. |
| thermal-surf | Contract | thermal | Mountain valley run | Wide valley floor with existing seeded thermal pockets. |
| high-dive | Contract | alpine | Mountain valley run | High mountain surroundings and clear valley floor. |
| water-skim | Contract | coast | Coastal island run | Existing shoreline and open-water channels. |
| ridge-trial | Contract | ridge | Mountain valley run | Wide valley with high mountain shoulders. |
| traffic-dodge | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| precision-landing | Contract | approach | Desert run | Flat final and runway with room to establish the landing line. |
| combo-run | Contract | slalom | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| night-flight | Contract | night | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| radar-run | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| precision-chain | Contract | slalom | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| butter-landing | Contract | approach | Desert run | Flat final and runway with room to establish the landing line. |
| dry-run | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| gust-rider | Contract | storm | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| range-run | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| settlement-tour | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| airshow-run | Contract | slalom | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| biome-tour | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| scout-run | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| skyline-run | Contract | alpine | Mountain valley run | High mountain surroundings and clear valley floor. |
| speed-run | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| terrain-hugger | Contract | canyon | Mountain valley run | Low valley line between mountain walls. |
| fuel-saver | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| energy-run | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| storm-contract | Contract | storm | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| crosswind-run | Contract | approach | Desert run | Flat final and runway with room to establish the landing line. |
| mach-run | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| burn-run | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| g-control-run | Contract | slalom | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| deadstick-run | Contract | desert | Desert run | Existing dry basin recipe. |
| clean-circuit-run | Contract | desert | Desert run | Existing dry basin recipe. |
| level-flight-run | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| water-run | Contract | river | Coastal island run | Low water-side line using existing coastal channels. |
| brake-check-run | Contract | sweep | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| thermal-control-run | Contract | alpine | Mountain valley run | High mountain surroundings and clear valley floor. |
| front-chaser-run | Contract | storm | Mountain valley run | Existing neutral valley corridor supports the mission purpose; climate, weather and time remain existing settings. |
| shoreline-run | Contract | coast | Coastal island run | Existing shoreline and open-water channels. |
| daily-ops | Rotating | Existing daily profile pool | Resolve pool profile through the table | Keep the shared UTC day seed, weather and contract. |
| weekly-ops | Rotating | Existing weekly profile pool | Resolve pool profile through the table | Keep the shared ISO week seed, weather and contract. |
| monthly-ops | Rotating | Existing monthly profile pool | Resolve pool profile through the table | Keep the shared UTC month seed, weather and contract. |

One mission is deliberately left unchanged: waterway-tour. It remains available on its original seed and terrain. All other picks reuse an existing recipe without creating a theme or biome recipe. Terrain identity is a mapping, not a promise to add new biomes for legacy names. The existing Mountain valley recipe retains the ordinary climate biome mix; its high shoulders and low corridor also cover neutral purposes. Biome-tour requires verification that its existing four-biome objective remains reachable. Thermal objectives require existing pocket coverage verification. If either fails without new capabilities, it must join the exception list.

Verification and delivery receipts follow in the later parts. Part A verification is recorded below after execution.

Part A passes 97 focused adapter/generator checks and the production build. The production-mode review build loads Desert run seed 42, takes off, clears gate one and receives the ordinary refill. Chase and cockpit stills in `migration-a/desert-run-42/` were inspected: terrain, route and rendering remain coherent. This regression flight does not activate a catalog migration. Source/hook hashes and raw receipt are retained with the flight.

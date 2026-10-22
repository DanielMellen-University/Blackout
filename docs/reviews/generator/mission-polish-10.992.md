# Migrated mission theme polish, 10.992

Approval: Oct 22 option B covers only gate, spawn and theme mismatch repairs to the 72 migrated missions, followed by proof and docs. Exactly five existing themes remain in use. Any further theme, mission, mission type, objective, feature, system, mode or roadmap item requires separate approval. No gameplay overhaul or new content is added.

Part A is shipped as bc55a07e with green CI. Its 216 headless takeoff, five-gate and runway-touchdown cases all pass.

## Findings and corrections

- River Run used the Coastal island recipe despite promising inland river country. Its existing `river` terrain mapping now selects the already shipped Waterway recipe. The existing water-flight contract override still selects Coastal island, while Waterway tour contracts still select Waterway. Only River Run changes among the 72 fixed mappings. Its existing record family automatically becomes `generated-waterway:r32:l136:q139:mission:river-run`; old records are retained, with no parallel record system.
- 39 descriptions promised missing biomes, old route shapes, midnight rather than the authored night clock, or objectives on the gate path that actually require exploration. These now describe the existing circuits and distinguish their unchanged bonus contracts.
- Ten names implied absent glaciers, forest, tundra, jungle, salt flats, savanna, wetlands or fjords. The names below are corrected on the same mission IDs. No terrain, assets or objectives were added to satisfy the stale copy.
- 70 route labels described the pre-migration gameplay profile rather than the actual landscape. Migrated route summaries, briefings and the existing HUD now use the generated theme label, while challenge, modifier, scoring and objective labels remain unchanged. The two volcanic labels were already correct.
- All fixed weather, weatherShift, timeOfDay and windSide settings match the Part A snapshot. No weather or clock repair was needed. Explicit night copy now says night rather than midnight, and aurora copy no longer promises an active band at every generated origin.

| Existing mission ID | Name before | Name after | Description after |
| --- | --- | --- | --- |
| precision-slalom | Precision slalom | Precision slalom | Small gates and demanding lines along a mountain valley circuit |
| ridge-run | Ridge run | Ridge run | Valley-floor circuit beneath high mountain shoulders |
| canyon-run | Canyon run | Canyon run | Low circuit along the wide mountain valley floor |
| fjord-run | Fjord run | Coastal channel run | Fog-lined island circuit over coastal channels |
| volcanic-run | Volcanic run | Volcanic run | Five-gate circuit between volcanic cones and dark lava fields |
| volcanic-ops | Volcanic ops | Volcanic ops | Storm-locked volcanic circuit with a live contract |
| rift-ops | Rift ops | Rift ops | Fog-bound mountain valley circuit with a live contract |
| alpine-pass | Alpine pass | Alpine pass | Valley-floor circuit beneath alpine mountain shoulders |
| storm-run | Storm run | Storm run | Low-visibility thunderstorm circuit through the mountain valley |
| night-ops | Night ops | Night ops | Low-level fog circuit under a repeatable night sky |
| aurora-run | Aurora run | Aurora run | Clear night circuit with green and violet aurora where sky conditions allow |
| timberline-run | Timberline run | Valley floor run | Mountain valley circuit beneath rocky and snow-capped shoulders |
| glacier-run | Glacier run | Snow valley run | Snowy circuit along the mountain valley floor |
| frostline-ops | Frostline ops | Snow valley ops | Snowy mountain valley circuit with a live contract |
| rainforest-run | Rainforest run | Rainy valley run | Rainy circuit along the mountain valley floor |
| mesa-run | Mesa run | Mesa run | Desert circuit between dunes and eroded mesa shelves |
| badlands-run | Badlands run | Badlands run | Desert circuit past eroded shelves and dry washes |
| saltflat-run | Saltflat run | Desert basin run | Five-gate circuit over a dry desert basin |
| savanna-run | Savanna run | Desert sweep | Low circuit through desert dunes and dry washes |
| tundra-run | Tundra run | Snow valley circuit | Snowy low-level circuit beneath mountain shoulders |
| tundra-ops | Tundra ops | Snow valley contract | Snowy valley circuit with a live cold-weather contract |
| swamp-run | Swamp run | Coastal rain run | Rainy circuit across island channels and low coastal shores |
| monsoon-run | Monsoon run | Monsoon run | Rainy floodplain circuit crossing an inland river and lake |
| thermal-run | Thermal run | Thermal run | Sunlit circuit along the mountain valley floor |
| pattern-approach | Pattern approach | Pattern approach | Desert circuit and aligned final that grade the landing |
| high-dive | High dive | High dive | Clear valley circuit with an altitude-and-recovery-dive contract |
| precision-landing | Precision landing | Precision landing | Clear desert circuit with a centered-touchdown contract |
| combo-run | Combo run | Combo run | Clear valley circuit with precision gates and a gate-and-stunt combo contract |
| night-flight | Night flight | Night flight | Foggy night circuit with a sustained after-dark contract |
| precision-chain | Precision chain | Precision chain | Clear valley circuit with three consecutive perfect precision gates |
| butter-landing | Butter landing | Butter landing | Clear desert circuit with a smooth-touchdown contract |
| settlement-tour | Settlement tour | Settlement tour | Clear valley circuit with a city-and-village tour contract |
| airshow-run | Airshow run | Airshow run | Clear valley circuit with precision gates and a barrel-roll stunt contract |
| biome-tour | Biome tour | Biome tour | Clear valley circuit with a four-biome exploration contract |
| scout-run | Scout run | Scout run | Clear valley circuit with a multiple-settlement exploration contract |
| skyline-run | Skyline run | Skyline run | Clear valley circuit with a high-altitude contract |
| terrain-hugger | Terrain hugger | Terrain hugger | Clear valley circuit with a low-radio-altitude contract |
| g-control-run | G-control run | G-control run | Clear valley circuit with precision gates and a bounded high-G contract |
| water-run | Water run | Water run | Rainy coastal circuit with a sustained water-flight contract |

The recipe totals are 13 Desert, 47 Mountain valley, seven Coastal island, two Volcanic and three Waterway. Every mission retains its ID, gameplay profile, contract-selection seed, objective, medal rules and weather/time/wind settings. The other 71 generated specifications remain identical to Part A. Random world, Free flight and the five standalone theme entries remain unchanged. The shared river-profile selector naturally uses the existing Waterway theme for corresponding Ops profiles; period seeds and objective overrides remain unchanged.

## Verification

The deterministic theme tests cover every fixed mission on seeds 42, 1337 and 9001. They check actual route labels and briefings, fixed settings, contract copy, seed replay, the unchanged 71 specifications and real river/lake classifiers for River Run. The gate/spawn regression also rechecks all 216 cases. See [final geometry and catalog](mission-polish-b/geometry.json) and [focused tests](mission-polish-b/focused.txt). Production and isolated minified review builds pass.

Playwright checks River Run seed 42 and the renamed Rainy Valley Run (`rainforest-run`) seed 42 through takeoff and gate one, with completed-GPU-frame chase/cockpit stills. The River receipt predates only the Free flight label guard; the valley receipt uses the final Part B source. Both are retained, excluded from timing, and show the actual Waterway or Mountain valley HUD label. River Run has real inland water beneath its course; the rainy mission has bare valley terrain and rain rather than nonexistent jungle. All paired stills were inspected. See [River Run](mission-polish-b-browser/river-run-42/run.json) and [rainy valley](mission-polish-b-browser/rainforest-run-42/run.json).

Part C reruns the final fixed-mission proof and representative completion/performance flights. No known broken gates, bad spawns or theme mismatches remain in this tested seed envelope. This is not all-seed or long-duration certification. b20 physics, b21 nitro, 10.978 WebGL presentation, 10.989 frame-spike fixes, collision, water and budgets remain unchanged. Vegetation/props, blackout/redout veils and the entire warning strip remain removed. City/roads redesign stays closed at 10.942. Weapons, combat, multiplayer and parallel record systems remain non-goals.

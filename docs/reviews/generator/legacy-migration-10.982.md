# Legacy mission generator adapter, 10.982

Original Oct 20 scope migrated the catalog using four recipes. Oct 21 option B separately approves one Waterway theme and migration of the remaining Waterway tour missions and periods in 10.987. Themes are now exactly Desert run, Mountain valley run, Coastal island run, Volcanic run and Waterway. Any further theme, feature, mission type, objective, system, mode or roadmap item needs separate approval. Step 3 remains STARTED.

The file matches the supplied list exactly: 72 fixed entries, comprising 28 authored and 44 contract catalog missions, plus three rotating entries. Random world, Free flight and the five generator entries are outside this adapter. The original 10.982 Part A added the specification and tests only; the activation history and 10.987 completion are recorded below.

Every non-rotating migrated launch will choose a per-flight random seed through the existing world seed path. Explicit seed replay uses the existing seed field, copy/link controls and captured sortie. The seed is shown and retained with the existing bounded record and ghost family, with a mission suffix to prevent cross-mission collisions. Retries retain the captured world. Daily, weekly and monthly retain their existing shared UTC period seed, profile choice, contract seed, period pin and replay link. They do not use a random launch seed. Proof uses explicit seeds 42, 1337 and 9001, separate from recipe tuning seeds 73, 808 and 2026; rotating proof uses period seeds rather than overriding the shared challenge.

Mission id, label, detail, original gameplay profile, objectives, contract selection, scoring focus and medal rules remain separate from terrain selection. Fixed missions retain their original contract-selection seed and modifier. Modifier snapshots come from the original fixed-seed natural spawn and the existing routeModifierForSpawn function. Weather, weatherShift, timeOfDay and windSide are copied without reinterpretation as themes. Weather approach resolves its existing seed-dependent weather against its identity seed before choosing a flight seed. Rotating modifiers continue to use the existing period profile and its original natural spawn. Generated route/landscape revisions each add 100 to their existing recipe revision, while FlightRevision remains r32. The four original theme records retain their current revisions; the new Waterway theme uses its own revisions. Existing bounded storage is extended, with no parallel record system.

The generator supplies randomized geometry and an aligned final. The mission keeps its existing challenge classification, precision gate radius, scoring focus and medal evaluator. Existing terrain clearance and approach validation still apply. Special contract events continue through the existing evaluator. No physics, nitro tuning, collision, water, streaming budget or presentation tuning is part of this change.

| Mission | Group | Existing gameplay profile | Terrain recipe | Reason |
| --- | --- | --- | --- | --- |
| training-orbit | Authored | orbit | Desert run | Flat low circuit with a clear, aligned runway approach for gentle practice. |
| contour-circuit | Authored | contour | Mountain valley run | Existing low valley corridor supplies terrain-shaped gates and a clear final. |
| weather-approach | Authored | weather | Mountain valley run | Flat valley runway and clear inbound corridor; rain and runway-relative wind remain mission settings. |
| range-sweep | Authored | sweep | Mountain valley run | Wide valley floor gives the long circuit room for broad turns. |
| precision-slalom | Authored | slalom | Mountain valley run | Clear valley circuit accommodates the original narrow precision gates without terrain intrusion. |
| ridge-run | Authored | ridge | Mountain valley run | Existing high mountain shoulders frame the altitude-focused route while the low floor keeps departure sensible. |
| canyon-run | Authored | canyon | Mountain valley run | Existing low valley line runs between mountain walls and retains the precision challenge. |
| coastal-run | Authored | coast | Coastal island run | Existing shoreline and open-water channels fit the low coastal circuit. |
| fjord-run | Authored | fjord | Coastal island run | Existing coastal channels and enclosing island shoulders fit the fog-lined water route. |
| river-run | Authored | river | Coastal island run | Existing coastal water channels provide the low water-side line without inventing an inland recipe. |
| volcanic-run | Authored | volcanic | Volcanic run | Existing cones, calderas and low volcanic corridor provide the volcanic setting. |
| volcanic-ops | Contract | volcanic | Volcanic run | Existing volcanic relief fits the mission; its storm contract and weather remain unchanged. |
| rift-ops | Contract | canyon | Mountain valley run | Existing low mountain valley and high shoulders fit the canyon route and Skyline objective. |
| desert-dash | Authored | desert | Desert run | Existing dry basins and washes fit the fast low-level line. |
| alpine-pass | Authored | alpine | Mountain valley run | Existing mountain shoulders and clear valley floor support the altitude-focused run. |
| storm-run | Authored | storm | Mountain valley run | Clear low valley corridor supports precision flying in the retained storm setting. |
| night-ops | Authored | night | Mountain valley run | Clear neutral valley corridor supports the original night precision mission; night remains a time setting. |
| aurora-run | Contract | night | Mountain valley run | Existing open valley circuit supports the original Speed run objective and retained night setting. |
| timberline-run | Authored | timber | Mountain valley run | Existing green valley floor and mountain shoulders serve the long terrain route without vegetation or props. |
| glacier-run | Authored | glacier | Mountain valley run | Existing mountain relief and high-shoulder snow support the altitude route; snowfall remains mission weather. |
| frostline-ops | Contract | glacier | Mountain valley run | Existing mountain relief frames the fast circuit while original snow weather is retained. |
| rainforest-run | Authored | rainforest | Mountain valley run | Existing neutral green valley floor supports the low terrain route; no rainforest recipe or foliage is added. |
| mesa-run | Authored | mesa | Desert run | Existing dry plateaus and washes provide mesa relief. |
| badlands-run | Authored | badlands | Desert run | Existing broken dry plateau relief and washes fit the precision line. |
| saltflat-run | Authored | saltflat | Desert run | Existing wide low dry corridor suits the open-country run. |
| savanna-run | Authored | savanna | Desert run | Existing warm dry open corridor serves the route without adding a biome recipe or grass props. |
| tundra-run | Authored | tundra | Mountain valley run | Existing low valley corridor supports open-country flying with the retained snow setting. |
| tundra-ops | Contract | tundra | Mountain valley run | Existing open valley airspace supports the Airshow objective with retained snow weather. |
| swamp-run | Authored | swamp | Coastal island run | Existing low wet coastline supplies water for the low terrain line without adding a swamp recipe. |
| monsoon-run | Contract | monsoon | Waterway | Approved inland river and connected lake supply the two existing Waterway tour families. |
| archipelago-run | Authored | archipelago | Coastal island run | Existing island channels and sea crossings fit island hopping; fog remains mission weather. |
| thermal-run | Authored | thermal | Mountain valley run | Existing open valley floor leaves room for the unchanged seeded thermal field and altitude objective. |
| pattern-approach | Authored | approach | Desert run | Existing flat runway and aligned final provide a sensible base-to-final landing approach. |
| crosswind-approach | Authored | approach | Desert run | Existing flat runway and clear final support the original storm and runway-relative crosswind. |
| traffic-run | Contract | sweep | Mountain valley run | Existing wide valley corridor and ordinary seeded traffic support the three-contact objective. |
| waterway-tour | Contract | river | Waterway | Approved inland river and lake supply both existing objective families without changing the contract. |
| thermal-surf | Contract | thermal | Mountain valley run | Existing valley floor and unchanged seeded thermal pockets support the lift objective. |
| high-dive | Contract | alpine | Mountain valley run | Existing open valley provides climb and recovery space for the unchanged altitude thresholds. |
| water-skim | Contract | coast | Coastal island run | Existing sea channels provide real water surfaces for the unchanged 18-180 m skim objective. |
| ridge-trial | Contract | ridge | Mountain valley run | Existing mountain and hill shoulders provide the required ridge biomes and terrain-clearance opportunities. |
| traffic-dodge | Contract | sweep | Mountain valley run | Existing wide valley airspace and seeded traffic support separated contact passes. |
| precision-landing | Contract | approach | Desert run | Existing flat runway and aligned final support the unchanged centered-landing objective. |
| combo-run | Contract | slalom | Mountain valley run | Existing clear valley circuit leaves room for the original combo chain and narrow gates. |
| night-flight | Contract | night | Mountain valley run | Existing clear valley circuit supports the original night objective; time and fog remain settings. |
| radar-run | Contract | sweep | Mountain valley run | Existing valley recipe retains ordinary settlement landmarks for the radar selection and arrival objective. |
| precision-chain | Contract | slalom | Mountain valley run | Existing clear valley circuit supports the original narrow gates and three-perfect-gate chain. |
| butter-landing | Contract | approach | Desert run | Existing flat runway and aligned approach support the unchanged touchdown-quality threshold. |
| dry-run | Contract | sweep | Mountain valley run | Existing long clear valley legs support high-speed flight without afterburner. |
| gust-rider | Contract | storm | Mountain valley run | Existing clear valley corridor supports the retained storm and gust objective. |
| range-run | Contract | sweep | Mountain valley run | Existing open valley circuit and surrounding airspace support the unchanged distance objective. |
| settlement-tour | Contract | sweep | Mountain valley run | Existing valley recipe supplies ordinary city and village landmarks required by the objective. |
| airshow-run | Contract | slalom | Mountain valley run | Existing open valley airspace leaves room for the unchanged barrel-roll objective. |
| biome-tour | Contract | sweep | Mountain valley run | Existing valley recipe contains the four reachable biome classes needed by the objective; verified on all proof seeds. |
| scout-run | Contract | sweep | Mountain valley run | Existing valley recipe supplies the two ordinary settlement landmarks needed for scouting. |
| skyline-run | Contract | alpine | Mountain valley run | Existing open valley supports the climb objective against high mountain relief. |
| speed-run | Contract | sweep | Mountain valley run | Existing broad valley circuit and clear approach support the original pace objective. |
| terrain-hugger | Contract | canyon | Mountain valley run | Existing low valley floor provides a continuous low-clearance line between mountain shoulders. |
| fuel-saver | Contract | sweep | Mountain valley run | Existing clear valley circuit and flat return runway support steady fuel-conscious flying. |
| energy-run | Contract | sweep | Mountain valley run | Existing open valley legs support the original speed-band objective. |
| storm-contract | Contract | storm | Mountain valley run | Existing clear valley corridor supports the retained storm-flight objective. |
| crosswind-run | Contract | approach | Desert run | Existing flat runway and aligned approach support the unchanged storm crosswind objective. |
| mach-run | Contract | sweep | Mountain valley run | Existing long open valley legs provide space for the original high-speed objective. |
| burn-run | Contract | sweep | Mountain valley run | Existing open valley legs support the original boost objective and unchanged nitro tuning. |
| g-control-run | Contract | slalom | Mountain valley run | Existing clear valley circuit supports the unchanged load-factor objective and narrow gates. |
| deadstick-run | Contract | desert | Desert run | Existing flat dry runway and aligned final provide a sensible return for the unchanged deadstick objective. |
| clean-circuit-run | Contract | desert | Desert run | Existing dry circuit and clear runway support the original no-miss objective. |
| level-flight-run | Contract | sweep | Mountain valley run | Existing low valley floor and clear long legs support the original level-flight altitude band. |
| water-run | Contract | river | Coastal island run | Existing sea channels provide the real water surfaces required by the original water-flight objective. |
| brake-check-run | Contract | sweep | Mountain valley run | Existing open valley legs support the original high-speed airbrake objective. |
| thermal-control-run | Contract | alpine | Mountain valley run | Existing clear valley legs support the original heat-management objective at speed. |
| front-chaser-run | Contract | storm | Mountain valley run | Existing clear valley corridor supports the retained rain-to-storm weather-front objective. |
| shoreline-run | Contract | coast | Coastal island run | Existing shoreline and sea channels preserve the coastal route while the original boost objective and fog remain settings. |
| daily-ops | Rotating | Existing daily profile pool | Resolve pool profile and existing objective requirements through the table | Keep the shared UTC day seed, weather and contract; Waterway tour selects Waterway. |
| weekly-ops | Rotating | Existing weekly profile pool | Resolve pool profile and existing objective requirements through the table | Keep the shared ISO week seed, weather and contract; Waterway tour selects Waterway. |
| monthly-ops | Rotating | Existing monthly profile pool | Resolve pool profile and existing objective requirements through the table | Keep the shared UTC month seed, weather and contract; Waterway tour selects Waterway. |

The original 10.983 through 10.985 migration left monsoon-run, waterway-tour and rotating Waterway tour periods on their original worlds because four recipes could not supply two waterway types. That historical exception is removed in 10.987 under the separate Oct 21 Waterway approval. All 72 fixed catalog identities and all shared-period Ops entries now resolve through the generator. Nothing in the existing mission catalog remains as is on an original world. Random world and Free flight retain their ordinary natural pipeline and are outside this migration. Terrain identity remains a mapping, not approval for further biome recipes.

Verification and delivery receipts follow in the later parts. Part A verification is recorded below after execution.

Part A passes 97 focused adapter/generator checks and the production build. The production-mode review build loads Desert run seed 42, takes off, clears gate one and receives the ordinary refill. Chase and cockpit stills in `migration-a/desert-run-42/` were inspected: terrain, route and rendering remain coherent. This regression flight does not activate a catalog migration. Source/hook hashes and raw receipt are retained with the flight.

The Part B period audit reuses Coastal island for Water run and Water skim objectives, and Mountain valley for Biome tour, Settlement tour and Scout objectives. Ridge run objectives move from a Desert pool pick to Mountain valley. These overrides select existing terrain recipes only; period gameplay profiles, seeds, contracts, weather and scoring focus remain unchanged. Historically Waterway tour periods retained the original natural world. The 10.987 audit now maps all eight Waterway tour assignments in the same 1,500 daily periods to Waterway, verifies river and lake classification and every route leg, and preserves shared UTC seeds. Water run, Water skim, Biome tour, Settlement tour, Scout and Ridge run mappings remain unchanged.


## Waterway migration, 10.987

The two fixed entries keep their original id, label, detail, monsoon/river gameplay profiles, contract-selection seed 54, modifier altitude, altitude scoring focus, medal logic, rain weather and all optional weather/time/wind settings. Their ordinary generated launch seed is per-flight random and replayable; proof uses 42, 1337 and 9001, separate from tuning seeds 73, 808 and 2026. Route and landscape revisions use the existing adapter offset: Waterway l136/q139, FlightRevision r32, with the original mission suffix. Old r32 natural-world records and ghosts remain separate in the same bounded family.

Daily, Weekly and Monthly Waterway tour assignments all select Waterway after resolving their existing period profile and contract. Their shared period seed, period pin, detail, weather, objectives, modifier calculation and scoring remain unchanged. The first three actual assignments of each period family are selected by the proof runner without substituting flight seeds. Weekly and Monthly cases extend beyond the 1,500-day daily audit because their Waterway assignments are rare; the supported copied period links retain the exact original shared seeds. The selected dates and seeds are in [the job manifest](waterway-b-full/jobs.json).

The 512 focused checks pass across seven files, followed by all 2,194 Vitest tests in 177 files and the two frame-metrics checks. They include all fixed identities on three proof seeds, the 1,500-day contract mapping audit, new river/lake contract completion with the unchanged maximum award, replay separation, valid approaches and earned gold checks. See [focused checks](waterway-b-verification/focused.txt), [full suite](waterway-b-verification/full-suite.txt), [period audit](waterway-b-full/period-audit.json) and [production build](waterway-b-verification/production-build.txt).

All fifteen capture-free completion flights land with gold, five accepted gates, five ordinary nitro refills and the full 2,000-point Waterway tour contract award. They cover each fixed identity on 42, 1337 and 9001, plus three actual Daily, Weekly and Monthly Waterway periods each. The verifier independently resolves each period's original natural airfield and confirms its modifier and scoring focus. Runtime errors and sampled resident-coverage misses are zero. See [completion rows](waterway-b-full-results.md), [verified summary](waterway-b-full-summary.json) and [receipt audit](waterway-b-verification/full-receipt-audit.txt).

Accepted completion flights range from 36.9 to 46.4 FPS, with worst p95 50.0 ms, maximum interval 100.1 ms and sampled heap peak 154.5 MB. The one interval strictly above 100 ms is 100.1 ms, within the existing approximate 100 ms boundary. The first Waterway Tour seed-9001 flight instead records 116.7 ms and is retained as a failed timing observation in [the original receipt](waterway-b-observations/waterway-tour-9001-original/run.json). Its isolated repeat on identical source and pilot hashes again earns gold and full contract credit, with maximum 83.4 ms and no interval above 100 ms. Nearby heap samples suggest collection activity but do not establish a cause. No production fix or heap tuning is claimed. See [the observation note](waterway-b-observations/README.md).

All fifteen completed-frame visual smoke flights pass takeoff, the first two gates, ordinary refills, live Waterway tour completion, source/pilot hashes, resident coverage and per-picture GPU fences. All five contact sheets, covering thirty chase/cockpit gate stills, were inspected: terrain, inland shorelines, rain, night lighting, gates and instruments are coherent. See [visual rows](waterway-b-smoke-results.md), [verified summary](waterway-b-smoke-summary.json), [smoke audit](waterway-b-verification/smoke-receipt-audit.txt) and [contact sheets](waterway-b-smoke/). These are single-browser capture flights and are excluded from timing acceptance. No production bug is established by this review.

# Changelog

## v0.12.0 - 2026-09-22

### Ship

- Dampen storm buffet while landing gear is down, and cue BUFFET on the live weather HUD when the gated drive is meaningful.
- **10.439** Add Level Flight Run, a deterministic clear sweep that exposes the stable-altitude contract without adding scene or render-loop work.
- **10.438** Add Clean Circuit Run, a deterministic clear desert sweep that exposes the no-miss gate contract without adding scene or render-loop work.
- **10.437** Add Deadstick Run, a deterministic clear desert sweep that exposes the fuel-out glide contract without adding scene or render-loop work.
- **10.436** Add G-control Run, a deterministic clear slalom that exposes the bounded high-G handling contract without adding scene or render-loop work.
- **10.435** Add Burn Run, a deterministic clear sweep that exposes the sustained afterburner contract without adding scene or render-loop work.
- **10.434** Add Mach Run, a deterministic clear sweep that exposes the sustained supersonic contract without adding scene or render-loop work.
- **10.433** Add Crosswind Run, a deterministic storm-locked approach that exposes the runway-relative crosswind contract without adding scene or render-loop work.
- **10.432** Add Storm Contract, a deterministic storm route that exposes the bounded precipitation contract without adding scene or render-loop work.
- **10.431** Add Energy Run, a deterministic clear sweep that exposes the bounded efficient-cruise contract without adding scene or render-loop work.
- **10.430** Add Fuel Saver, a deterministic clear sweep that exposes the bounded reserve-fuel landing contract without adding scene or render-loop work.
- **10.429** Add Terrain Hugger, a deterministic clear canyon route that exposes the bounded radio-altitude contract without adding scene or render-loop work.
- **10.428** Add Speed Run, a deterministic clear high-speed sweep that exposes the bounded fast-landing contract without adding scene or render-loop work.
- **10.427** Add Skyline Run, a deterministic clear alpine climb that exposes the bounded high-altitude contract without adding scene or render-loop work.
- **10.426** Add Scout Run, a deterministic clear sweep that exposes the bounded multi-settlement discovery contract without adding scene or render-loop work.
- **10.425** Add Biome Tour, a deterministic clear sweep that exposes the bounded four-biome exploration contract without adding scene or render-loop work.
- **10.424** Add Airshow Run, a deterministic clear slalom that exposes the bounded barrel-roll stunt contract without adding scene or render-loop work.
- **10.423** Add Settlement Tour, a deterministic clear route that exposes the bounded city-and-village tour contract without adding scene or render-loop work.
- **10.422** Add Range Run, a deterministic clear long sweep that exposes the bounded sustained-distance contract without adding scene or render-loop work.
- **10.421** Add Gust Rider, a deterministic storm route that exposes the bounded strong-wind contract without adding scene or render-loop work.
- **10.420** Add Dry Run, a deterministic clear high-speed sweep that exposes the bounded no-afterburner energy contract without adding scene or render-loop work.
- **10.419** Add Butter Landing, a deterministic clear pattern course that exposes the bounded smooth-touchdown contract without adding scene or render-loop work.
- **10.418** Add Precision Chain, a deterministic clear slalom course that exposes the bounded three-gate quality contract without adding scene or render-loop work.
- **10.417** Add Radar Run, a deterministic clear open route that exposes the bounded locked-settlement radar contract without adding scene or render-loop work.
- **10.416** Add Night Flight, a deterministic foggy midnight route that exposes the bounded after-dark contract without adding scene or render-loop work.
- **10.415** Add Combo Run, a deterministic clear slalom course that exposes the bounded gate-and-stunt combo contract without adding scene or render-loop work.
- **10.414** Add Precision Landing, a deterministic clear base-to-final pattern that exposes the centered-touchdown contract without adding scene or render-loop work.
- **10.413** Add Traffic Dodge, a deterministic clear open sweep that exposes the bounded vertical-separation traffic contract without expanding the fixed traffic pool.
- **10.412** Add Ridge Trial, a deterministic clear high-relief low pass that exposes the bounded ridge-altitude contract without adding scene or render-loop work.
- **10.411** Add Water Skim, a deterministic clear coastal low-pass course that exposes the bounded water-skimming contract and existing wake feedback.
- **10.410** Add High Dive, a deterministic clear alpine course that exposes the high-altitude climb-and-recovery contract as a replayable commitment challenge.
- **10.409** Add Thermal Surf, a deterministic clear-sky lift course that exposes the existing sustained-thermal contract as a replayable altitude skill challenge.
- **10.408** Add Waterway Tour, a deterministic rainy river course that exposes the existing multi-waterway contract and makes river, lake, and sea exploration replayable.
- **10.407** Add one-shot partial progress cues for Traffic Watch and Traffic Dodge, making the curated traffic objective readable without repeating duplicate-contact or completion banners.
- **10.406** Add Traffic Run, a deterministic high-speed sweep that opts into the expanded contract catalog and turns pooled traffic contacts into a repeatable objective.
- **10.405** Keep the closest traffic alert visible in a cached HUD row after the transient warning fades, reusing the pooled traffic query with bounded text and no new scene work.
- **10.404** Add one-shot partial progress cues for settlement and waterway tour contracts, suppressing duplicate discoveries and final-completion noise.
- **10.403** Add one-shot worsening return-fuel warnings for tight and low runway-return reserves, reusing the bounded HUD estimate without adding simulation or render-loop allocations.
- **10.402** Add conservative HOME OK/TIGHT/LOW fuel-return guidance for runway returns and engine-out glides, with bounded estimates and no simulation or worker overhead.
- **10.401** Keep a bounded missed-gate counter visible in the live HUD and route-progress accessibility text until reset, so a transient miss banner does not erase route feedback.
- **10.400** Cache persistent route-risk copy across frames and remove array churn from its formatter, keeping slope guidance free of avoidable render-loop allocations.
- **10.399** Keep each route's steepest slope visible in the persistent live risk row after the launch briefing fades, with finite clamping and no render-loop allocations.
- **10.398** Surface the generated route briefing on launch and retry, with bounded wrapping so clearance, turn, slope, and climb guidance is actually readable before takeoff.
- **10.397** Add a cached steepest route-slope callout and include it in difficulty classification so preflight guidance exposes climb/descent pressure without per-frame work.
- **10.396** Preserve bounded gate-miss counts through the run result so route debriefs explain missed crossings without changing clean-flight presentation.
- **10.395** Carry collision failure reasons into the crash results card so actionable diagnoses survive after the live impact banner fades.
- **10.394** Surface finite collision failure labels such as SINK RATE, SLOPE, GEAR UP, and OBSTACLE in crash feedback while reusing the existing contact query and impact snapshot.
- **10.393** Preview authored crosswind side and CRAB correction in the course picker and post-run condition summary, keeping the landing challenge readable before and after flight.
- **10.392** Make bounded world-generation startup failures recoverable from the title screen with a Retry action, while keeping renderer/GPU failures correctly disabled.
- **10.391** Add a cached CRAB L/R return cue derived from runway-relative crosswind, making the landing correction explicit without adding scene or render-loop work.
- **10.390** Add Crosswind Approach, a storm-locked pattern course with a deterministic runway-relative wind side so the landing pressure is repeatable instead of seed luck.
- **10.389** Add Pattern Approach, a clear-weather base-to-final course that turns the existing landing scorer into a short repeatable challenge with a final gate aligned back toward the runway.
- **10.388** Align Thermal Run gates with the same deterministic lift pockets sampled by the flight model, extending the bounded thermal envelope above tall relief so the authored altitude route remains playable without scene or worker growth.
- **10.387** Add a cached accessible LIFT HUD row for active thermal pockets, keeping altitude-route feedback readable after the transient entry banner without adding scene work.
- **10.386** Lock Thermal Run to clear skies so its altitude route consistently exercises the existing lift system instead of inheriting random storm or night conditions.
- **10.385** Add a deterministic Thermal Run course with a repeatable spiral climb that gives the existing lift and altitude systems a dedicated replay route.
- **10.384** Surface the real afterburner lock reason, so fuel-out state is shared by engine warnings, HUD, and the live engine contract instead of being hard-coded as ready.
- **10.383** Gate route-trace visibility by live external flight, keeping cockpit, pause, results, and crash presentation uncluttered.
- **10.382** Add one bounded route-trace draw connecting authored gates, improving external-camera guidance without expanding the scene footprint per route.
- **10.381** Expand the preflight route briefing with minimum clearance, maximum turn, and planned climb envelope callouts.
- **10.380** Make un-authored sorties choose deterministic route families from the generated airfield biome while preserving explicit curated-course profiles.
- **10.379** Add a deterministic Badlands Run course with shelf-to-shelf red-rock navigation and a new replayable route profile.
- **10.378** Stabilize flight-warning transitions with immediate escalation and bounded release hysteresis, and clear the G-load veil whenever pause or results hides live telemetry.
- **10.377** Enable the existing high-G feedback path with hysteretic blackout/redout bands, smooth bounded veil ramps, and one-shot transition callouts while keeping malformed load values safe.
- **10.376** Reuse caller-owned climate and pad snapshots for rendered-surface probes and terrain/settlement worker dispatches, reducing streamed-flight garbage without changing contact or generation results.
- **10.375** Give Low quality a shorter regional-road draw radius, reducing distant connector, bridge, and marking work while preserving settlement silhouettes and destinations.
- **10.374** Make terrain and settlement streaming reuse the last valid focus when malformed coordinates arrive, preventing `NaN` or infinity from poisoning fade, visibility, and queue math.
- **10.373** Make world render-quality application idempotent, avoiding redundant terrain, atmosphere, traffic, and settlement budget writes when a preset is unchanged.
- **10.372** Recheck terrain LOD after a half-cell of movement, promoting and demoting existing tiles before a full stream-cell crossing while preserving bounded streaming work.
- **10.371** Tie settlement secondary-detail visibility to render quality, trimming Low draw distance while preserving landmark silhouettes, buildings, and radar destinations.
- **10.370** Prefer the finest overlapping terrain tile during LOD transitions, keeping contact queries on the new surface while old coarse coverage fades out.
- **10.369** Make rendered/contact sampling span-aware for coarse terrain tiles, so far LOD surfaces resolve the correct cell and height instead of falling back or compressing a multi-cell tile into one cell.
- **10.368** Give terrain attachment a quality-aware main-thread budget, reducing Low upload bursts while preserving bounded worker streaming and allowing High to catch up faster.
- **10.367** Route render-quality changes through one world-owned update path, removing duplicate traffic, atmosphere, vegetation, and shader-budget writes during preset switches.
- **10.366** Align the external camera far plane with the active terrain quality envelope, reducing Low frustum and depth work while preserving the full High-quality horizon.
- **10.365** Make `World` apply the complete Low/Balanced/High quality envelope during construction as well as live switches, keeping terrain, atmosphere, vegetation, traffic, and shader budgets consistent for direct runtime use.
- **10.364** Add quality-aware terrain weather shading so Low skips moving cloud-shadow and wind-exposure detail while preserving biome color, elevation shading, and streamed geometry.
- **10.363** Add quality-aware water shading so Low reduces high-frequency foam, flow, and ripple work through a shared live uniform while preserving water levels and broad surface color.
- **10.362** Add the deterministic Archipelago Run course, a foggy island-hop route that expands water-focused replay content without changing bounded terrain or traffic budgets.
- **10.361** Make Low render quality trim secondary settlement lights, waterfront props, and road markings while preserving buildings, roads, and landmarks; apply the budget live when quality changes.
- **10.360** Add a read-only GitHub Actions gate for release metadata, TypeScript, the full test suite, and the production build on pushes and pull requests.
- **10.359** Harden version validation so the internal roadmap chunk stays synchronized across runtime metadata, the README, and the changelog.
- Keep terrain quality changes under the device's hardware worker cap, so switching to High on a small-core machine cannot create an unsafe six-worker burst.
- Add the curated Swamp Run course, a deterministic rainy low-level weave through wetlands and winding channels while reusing terrain-aware clearance, scoring, and retry systems.
- Make terrain worker concurrency follow the active Low/Balanced/High preset, retiring busy workers only after their current job completes so quality changes reduce CPU pressure without dropping streamed terrain results.
- Add the curated Tundra Run course, a deterministic low-level snow route over frozen lakes and rolling ground while reusing terrain-aware clearance, scoring, and retry systems.
- Add the curated Savanna Run course, a deterministic low-level sweep across open grassland and acacia terrain while reusing terrain-aware clearance, scoring, and retry systems.
- Expand swept airfield collision queries by a bounded aircraft envelope so wings, nose, and tail cannot clip hangars, towers, or shacks, while camera occlusion continues to use the authored building edges.
- Add the curated Saltflat Run course, a deterministic long high-speed route that gives the salt-flat biome a distinct replayable challenge without expanding runtime budgets.
- Add the curated Mesa Run course, a deterministic wide tableland route that showcases red-rock shelves while reusing terrain-aware clearance, scoring, and retry systems.
- Reuse a caller-owned airfield pad snapshot during collision probes, removing a per-check allocation from endpoint and swept obstacle tests without changing the collision envelope.
- Add persisted boost, speed-brake, and landing-gear keyboard bindings with duplicate-safe repair, browser-key suppression, and live controls labels while leaving axis preferences and gamepad/touch input unchanged.
- Replace per-probe settlement obstacle bucket strings, callbacks, and yaw trig with cached numeric spatial columns and indexed building extents, keeping high-speed collision sweeps allocation-light without changing collision envelopes.
- Reuse a caller-owned climate record for settlement waterfront and bridge-pier probes, removing repeated biome-weight allocations during landmark attachment without changing dock or road geometry.
- Reuse a tiny bounded set of caller-owned climate records across settlement candidate, survey, road, and lot probes, removing repeated biome-weight allocations from landmark planning without changing deterministic placement.
- Add the deterministic Rainforest Run course, a low winding route with forced rain that gives humid lowland terrain its own repeatable challenge while reusing the bounded route, clearance, scoring, and retry systems.
- Route fallback collision sampling through caller-owned scalar land/water records, avoiding climate-object allocation while preserving resolved water levels and airfield grading.
- Make optional GLB hydration dispose a still-owned loaded subtree when normalization or replacement fails, preventing rejected external aircraft assets from leaking GPU resources.
- Add the deterministic Glacier Run course, a snowbound alpine pass with an altitude challenge and forced snow conditions that reuse the bounded route, clearance, scoring, and retry systems.
- Add a scalar hydrology-aware terrain surface probe for fallback contact and AGL queries, preserving water levels and airfield grading while avoiding per-query climate-object allocations.
- Add the deterministic Timberline Run course, a fast rolling forest-and-hills route that reuses the validated terrain-clearance and scored retry path without expanding runtime budgets.
- Reuse bounded caller-owned climate buffers while building terrain tiles, removing nested per-vertex geography allocations and reducing garbage-collection pressure during streamed terrain rebuilds without changing deterministic height, biome, or water output.
- Harden the pooled sonic-boom effect against late quality, reduced-motion, and reset callbacks, and detach its root during disposal.
- Make snow-field teardown idempotent and detach the pooled particle root, so late weather updates cannot write into disposed precipitation buffers.
- Make traffic teardown idempotent and detach its pooled scene root, so world resets and late stream callbacks cannot update or reuse disposed traffic resources.
- Split the large course/career modules into a cacheable application chunk, reducing the initial entry bundle without changing runtime behavior or adding per-frame work.
- Keep shared settlement geometry alive during streamed unloads, preventing an anchor beacon or instanced prop family from invalidating landmarks that remain visible after settlement churn.
- Preserve shared vegetation materials during streamed chunk teardown, preventing one retiring tile from disposing foliage shaders still used by visible neighboring tiles.
- Reuse shared opaque terrain and water materials after streamed tiles finish fading, rehydrating private fade materials only for transitions and retirement to reduce resident GPU state without changing terrain geometry or stream budgets.
- Clear keyboard, gamepad, and touch state whenever the runtime leaves live flight, preventing held controls from leaking through pause, results, focus loss, or title transitions into the next sortie.
- Harden touch flight controls with per-button pointer capture and lost-capture cleanup, keeping multi-touch steering, throttle, and boost responsive without adding render-loop work.
- Add the curated Fjord Run course, a deterministic foggy coastal route that reuses the validated coast profile and existing weather/contract preview path without adding unbounded scene work.
- Sweep bounded aircraft motion segments against loaded obstacles, preventing high-speed passes from tunneling through airfield buildings or streamed settlements while keeping endpoint checks and the existing obstacle budget intact.
- Throttle protected settlement-anchor retries behind stream, budget, and movement changes, avoiding repeated plan rebuilds and queue filtering every render frame while keeping guaranteed city and village recovery responsive.
- Preview each seeded sortie contract and its bounded instruction in the course picker, making the repeat objective clear before launch without adding render-loop work.
- Add the curated Alpine Pass course, a deterministic high-altitude mountain route that also joins random profile rotation without adding scene systems or unbounded route work.
- Carry authored weather and night conditions into the results and crash debrief, keeping Storm Run and Night Ops context readable after the route ends without adding runtime or storage work.
- Show the human course name on results and crash debriefs instead of the internal seed/profile storage key, keeping authored retries readable without changing saved-score identity.
- Freeze authored Storm Run fronts and Night Ops midnight timing for the whole attempt, preventing long flights from drifting into a different challenge while random worlds retain their normal day/night and weather progression.
- Keep authored Storm Run and Night Ops weather deterministic by blocking manual weather cycling for those courses while leaving random worlds dynamic.
- Surface authored course conditions in the launch picker, including forced weather and night timing, and include that context in accessible course names.
- Add the curated Night Ops course: a deterministic low-level fog route with an authored midnight sky, replay-safe weather/time overrides, and precision gates.
- Add the curated Storm Run course: a deterministic low-visibility thunderstorm route with forced weather, crosswind zigzags, and replay-safe seed/profile identity.
- Release held touch flight actions immediately when the window blurs or the tab becomes hidden, preventing latched throttle, boost, or steering after focus changes.
- Add a persisted Minimal HUD toggle that keeps the compact cockpit default while allowing pilots to reveal or hide optional telemetry without changing flight-critical cues.
- Add the curated Desert Dash course: a deterministic, long low-level route across dry basins, included in random profile rotation with terrain-aware clearance checks.
- Add persisted Engine, Environment, and Effects audio mix sliders beside the master volume, reusing the existing Web Audio branches without adding nodes or per-frame graph work.
- Add persisted Subtle/Standard/Wide speed-framing levels for external chase and orbit cameras, scaling only high-speed pullback, FOV, and look lead.
- Add a persisted Camera Effects toggle that disables shake, boost sway, storm buffet, and external banking while retaining normal zoom, FOV, and camera controls.
- Add a persisted external-camera auto-return toggle so pilots can keep a hand-positioned chase or orbit view instead of easing back after idle.
- Add a persisted Low/Normal/High external camera look setting for middle-mouse panning, with finite-safe bounds and no cockpit or render-loop overhead.
- Include the volcanic route in random profile selection so ordinary sorties can discover its high-altitude spiral without selecting the curated course.
- Add the curated Volcanic Run course: a deterministic terrain-aware spiral climb with a distinct altitude challenge and a reusable seed for repeatable practice.
- Make the Low graphics preset stream a smaller terrain envelope and move its fog edge with the stream, reducing worker and geometry pressure while Balanced and High retain the full horizon.
- Add opt-in debug performance telemetry for render CPU time, draw calls, triangles, and terrain stream pressure so future optimization work is evidence-led without adding release-frame overhead.
- Replace legacy self-mutating ship workflows with read-only GitHub Actions CI that runs the regression suite and production build on pushes and pull requests.
- Normalize optional aircraft GLBs to the documented +Z/+Y metre contract and preserve the 1.4 m gear-contact anchor instead of lifting imported meshes to local Y=0.
- Route the analytic sky through Three's tone-mapping and output-color chunks so the dome matches world exposure and color management.
- Add a bounded night-weather exposure assist for rain, snow, and cloud cover so storm terrain remains readable without washing out clear nights or daytime.
- Add restrained one-shot radar lock and lock-loss chirps beside the existing target banners, reusing the pooled event path without adding audio nodes or per-frame work.
- Fade high-frequency water foam, riffle, and flow detail before the fog edge, and bias the independent surface forward to suppress distant shimmer and shoreline speckle without changing water levels or adding geometry.
- Pull the protected village and city anchor bands closer to the airfield so settlements are discoverable through the existing radar before crossing a full stream cell, without changing organic rarity or the city clearance budget.
- Add a restrained two-pulse traffic proximity cue to the existing rate-limited HUD alert, improving cockpit awareness without changing the pooled audio graph.
- Feed the existing bounded gust telemetry into the pooled wind bed, keeping storm ambience responsive without adding audio nodes or render work.
- Add a subtle first-person cloud mist to the existing canopy veil, reusing one DOM layer with bounded opacity and no new scene or render work.
- Make world reseeding recover the previous streamed terrain, settlements, weather, and mission when replacement fails after the live scene has been cleared.
- Centralize the afterburner throttle gate so fuel burn and resolved engine output cannot disagree at malformed or boundary throttle values.
- Gently muffle the existing wind, precipitation, and high-frequency engine bed inside clouds using bounded AudioParam targets, with no new audio nodes or render work.
- Add smoothed cloud-edge, entry, and break cues so visibility changes are readable without per-frame HUD churn or extra scene work.
- Buffet the camera and airframe through meaningful rain, snow, or strong gusts using existing weather telemetry, with no new meshes, particles, or draws.
- Quiet that storm buffet under reduced-motion preferences and on pause, title, and results; keep Low graphics cheaper, and let cockpit read it a touch harder than chase.
- Lock precip and gust thresholds with focused unit tests so the gating math stays honest.

- Open the stick throws and dump the boards so chase cam reads mil-turn authority and B-held brake.
- Retune wingtip vapor for mil-cruise turns: quiet in straight flight, readable when the jet is pulling.
- Bleed mil cruise faster with the speed brake while keeping final approach flyable.
- Light the VSI during the FLARE cue so the last sink window is obvious on the HUD.
- Overhaul the procedural F-35 with a refined continuous fuselage, teardrop gold canopy, external cockpit detail, deep intakes, separate rudders, and restrained skin seams; batch static trim while preserving animated gear, nozzle, lights, and control surfaces.
- Give instanced clouds soft optical edges, shaded undersides, sunlit rims, full-size opacity fades, and gradual visibility loss inside formations. Graphics budgets now reduce puff counts without cutting sphere geometry.
- Replace aircraft-locked rain sprites with pooled wind-driven world-space streaks. Fade rain, snow, haze, and overhead cloud cover above their source decks, and darken the distant cloud layer at night.

- Raise military cruise and throttle response, and leave the cockpit as a clear view with no canopy frame or instruments.
- Remove blackout, redout, engine heat, and the afterburner lock, and stop the center-screen callouts.
- Keep a guaranteed city off the airfield so its footprint does not cover the runway.

## v0.11.0 - 2026-09-20

### Ship

- Establish a single v0.11.0 release identity across package metadata, runtime title UI, and build validation while keeping roadmap chunks internal.
- Add a deterministic STORM RUN contract that rewards bounded airborne time in meaningful rain or snow without adding scene work.
- Add a compact six-marker radar scope with bounded contact projection and distinct gate, settlement, and traffic colors while preserving the accessible text readout.
- Add signed traffic altitude separation to the pooled radar path, giving proximity alerts and markers bounded `ABOVE`, `BELOW`, and `LEVEL` cues without collision simulation.
- Add a pooled reduced-motion-safe supersonic shockwave ring to the existing Mach-crossing cue without per-crossing scene allocations.
- Add a deterministic `TRAFFIC WATCH` contract for three distinct nearby traffic passes, reusing pooled proximity identities without collision simulation or fixed-step growth.
- Add one pooled instanced contrail batch behind distant traffic, disabled on Low and capped by the existing quality preset.
- Add one pooled three-strip water wake for airborne low passes over rendered water, reusing existing telemetry without particle growth.
- Upload the pooled water-wake instance transforms during setup so the first visible skim frame is reliable.
- Add a fixed pooled external airflow-streak batch that scales with airspeed and afterburner, with Low, cockpit, and reduced-motion gates that avoid scene growth.
- Add fixed pooled anti-collision beacons to distant traffic, with deterministic blinking and Low-quality suppression inside the existing six-jet budget.
- Add one pooled external Mach-cone silhouette above the supersonic threshold, with Low, cockpit, ground, and reduced-motion gates that avoid scene growth.
- Add one pooled three-strip ground wake for fast airborne land passes, reusing cached clearance and water classification without particle growth.
- Add a deterministic `TRAFFIC DODGE` contract for three distinct traffic passes with at least 120 m of vertical separation, reusing fixed alert identity storage without scene growth.
- Make the pooled ground wake weather-aware, shifting its shared material between clear, rain, and snow tints without rebuilding geometry or adding particles.
- Make the pooled water wake weather-aware, shifting its shared foam material across clear, rain, and snow fronts without rebuilding geometry or adding particles.
- Add sparse deterministic thermal pockets with a capped airborne updraft impulse, daylight and precipitation damping, and one-shot entry feedback without scene growth.
- Add a deterministic `THERMAL SURF` contract that rewards ten seconds inside bounded updraft pockets through the existing fixed-step task path without adding scene or storage state.
- Validate generated mission corridors with adaptive terrain probes so straight legs stay above the route clearance target between gates without adding runtime scene work.
- Add a deterministic PRECISION APPROACH contract that rewards a centered, aligned touchdown through existing finite-safe landing telemetry.
- Share one finite-safe heading fallback across the HUD, return guidance, and chase camera so near-vertical aerobatics do not flip navigation by 180 degrees.
- Stop external camera framing before loaded settlement and airfield colliders, using the existing bounded occlusion probes without adding render-loop allocations.
- Add a persisted keyboard yaw direction preference with safe storage repair while leaving gamepad and touch controls unchanged.
- Add a bounded best-run ghost path for repeatable courses, using fixed buffers and one local-storage write only when a sortie sets a new best.
- Enable strict nullability and unchecked-index checking in the production TypeScript build, fixing the hydrology flow accumulation boundary.
- Add the repeatable Coastal Run course, a lower sweeping route that reuses the validated terrain corridor planner.
- Add a cached GHOST pace row that compares live external runs with the saved best trace without adding simulation or storage work.
- Add a persisted keyboard roll direction preference while leaving gamepad and touch roll conventions unchanged.
- Add a persisted keyboard pitch direction preference while leaving gamepad and touch pitch conventions unchanged.
- Harden release validation across package metadata, the lockfile, runtime title fallback, README, and the first changelog heading so version drift fails the build.
- Add a deterministic WATER RUN contract that rewards bounded airborne time over the rendered river, lake, or sea surface without adding terrain queries or scene work.
- Add a wide, horizon-stable ORBIT camera mode to the existing C cycle, preserving the last external framing when returning from cockpit view.
- Add a deterministic BRAKE CHECK contract that rewards bounded high-speed speed-brake use without adding scene work or unbounded state.
- Add a deterministic THERMAL CONTROL contract that rewards bounded cool-engine cruise time without changing the flight model or adding scene work.
- Harden persisted gate split traces with a small size cap and monotonic finite validation so malformed local records cannot distort pace guidance or grow memory use.
- Synchronize the runtime roadmap pointer with the internal playbook so stale or malformed chunk IDs fail the version check before release.
- Keep workerless terrain streaming responsive by reducing only far fog-hidden fallback meshes while preserving full near-field and worker-backed detail.
- Add a bounded gear-down FLARE cue for the final landing window, making sink-rate timing readable without scene growth or new audio nodes.
- Add a bounded GO AROUND cue for unstable low approaches, preserving predictive terrain-closure priority and the existing audio budget.
- Add a deterministic CROSSWIND contract that rewards bounded airborne time through meaningful runway-relative wind without adding scene work.
- Add a deterministic G CONTROL contract that rewards bounded high-speed flight inside the existing smoothed load envelope without changing physics.
- Add a deterministic DEADSTICK contract that requires airborne fuel exhaustion before the scored landing, reusing existing glide guidance.
- Add the curated RIVER RUN course with a low meandering route through inland water country while preserving fixed gates and adaptive clearance checks.
- Add a deterministic FRONT CHASER contract that rewards bounded airborne time during an existing weather transition without adding scene work.
- Keep radar focused on the best bounded contact set by tier and distance, preventing streamed settlement order from hiding nearby targets.
- Reuse caller-owned scalar hydrology storage during geography sampling, removing one temporary object per terrain vertex without changing water or biome output.
- Add a deterministic BURN RUN contract that rewards bounded high-speed airborne afterburner time through existing engine-state telemetry without adding scene work.
- Reuse caller-owned scalar landform storage during geography sampling, removing another temporary object per terrain vertex without changing terrain output.
- Reuse the volcanic landmark scratch record during landform sampling, removing another terrain hot-path allocation while preserving deterministic cone and caldera relief.
- Share the identical summit FBM evaluation between uplift signals, reducing terrain CPU work without changing generated heights or biome transitions.
- Keep the active contract instruction visible in a bounded TASK detail line with matching accessible text, so objectives remain readable after launch feedback fades.
- Add a deterministic MACH RUN contract that rewards bounded airborne time above Mach 1 through existing speed telemetry without adding scene work.
- Add a deterministic CLEAN CIRCUIT contract with explicit permanent miss failure in the live HUD and results while leaving the sortie recoverable.
- Guard zero-gate sorties from receiving the gate-only CLEAN CIRCUIT contract, preventing impossible Free flight tasks without changing contract rotation elsewhere.
- Arm the existing contract-completion cue when a CLEAN CIRCUIT clears its final gate, while keeping missed circuits permanently failed and silent on success.
- Add a deterministic LEVEL FLIGHT contract that rewards a bounded, stable altitude hold through scalar telemetry only, with no scene growth.
- Add a one-shot CLEAN CIRCUIT failure cue through the existing warning and banner path, keeping missed sorties recoverable without adding scene resources.
- Add a deterministic SETTLEMENT TOUR contract that requires one city and one village arrival through existing radar destinations, with two bounded flags and no scene growth.
- Make TERRAIN HUGGER use the already-cached rendered radio altitude, so low-pass progress follows ridges and valleys without adding terrain queries or allocations.
- Keep SETTLEMENT TOUR's two destination tiers visible as cached OPEN or OK status in the TASK row and results without per-frame string work.
- Add a deterministic COMBO RUN contract that rewards building a three-link gate-and-stunt chain through existing combo telemetry without adding scene state.
- Keep COMBO RUN's current chain milestone in the cached TASK detail, updating only on combo events instead of allocating strings every frame.
- Add a deterministic PRECISION CHAIN contract that turns the existing high-quality gate streak into a three-clear objective with recoverable resets and no scene growth.
- Add a deterministic NIGHT FLIGHT contract that rewards a bounded airborne stretch through the existing dusk and night envelope without adding scene work.
- Persist a bounded per-course contract streak so consecutive bonus-contract clears create a replay target without adding render-loop or scene state.
- Keep the current contract chain visible in a cached HUD row, with a bounded accessible label and no render-loop storage work.
- Add a capped contract-chain score payout on top of the normal contract reward, keeping the first clear unchanged and making repeat mastery matter.
- Mark active weather-front blending as SHIFT in the cached weather readout, with an accessible front-shifting label and no scene or audio work.
- Include the existing terrain-validated COASTAL and RIVER route profiles in random sortie rotation, adding variety without new scene geometry or draw calls.
- Keep the active route profile name in the bounded live mission row, making newly randomized coastal and river lines readable after briefing banners fade.
- Double terrain streaming radius from 16.8 km to 33.6 km with larger outer tiles and bounded far-water detail.
- Generate terrain and water geometry in background workers, transfer mesh buffers without copying, and prioritize nearby chunks with bounded render-thread uploads.
- Fade new chunks in over 650 ms and retain old terrain through detail transitions.
- Add a fixed-seed terrain loading and maximum-speed flight benchmark, plus worker lifecycle and streaming regressions.

## 2026-09-18

### Ship

- Add arcade high-G vision feedback from the existing pilot load scalar: a dark tunnel vignette on hard positive G, a restrained red wash on strong negative G, hysteretic BLACKOUT / REDOUT banners, and no new scene work.

## 2026-09-16

### Ship

- Replace the stuffed native world dropdown with a two-column card picker, keeping course names short and moving mastery stats onto the selected world.
- Invert A/D yaw so A yaws right and D yaws left, matching the live flight stick instead of the previous left/right convention.
- Add a capped Night Ops landing bonus that rewards clean dusk and night touchdowns from the shared atmosphere daylight envelope, shown as NIGHT on the results card.

## 2026-09-12

### Ship

- Make optional aircraft GLB hydration cancellation-safe with request tokens and an owned dispose path, preventing late assets from mutating a torn-down runtime.
- Keep final external camera effects above terrain clearance so touchdown shake and afterburner sway cannot clip the lens through ridges.
- Strengthen the existing cool F-35 panel fill at dusk and night so the aircraft remains readable without extra lights, meshes, or draw calls.
- Coalesce external chase heading extraction and yaw-quaternion setup so camera framing avoids duplicate orientation math each frame.
- Add a cached amber/red airspeed redline cue with accessible overspeed text, keeping the HUD honest when the jet passes its displayed 3000-knot envelope.
- Add an `OVERSPEED` caution once the jet leaves the dry airspeed envelope, sharing the HUD's accessible warning and one-shot cue.
- Drive aircraft beacon, nav-light, and exhaust animation from the shared RAF timestamp with a deterministic fallback, removing per-step wall-clock work.
- Advance chase-camera auto-return from rendered delta time, removing its per-frame wall-clock read while keeping paused framing frozen.
- Drive mission gate pulses and pass flashes from the shared RAF timestamp, removing their per-frame wall-clock reads while preserving route feedback.
- Add a view-aware flight mix that muffles wind, precipitation, and turbine whine in cockpit view while retaining engine presence without new audio nodes.
- Give the existing overspeed caution a distinct soft descending cue so it does not sound like stall or terrain warnings.
- Add a restrained afterburner release cue so boost input has clear on and off feedback without adding persistent audio nodes.
- Coalesce mission navigation bearings by reusing aircraft-relative data in cockpit view and avoiding an external camera matrix refresh.
- Mutate the cached windsock weather state in place so smooth wind fronts do not clone a replacement record every frame.
- Reset world weather-effect caching during reseed so a matching profile still reapplies wet, snow, wind, and settlement lighting to fresh streamed content.
- Share the main RAF timestamp with HUD gear-transition cues so timing remains deterministic without a redundant wall-clock read.
- Replace per-flake snow sine and cosine evaluation with a shared periodic sway table, preserving storm motion while lowering CPU work at the full precipitation budget.
- Coalesce unchanged runway windsock and PAPI poses while invalidating on runway rotation, keeping weather and approach cues responsive without repeated transform math.
- Cache runway windsock nodes after their first weather update, preserving downwind animation while removing repeated scene-tree searches from the world tick.
- Preserve the last camera pose on frozen title, pause, and results frames so external ground-occlusion probes are not repeated while no visual time elapses.
- Avoid redundant rich terrain surface queries during clearly airborne collision checks and stop collision plus aircraft visual work once a crash is latched.
- Skip pooled crash and landing-particle simulation when the frame delta is frozen or invalid, preventing paused effects from consuming CPU or sampling terrain.
- End the pooled crash effect as soon as its particles expire and the readable flash envelope is complete, avoiding empty-tail terrain queries.
- Throttle the directional shadow map to a bounded 20 Hz cadence, forcing immediate refreshes after quality or WebGL context changes while keeping Low shadow-free.
- Gate detailed aircraft contact sweeps behind conservative previous, midpoint, and current terrain clearances so high-altitude flight avoids unnecessary height queries while near-ground contact remains unchanged.
- Make multisample antialiasing quality-aware at renderer creation so Low avoids the extra GPU cost while Balanced and High retain the sharper path.
- Harden fixed-step timing against malformed or backwards animation timestamps so one bad browser frame cannot poison simulation interpolation or the FPS estimate.
- Reduce pooled crash VFX terrain queries to one shared impact-point sample per update, preserving the fixed particle burst while trimming crash-time CPU work.
- Couple PAPI emissive intensity to the shared daylight envelope so approach cues stay restrained by day and readable at night without extra lights or geometry.
- Make the procedural F-35's existing nozzle petals flex with engine power and afterburner through a bounded, cached response without adding geometry or draw calls.
- Freeze static runway and airfield mesh matrices after construction while preserving parent reseed transforms and animated windsock fabric, trimming render-loop CPU work without new draws.
- Limit gamepad polling to a responsive 30 Hz live-flight budget, skip it on title and pause screens, and clear stale controller state on blur or teardown.
- Add semantic altitude, vertical-speed, and airspeed meters plus cached polite/urgent HUD announcements so live telemetry remains accessible without extra per-frame DOM churn.
- Drive the runway PAPI from the aircraft's runway-local glide angle, with cached four-lens material updates and a neutral pattern outside the approach corridor.
- Drive the runway windsock from resolved weather wind direction and strength in runway-local space, with cached updates and no new draw calls.
- Add deadbanded climb and sink colors to the signed vertical-speed HUD readout, improving landing readability without extra scene work or DOM churn.
- Let the optional GLB aircraft replacement hydrate after the playable runtime is ready, so a missing or slow model request cannot block the title screen or first flight.
- Replace per-streak rain sine evaluation with pooled sway values, preserving wind and storm drift while reducing heavy-weather CPU work.
- Drive the existing F-35 nose gear from runway yaw input, smoothly recenter it in the air, and reset it between flights for clearer takeoff and rollout feedback.
- Code-split the optional GLB aircraft loader from the initial bundle, preserving the procedural F-35 fallback while reducing startup payload and keeping replacement teardown intact.
- Add a responsive flight HUD frame for narrow and short browser windows, separating compact instrument groups and wrapping banners while preserving the desktop presentation.
- Stage streamed settlements out of the title hero, preserving their generated cache while keeping the runway and aircraft readable and restoring the layer on flight start.
- Compact expired landing dust and smoke with swap-pop removal, eliminating per-frame array shifts while preserving the fixed pooled touchdown effect.
- Route loaded-tile contact checks through one caller-owned height and land/water record, removing rich surface allocations from collision sweeps while retaining the metadata fallback.
- Make chase-camera ground occlusion distance-aware, trimming redundant close-rig terrain probes while preserving full sampling on long sightlines.
- Hide zero-count vegetation batches under reduced graphics presets, preserving authored matrices for instant restoration and removing empty renderer submissions.
- Split visible mesh height queries from richer contact metadata so camera, AGL, collision-clearance, and landing-effect hot paths avoid redundant climate sampling.
- Scale near-field instanced vegetation with the graphics presets, preserving authored batch counts so quality changes remain reversible without rebuilding terrain.
- Reuse swept-contact results in the flight model so high-speed collision probes avoid per-sample object allocation while preserving the existing crash and landing envelope.
- Keep dark airframe panels readable at night with a bounded cool emissive fill that fades out in daylight without adding lights, meshes, or draw calls.
- Scale instanced cloud draw ranges with graphics quality and skip hidden cloud simulation work on reduced budgets, keeping Low atmospheric performance predictable while High stays unchanged.
- Add a pooled fighter-style heading tape with cardinal marks and a centered caret, driven by cached heading telemetry without new scene geometry or draw calls.
- Give existing flight banners distinct info, success, and danger treatments so normal feedback no longer reads like a crash alert.
- Tie pooled rain and snow simulation plus draw ranges to the Low, Balanced, and High graphics presets so weather costs match the selected budget.
- Compact expired pooled crash particles during the effect tail, reducing needless simulation checks while preserving deterministic visuals.
- Gate render submissions during WebGL context loss and announce recovery so browser GPU resets do not hammer a dead renderer.
- Announce `COCKPIT VIEW` or `EXTERNAL VIEW` when `C` toggles the camera, making view changes readable at speed.
- Add a cockpit velocity-vector marker projected from the aircraft's real motion, keeping slips and climbs readable without changing physics or render budgets.
- Restore the cockpit canopy rails, brow, and coaming in first-person rendering by placing the camera in the scene graph and removing it safely during teardown.
- Keep the takeoff brief on the title screen and announce `AIRFIELD READY · PRESS PLAY OR ENTER` when world setup finishes.
- Show a short click-to-reenter cue when fullscreen drops unexpectedly during active flight, while keeping intentional menu exits quiet.
- Show gate, time, and landing score contributions on the completion card so every run explains its total without changing scoring rules.
- Harden the completion results dialog with semantic labeling, a contained Tab loop, focus restoration on retry, and teardown-safe listener cleanup.
- Add a short takeoff briefing banner on Play, Retry, New World, and `R`, making the first action readable without changing the flight model.
- Pause active flight on window blur as well as tab hide, using the same guarded path and requiring an explicit resume after focus returns.
- Contain Tab navigation inside the active pause or settings panel and release the focus trap during runtime teardown.
- Improve menu keyboard flow with modal semantics, heading focus on subpages, and focus restoration after closing pause or settings.
- Route menu, results, and preference controls through one idempotent listener bag so runtime teardown removes every UI callback before a remount.
- Release graphics and audio preference listeners during runtime teardown so remounted scenes cannot mutate disposed renderer or audio state.
- Honor the browser's reduced-motion preference in camera shake, touchdown impulse, and afterburner sway, including live preference changes.
- Add a restrained cockpit canopy frame and dashboard coaming to first-person view, with no external-camera draw cost and explicit teardown.
- Add Low, Balanced, and High graphics presets to the pause menu. Low disables shadow-map work and caps adaptive pixel density, while higher presets retain progressively larger budgets. The selected preset persists locally and can be changed without restarting the flight.
- Add a persistent audio-volume slider with smooth master automation, keeping the existing mute toggle and event cues intact.

## 2026-09-11

### Juice

- Add pooled landing scrub dust and tire smoke on touchdown and high-speed rollout, reusing fixed meshes so retries do not allocate new GPU resources.
- Add a cockpit-only high-speed canopy fog/vignette that scales with IAS and stays quiet under reduced-motion preferences.
- Soften the live gate and HUD nav cue when the jet is near the active checkpoint, keeping the stronger pass flash for the actual crossing.

## 2026-09-07

### Settlements

- Add rare 17-21 km procedural cities with 650-1,600 buildings and irregular villages in varied sizes.
- Make city and village terrain-review destinations search outward from their anchor cell so generator tuning cannot leave the review page blank.
- Make the regional-road review search for a valid connectable settlement pair and frame the route at a useful flight-scale height.
- Replace repeated grids with asymmetric districts, bent approaches, branches, dead ends and terrain-following roads.
- Mix blocks, slabs, pitched hangars, octagonal towers and stepped skyscrapers.
- Rebalance city silhouettes so towers no longer dominate: stepped cores are rarer, hangars and slabs fill districts, and non-tower buildings regain pitched roof variation.
- Render flat-roof hangars with shared gabled canopies so industrial halls have a distinct silhouette without extra per-building meshes.
- Fit dry, gentle lots to existing terrain, with biome-specific architecture and oversized buildings for flight-camera readability.
- Stream instanced buildings and roofs, precompute terrain suitability in a worker, and include building collision.
- Connect selected nearby settlements with off-thread regional routes, gentle approaches and readable center markings.
- Add batched pale edge strips to regional connectors so long links retain a readable road silhouette through haze.
- Mark wet route spans as bridge decks and render them with a separate concrete-toned material, keeping river crossings visually distinct.
- Feed blended rain and snow intensity into settlement streets and bridge decks so the road network shares the same weather response as terrain.
- Feed the same values into settlement facades and roofs, with wet walls and snow-catching horizontal roof surfaces.
- Share the atmosphere daylight factor with instanced facade windows so settlements gain subdued daytime glazing and warm night lights without extra meshes.
- Add batched local street centerlines so district roads remain legible from the chase camera without per-segment draw calls.
- Add settlement destinations and a chase-camera scale check to the terrain review.
- Rework settlement morphology so villages use rare hamlet, ribbon, crossroads and basin profiles with varied radii, loops and oversized landmark buildings; cities remain rare, broad and dense.
- Rebalance city districts so towers and stepped forms stay rare landmarks while slabs, halls, blocks, and biome-specific facade palettes carry the wider skyline.

### Terrain

- Add broad ridge chains, foothill belts, long alpine valley cuts, dry plateau shelves, and rare deterministic volcanic calderas.
- Keep green and wet provinces smoothly rolling while reserving harder erosion profiles for dry and alpine regions.
- Retune mountain and snow palettes so high relief keeps readable rock and cool shadow detail instead of clipping to white.
- Expand settlement site search to preserve rare giant cities as terrain relief becomes more expressive, and allow villages in wider hill provinces.

### Water

- Replace the repeated three-spoke lake layout with one to three independently placed basins per catchment.
- Make seas occasional, smaller landmarks with broader irregular shore distortion rather than default oversized oceans.
- Improve water shading with clear teal shallows, deep blue centers, foam-tinted edges, and moving specular glints.
- Preserve fixed water levels and independent terrain/water meshes while keeping river width and route continuity deterministic.
- Add higher-elevation tributaries that join trunks from dry ground, creating connected branching drainage instead of isolated strips.
- Add moving low-contrast shoreline foam breakup and explicit water bounds for faster streamed-tile culling.
- Couple rain and snow to the shared water shader so precipitation changes ripple, foam, glint, and cool surface tint without rebuilding water geometry.

### Terrain readability

- Feed continuous ridge, valley, plateau, and caldera signals into terrain vertex colors so distant terrain keeps geological structure without extra draw calls.
- Add deterministic exposed-rock bands and cool valley shading to snow and mountain materials so alpine relief remains legible at flight distance.

### Weather

- Replace abrupt random preset jumps with seeded fronts that move through believable neighboring conditions.
- Blend fog, daylight, three cloud decks, wind, gusts and precipitation continuously over each transition.
- Feed blended rain and snow intensity into streamed terrain materials so wet fronts darken the ground and snow cools high relief without rebuilding chunks.
- Add wind-driven rain streaks, storm-darkened skies and lightning flashes.
- Batch every cloud puff into three instanced deck draws instead of hundreds of individual meshes.
- Add instant weather selection to the terrain review for visual and performance QA.

### Audio

- Afterburner engage cue: short rising whoosh (edge-triggered, not every frame).
- Touchdown and crash cues use brief noise bursts plus tones for clearer impact feel.
- Gate and circuit-complete cues unchanged; effects still respect mute (crash fires on the crash frame before mute).


## 2026-09-04

### Audit follow-up

- Spawn search no longer throws. Failed searches retry inland pads (never the origin ocean disk) and reseed keeps the live world if a replacement cannot be validated dry.
- Rendered water and collision now share one surface (ocean at sea level, inland water at 0.35 m).
- Near the jet, contact/AGL sample the visible chunk triangles so physics cannot miss the mesh. Far tiles promote and demote LOD (with hysteresis) instead of staying at their spawn resolution.
- Contact is swept along the motion path. Cliffs and ridges crash instead of elevating the jet. Water ditching and inverted/obstacle hits crash.
- Gate passes require a forward plane crossing. The HUD arrow is projected through the active camera.
- Simulation uses a fixed 60 Hz step with bounded catch-up. The jet and camera interpolate between physics poses so high refresh rates do not jitter. Pause, results, and a hidden tab freeze weather and daylight.
- Snow is a world-space wrapping field with round flakes, updated every rendered frame so it no longer stutters with the 60 Hz sim.
- Menu keys no longer leak into flight. Tab/Enter work on title and pause. **R** rolls a new world; pause/results Retry keeps the same course.
- Afterburner, plume, audio, and HUD share one engine state. Afterburner will not light with the throttle closed; ENG% stays the lever.
- Circuit is a scored run (time, gate accuracy, landing) with a results screen and locally saved bests. Event cues play on gates, landing, and crash.
- Stall / low-alt warnings are retuned and enabled.

### Audio

- Engine rumble and wind hiss via Web Audio (procedural noise, no sample files).
- Rumble follows throttle and afterburner; wind follows airspeed.
- AudioContext resumes on Play; muted on title, pause, and crash.
- Short procedural cues for gate, circuit complete, landing, and crash.

## 2026-08-13

Session wrap. Arcade flight is playable: take off, fly the circuit, crash or land, reset.

### Play

- Cockpit camera locks to the jet. Q/E still roll.
- Engine percent is a speed target (50% holds about 500 kts, 100% about 1000). Afterburner goes a bit past that.
- Shift / Ctrl spool the lever slowly so you can set a precise percent.
- Afterburner no longer shows an AB badge. The ENG bar still fills.
- Crash is a fireball with arcing burning globes, camera punch, and no freeze. Press R for a new world.
- Next-gate cue: HUD arrow, range, altitude, and a beacon on the live ring.
- Airfield dress: hangar, tower, apron, PAPI, windsock, floods, fence.
- Title: Play, Controls, Game info.
- In flight, Esc opens pause (resume, fullscreen click toggle, quit to title). F is not fullscreen.
- Esc in fullscreen opens pause instead of leaving fullscreen (Chromium Keyboard Lock). Hold Esc is still the browser escape hatch.

### World / spawn

- No more fake flatten of the whole departure corridor.
- Spawn only on naturally flat inland ground (not ocean or coast).
- A short disk around the strip is leveled to that pad height so the runway sits flush.

### Fixes

- Crash and landing use impact speed before the ground clamp.
- Flying into a cliff no longer elevators you onto the slope.
- After a landing you can take off and crash again.
- Title C / N / R no longer leak into the first Play frame.
- Held keys survive Play / R (except Space/Enter used to start).

### Docs / tools

- README and this changelog match current controls and features.
- Hidden map-gen overlay for agents: `?debug=1` (not shown in normal play).

## Earlier

Arcade core, streaming terrain, day/night, weather, HUD/ADI, mission rings, procedural F-35, title screen, fullscreen keyboard lock.

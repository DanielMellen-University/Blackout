# Blackout

Browser-based arcade flight simulator. Pilot an F-35, take off, fly hard, and either land or crash in style.

Built with **TypeScript**, **Three.js**, and **Vite**. No install beyond a modern browser once the app is running.

## Features

- Title screen: Play, Controls, Game info
- Pause menu in flight (**Esc**): resume, fullscreen, quit to title
- Checkpoint circuit (5 rings; HUD arrow, range, and a beacon on the live gate)
- Arcade flight: nose-follows-path, ENG% is a speed target (50% ~ 1500 kts)
- Inland spawn on naturally flat ground; short pad level for the strip; hangar and tower
- Runway edge lights dim into daylight and brighten through dusk and night using the shared atmosphere clock.
- Runway daylight updates use the shared edge-light material directly, avoiding per-frame runway tree traversals.
- Crash boom (arcing fireballs) or scored landing; **R** new world
- Cameras: stable external chase and cockpit view, toggled with **C**
- Cockpit view now has a restrained camera-attached canopy frame and coaming, while the external view keeps the same clean aircraft silhouette.
- Reduced-motion preferences now suppress crash, touchdown, and afterburner camera motion as well as the existing CSS pulses, and live preference changes apply immediately.
- Graphics and audio preference listeners are released with the runtime, preventing stale controls from touching a disposed scene after a remount.
- Menu, results, and preference controls now share one teardown bag, so a remounted runtime cannot stack stale button callbacks.
- Settings and pause dialogs now announce their active heading and return focus to the control that opened them when closed.
- Tab and Shift+Tab are contained inside the active settings or pause panel, then released during runtime teardown.
- Losing browser-window focus now pauses active flight safely, with no automatic resume when focus returns.
- If the browser drops fullscreen during active flight, a short banner explains how to click the canvas and recover it.
- The title screen keeps the takeoff brief visible and announces when the airfield is ready for launch.
- First-person mode now renders its camera-attached canopy rails, brow, and coaming while removing them cleanly on teardown.
- Cockpit view now projects a restrained velocity-vector marker from the jet's real motion, making slips and climbs readable without adding scene geometry.
- Toggling `C` now announces the active cockpit or external view with a short in-flight cue.
- WebGL context loss now gates render submissions and shows a recovery cue, keeping simulation state safe through browser GPU resets.
- Expired crash particles are compacted out of the live update list, trimming the effect's CPU tail without changing its fixed visual pool.
- Expired landing dust and smoke are compacted in place, keeping repeated touchdown effects allocation-stable without per-frame array shifts.
- Loaded-tile collision sweeps reuse one height and land/water record, avoiding rich surface-object churn while preserving fallback sampling outside the stream.
- Graphics presets now scale pooled rain and snow simulation and draw ranges, giving Low a real weather-performance budget while High keeps the full field.
- Graphics presets also scale the instanced cloud draw ranges and skip hidden cloud updates, so Low reduces atmospheric GPU and CPU cost without removing the weathered sky entirely.
- Graphics presets also scale near-field vegetation instance counts, giving Low a meaningful foliage CPU and GPU budget while keeping the same authored world and allowing live quality changes.
- Empty vegetation batches are hidden when a quality preset reduces them to zero, removing wasted draw submissions while keeping live preset changes reversible.
- Chase-camera ground occlusion uses a distance-aware probe budget, reducing close-rig terrain queries while retaining full coverage for long user-zoomed sightlines.
- The title hero stages streamed settlements out of view so the runway and F-35 stay readable; the cached city and village layer returns immediately when flight starts.
- The flight HUD reflows on narrow or short browser windows, keeping the heading tape, telemetry, warnings, and gauges readable without changing the desktop layout.
- The optional GLB aircraft loader is code-split from the initial bundle, so the procedural F-35 can boot with a smaller payload while the replacement model still loads and cleans up normally.
- The nose wheel visibly follows A/D runway steering, then recenters smoothly after takeoff and resets with each new flight.
- Heavy rain uses pooled per-streak drift instead of per-frame trigonometry, preserving wind variation while keeping storm CPU cost bounded.
- The vertical-speed readout uses cool climb and amber sink tones with a small deadband, making flare timing readable without adding scene work.
- Altitude, vertical speed, and airspeed expose live semantic meter values, while HUD banners and cautions announce themselves at the right urgency for assistive tech.
- Connected controllers poll at a bounded 30 Hz only during live flight, with stale axes and boost cleared immediately when focus is lost.
- Static runway and airfield meshes freeze their local transforms after construction, while the weather-driven windsock stays animatable for lower render-loop CPU cost.
- The runway windsock now aims downwind and extends with the live weather wind, giving takeoff a readable local wind cue without extra draw calls.
- The runway PAPI now changes from red to white with the aircraft's real glide angle, while fly-bys hold a neutral two-white/two-red pattern.
- PAPI brightness follows the day/night atmosphere, staying restrained in daylight and readable during night approaches.
- Crash fireball updates resolve one shared impact-point ground sample per frame instead of querying terrain once per pooled particle, keeping the explosion cheap on steep streamed terrain.
- Fixed-step timing now ignores malformed or backwards animation timestamps, preventing a bad browser frame from poisoning simulation interpolation or the FPS readout.
- Low graphics quality now skips multisample antialiasing at renderer startup, while Balanced and High retain the sharper edge path.
- High-altitude collision sweeps now use a conservative three-point terrain broad phase before running detailed body probes, trimming steady-flight height queries without changing near-ground contact.
- Directional shadows now refresh on a bounded 20 Hz cadence instead of rebuilding every rendered frame, with immediate refreshes after quality or WebGL context changes.
- Crash VFX now stops as soon as its pooled particles expire and the flash envelope is complete, avoiding an empty post-crash tail and its terrain query.
- Pooled crash and landing effects now return immediately on frozen or negative frame deltas, avoiding unchanged particle walks and paused crash terrain queries.
- Collision classification now avoids redundant rich surface sampling for clearly airborne flight and returns immediately after a crash, trimming the steady-state physics and crash tail.
- The F-35 exhaust petals flex subtly with military power and afterburner, adding mechanical life without extra geometry or draw calls.
- Height-only ground queries now use visible mesh interpolation directly, so camera clearance, AGL, collision clearance, and landing effects skip redundant biome sampling in flight.
- Flight banners now distinguish neutral info, successful landings/gates, and actual crash or recovery danger states instead of using one alarm color for every event.
- The HUD now includes a lightweight fighter-style heading tape with cardinal marks and a centered caret, making yaw readable at a glance without adding scene work.
- Dark airframe panels gain a restrained cool night fill that fades to zero in daylight, keeping the F-35 silhouette readable without extra lights or geometry.
- Swept high-speed collision checks now reuse their contact record, trimming physics garbage without changing landing or crash outcomes.
- The completion card is a proper keyboard-contained dialog and returns focus to the flight canvas when a run is restarted.
- Completion results now show the gate, time, and landing contributions behind the total score.
- Play, Retry, New World, and `R` now open with a short `SPOOL ENGINE / W TO ROTATE` briefing so takeoff has an immediate readable handoff.
- Crash camera impulse uses smooth bounded multi-frequency shake instead of harsh per-frame white-noise jitter.
- External speed framing respects the chase camera's configured maximum distance, keeping the jet readable even when zoomed out at top speed.
- Graphics quality is selectable from the pause menu. Low disables shadow-map work and caps adaptive pixel density, while Balanced and High retain progressively larger budgets. The choice is saved locally.
- Audio volume is adjustable from the pause menu and saved locally. The slider changes the master mix smoothly, while **M** remains an immediate mute toggle.
- Middle-mouse look / pan, scroll zoom (not in cockpit)
- HUD: IAS to 3000 kts (50% ENG ~ 1500, 100% ~ 3000), ENG, ALT AGL, ADI, gear, weather/time. Acceleration and deceleration respond 5× faster.
- Rebuilt F-35-style airframe with canted tails, intake throats, gold canopy, articulated landing gear, and a soft single-engine afterburner
- Red and green navigation lights use a restrained shared pulse, keeping the F-35 readable at dusk and night without point lights or extra shadow passes.
- The afterburner now gives its cached Mach diamonds a restrained throttle-scaled pulse, adding depth to the exhaust without extra draw calls.
- The gold canopy now uses a restrained clearcoat physical material, giving the F-35 cockpit a sharper glass highlight without adding geometry or a draw call.
- High-speed cockpit view gains a slight canopy fog/vignette linked to IAS, with reduced-motion support and no new scene draws.
- Afterburner now adds a restrained edge heat veil that scales with speed, stays boost-only, and respects reduced-motion settings.
- Clean touchdowns and fast rollouts kick up pooled ground scrub dust and tire smoke without per-landing allocation churn.
- Approaching the live checkpoint softens a proximity pulse on the ring and HUD cue, separate from the brighter gate-pass flash.
- Airborne yaw and runway steering now honor the HUD control convention: A turns left and D turns right, with regression coverage for both nose directions.
- Aircraft model replacement disposes removed geometry and materials so visual asset reloads do not leak GPU resources.
- Deployed landing wheels now spin with rollout speed and reset cleanly between runs, using the existing gear meshes with no added draw calls.
- Aircraft animation caches gear, control-surface, afterburner, and nozzle nodes so each physics step avoids repeated scene-tree searches.
- Repeated ground-state reads now reuse a pose-keyed contact result, reducing terrain sampling across auto-gear, collision, warnings, and HUD without allowing stale state after movement or attitude changes.
- Flight surfaces are now visibly hinged: differential flaperons, stabilators, and canted tail panels move with pitch, roll, and yaw input while reusing the existing meshes.
- HUD readouts coalesce unchanged text and visibility updates, reducing avoidable DOM/layout churn during flight without lowering gauge responsiveness.
- High-frequency HUD transforms, SVG needle attributes, engine bars, and warning classes also coalesce unchanged style writes, reducing layout churn while preserving smooth visual precision.
- Engine rumble + wind hiss (Web Audio); short event cues for afterburner engage, gates, touchdown, and crash
- Engine audio now layers one restrained turbine whine above the low rumble, with throttle and afterburner-driven pitch and coalesced automation.
- Engine, weather, and event audio now share a conservative output limiter, preventing stacked cues from clipping at full power.
- Press **M** during flight to mute or restore audio without pausing; the HUD shows the live audio state.
- Caution and warning banners stop pulsing when the browser requests reduced motion, preserving readable alerts without visual flashing.
- Audio mutes while the tab is hidden and resumes when active flight returns, preventing suspended browser contexts from leaving the game unexpectedly silent.
- Touchdown dust and smoke are seeded from the landing state, making repeated landings visually repeatable while keeping the pooled effect budget.
- Audio mute takes effect immediately, including for event cues raised in the same simulation frame as the toggle.
- Hidden tabs skip camera, renderer, and debug submissions while keeping simulation timing and world streaming ready for the next visible frame.
- Static title, pause, and results frames skip world streaming work until flight resumes, reducing idle CPU without changing the live anchor or weather path.
- Flight keyboard-capture state is now coalesced, so steady frames do not rewrite the same input mode.
- The HUD freezes its last live telemetry under pause and results overlays, avoiding gauge and warning recomputation until flight resumes.
- The audio graph now returns immediately from repeated muted pause/hidden updates, while unmute transitions still schedule normally.
- The active-gate beacon now updates only when the route changes, avoiding a redundant per-frame position copy while preserving the same visible guidance.
- Flight audio coalesces unchanged Web Audio automation targets so steady cruise does not enqueue redundant gain and filter ramps.
- Weather uniforms and settlement lighting updates are coalesced at the world boundary, preserving visible transitions while reducing stable-flight writes.
- Frozen title and pause frames skip redundant atmosphere light, sky, cloud, and weather work while still refreshing when the camera anchor or weather state changes.
- Resize bursts are coalesced to one renderer and camera update per animation frame, and steady tone-mapping exposure avoids redundant renderer state writes.
- Runtime teardown closes Web Audio, renderer, camera, and input resources on page unload so reloads do not leave stale browser work behind.
- Runtime teardown also releases streamed terrain, settlement workers, weather pools, mission gates, crash effects, runway assets, and aircraft resources before renderer disposal.
- Runtime teardown now unregisters global key, fullscreen, resize, and visibility handlers so a remounted scene cannot drive disposed state.
- Browser-suppression handlers now have an idempotent teardown that restores the canvas focus and context-menu state on runtime disposal.
- Renderer startup uses Three.js's supported PCF shadow-map constant directly, avoiding the deprecated shadow-map fallback warning.
- The fixed-step clock reuses its render timing record between ticks, removing another steady-frame allocation without changing interpolation or catch-up behavior.
- HUD clock and weather labels now cache by displayed state, avoiding unchanged string reconstruction while keeping telemetry responsive.
- Rounded flight, attitude, navigation, and camera readouts also reuse their formatted strings, reducing live overlay churn without lowering display precision.
- The flight overlay now shows cached signed vertical speed, making climb, sink, and landing flare timing readable beside altitude without adding a per-frame allocation.
- The flight overlay now includes a cached wrapped heading readout, making absolute orientation and A/D yaw response readable without adding scene work.
- New STALL and LOW ALT cautions announce their first transition with a quiet two-tone cue while the HUD carries the persistent warning state.
- Flight warning evaluation reuses stable STALL, LOW ALT, and clear-state records to avoid per-frame telemetry garbage.
- Mission HUD telemetry reuses one navigation snapshot and cached gate label between frames, avoiding recurring object and string allocations while flying the circuit.
- Main-loop audio and HUD frame records, plus aircraft attitude telemetry, are reused between frames so steady flight does not create short-lived control objects.
- Weather propagation reuses its comparison record and only snapshots on meaningful transitions, avoiding a per-frame state object while preserving responsive rain, snow, wind, cloud, and daylight updates.
- Runtime weather blending now fills one atmosphere-owned snapshot in place; public weather snapshots remain independent while the render loop avoids duplicate profile and wind allocations.
- Atmosphere anchor tracking reuses one coordinate record between updates, eliminating another steady-flight allocation while keeping frozen-frame skip checks exact.
- The analytic sky cloud deck now fills an atmosphere-owned record in place, removing another per-update allocation without changing cloud coverage or wind shading.
- Settlement streaming now guards empty void sorts and compacts ready roads in place, reducing worker handoff churn during steady flight without changing landmark priority.
- External camera speed framing and crash-shake envelopes now reuse camera-owned records, removing per-frame temporary objects while preserving the existing framing and shake curves.
- Aircraft control-surface animation now writes through cached hinge nodes directly, avoiding a per-step helper closure and name dispatch while retaining smooth F-35 flap, stabilator, and tail motion.
- HUD text readouts now use the same cached-write strategy as styles and attributes, avoiding repeated DOM reads while preserving exact telemetry values.
- The engine percentage readout now caches its rounded string too, removing another steady-flight template allocation without changing gauge responsiveness.
- HUD gauge needles, arcs, and attitude transforms now reuse their quantized strings before the DOM write cache, trimming more steady-flight formatting churn.
- Version 7 adds restrained high-speed edge streaks that scale with IAS and warm up under afterburner, with reduced-motion support and no new scene draw calls.
- Version 7 external chase framing adds a tiny smooth afterburner sway, leaving cockpit mode untouched and keeping motion below the impact-shake envelope.
- Version 7 engine audio now spools the procedural loop with throttle and afterburner through coalesced playback-rate automation, so power changes affect tone as well as loudness.
- Version 7 adds restrained directional gear transition clicks, making the automatic landing-gear cycle readable without adding an audio asset or a persistent alert.
- Version 7 adds a pooled checkpoint pass flash that expands and fades at the cleared gate, making high-speed gate crossings readable without spawning new geometry.
- Version 7 gives automatic gear transitions a short HUD pulse with reduced-motion support, matching the directional audio cue without adding a persistent alert.
- Version 7 adds a restrained procedural precipitation bed: rain and snow now alter one pooled, coalesced audio layer without sample assets or extra scene work.
- Version 7 adds a small airborne-touchdown camera pulse, keeping clean landings physical while staying far below the crash-shake envelope.
- Version 7 adds a rare procedural dorsal anti-collision strobe to the F-35 silhouette, hidden between flashes so it adds detail without a steady draw cost.
- Version 7 results now expose the gate-score contribution alongside total, time, and landing quality so circuit performance is readable after touchdown.
- Results now tint the panel by medal tier and briefly call out a new best, with reduced-motion-safe presentation.
- Version 7 adds edge-triggered procedural thunder for the existing rate-limited lightning flashes, keeping storms audible without repeated alarms.
- Version 7 crash effects now reuse a fixed particle pool across retries, removing repeated mesh and material allocation without changing the explosion envelope.
- Crash bursts are seeded from their impact state, so retries are visually repeatable while retaining the same pooled effect budget.
- If Chrome exits fullscreen on Escape during flight, the next canvas click now safely re-enters it without affecting menu or title interactions.
- Version 7 mission gates now reuse one fixed five-ring pool across retries, keeping circuit resets allocation-stable without changing the route.
- Version 7 event audio now reuses fixed procedural white and brown noise buffers, keeping repeated cues from rebuilding PCM data.
- Version 7 collision checks now reuse attitude and contact records at the fixed physics rate, removing another steady-flight allocation without changing landing rules.
- Infinite geographic provinces: broad alpine massifs, smooth green hills, dunes, weathered mesas with stepped shelves, basalt uplands, salt flats, tundra, savanna, forests and rainforest regions.
- Landforms have distinct regional families: long rounded ridge chains with carved alpine valleys, dry plateaus and terraces, dune fields, and rare smooth volcanic cones with calderas. Green lowlands remain rolling instead of needle-like.
- Dry foothills sometimes spread into broad alluvial-fan ramps with gentle lobes and mineral bands before transitioning into dunes or mesas.
- Water is an independent surface with variable basin counts, irregular coves, narrower inland seas, bent rivers with deterministic tributaries, teal shallows, deep blue channels, shoreline foam tint, and animated glints.
- Basin shorelines now combine directional headlands, broad shoulders, and a second cove scale so lakes and seas avoid radial silhouettes while staying analytic and cheap.
- Water shares precipitation uniforms with terrain: rain roughens ripple and foam motion while snow cools the surface without rebuilding clipped water meshes.
- Rain also gives flat lowlands a restrained cool wet-sheen while leaving hills and mountains readable, using the existing terrain height and normal path.
- Cities use landmark-only tower cores surrounded by slabs, industrial halls, blocks, stepped forms, and broader biome-specific color palettes.
- Terrain vertex colors now carry the landform signal too, giving ridges, alpine valleys, plateaus, and calderas distinct readable shading even on distant low-detail tiles.
- Snow and mountain palettes add stable exposed-rock bands and cool alpine-valley shading so high relief stays readable instead of becoming one white sheet.
- Mostly dry land with uncommon, compact inland seas, irregular lakes, and meandering rivers that vary in width and descend from lake outlets to sea level. Seas stay regional landmarks rather than swallowing whole flight routes. Water is separate geometry over a sediment bed, with calm reflections and fine ripples.
- Streaming terrain (16.8 km radius), adaptive detail tiles and smoothly blended biomes. Trees and rocks use bounded instanced streaming in the near field.
- Terrain generation is frame-budgeted; cached catchments, spatially indexed river reaches, and coarse distant tiles keep generation and draw calls bounded. Rendering resolution adapts gradually under sustained load.
- World-cloud transforms use a fixed 30 Hz budget; lighting, rain, snow, and lightning remain frame-responsive so weather stays smooth without spending a full matrix rewrite every render frame.
- Weather fronts turn wind along the shortest arc while interpolating speed separately, avoiding an artificial calm pocket when a storm changes direction.
- Salt flats carry broad deterministic crust and damp-playa bands instead of a single pale sheet, using the existing terrain vertex-color path.
- Tundra carries broad frost and wind-scoured scree bands so cold lowlands do not collapse into one gray-green material.
- Low coasts blend through a restrained beach and silt band driven by the warped shoreline signal, keeping cliffs and high shelves on their normal biome material.
- City districts inherit biome architecture bias: dry skylines spread into broader hangars, wet cities stay tighter, and cold or highland cores favor stepped silhouettes.
- Villages inherit the same climate logic at a smaller scale: dry hamlets favor broad halls, wet settlements cluster compactly, and cold villages pick up stepped civic forms.
- Local road hierarchy follows the province too: dry settlements use broader spines, wet settlements tighter streets, and cold settlements heavier approaches while regional links keep their fixed budget.
- Desert and mesa vertex colors now reuse the generated dune and badland signals for broad wind bands and layered strata, with no added geometry or texture cost.
- Snow particles now drift with the same blended wind direction as clouds and rain, keeping blizzards coherent without increasing the pooled particle count.
- Water keeps one batched material but now differentiates river, pond, lake, and sea palettes by depth and body kind, making larger seas read deeper and inland water more varied.
- Regional road selection now favors cross-tier hub spokes on both sides: cities reach nearby villages before adding another city link, while the fixed link caps stay unchanged.
- Regional wet-span connectors now add capped instanced bridge piers beneath their existing deck meshes, grounding long village and city routes without per-span geometry.
- Regional route selection now prefers broad alpine valleys and avoids ridge spines when comparable terrain-following bends exist, keeping settlement highways grounded without extra road geometry.
- Vegetation now gives savanna, tundra, volcanic, and saltflat provinces distinct sparse prop mixes instead of falling through to generic grass, while reusing the existing instanced mesh budget.
- Instanced vegetation now shares the world weather response: rain darkens foliage and snow settles on upward-facing canopies, trunks, and rocks stay readable without extra draw calls.
- Foliage now sways independently with the same blended weather wind as clouds, snow, terrain cover, and water. Rock materials stay static and the animation remains inside the existing instanced vegetation batches.
- Terrain snow accumulation now shares wind direction too, lightly scouring windward slopes while retaining more cover on leeward faces without rebuilding streamed tiles.
- Water ripple and color drift now share the same weather wind direction, keeping lakes and seas visually coherent with moving rain and cloud fronts without extra water draws.
- Water now uses its existing moving normal field to vary roughness, adding restrained highlights to rivers, lakes, and seas without another material or draw.
- Weather fronts now move through plausible neighboring states with smooth fog, light, cloud-deck and wind transitions. Clear, fog, rain, thunderstorms, snow and blizzards each have distinct visibility and precipitation. Layered clouds render in three instanced batches. Press **N** to cycle weather manually.
- Terrain now receives a restrained moving cloud-shadow field from the same blended cloud cover and wind, keeping streamed tiles visually tied to the cloud decks without shadow-map cost.
- Terrain materials respond to the same blended precipitation values: rain darkens the ground and snow adds stronger altitude/slope-aware cool cover without rebuilding streamed chunks. Snowfall uses varied soft flakes in one pooled pass so it remains readable at flight scale.
- Settlement streets and bridge decks use the same blended precipitation values, so roads wet and cool with the terrain.
- Rain now breaks settlement streets, bridges, and highways into deterministic puddle patches through the shared road shader, keeping wet surfaces readable without extra meshes or materials.
- Those puddle patches also lower local roughness, giving wet roads and bridge decks a restrained highlight response without another material or draw.
- Settlement facades and roof materials share those precipitation uniforms, darkening in rain and collecting cool snow on horizontal surfaces.
- Building window grids also share the day/night factor, staying subdued by day and warming into low-cost city lights after sunset.
- Cities now add a capped instanced street-light rhythm along outer roads, framing civic districts at night while keeping villages and the terrain budget unchanged.
- Cities and villages that genuinely border a lake or sea now gain rare deterministic waterfront docks, reusing two capped instanced batches instead of per-building geometry.
- Biomes: plains, forest, rainforest, desert, mesa, swamp, hills, mountain/snow, water/ocean

## Tech stack

| Layer | Choice |
|-------|--------|
| Rendering | Three.js (WebGL) |
| Language | TypeScript |
| Build | Vite |
| Models | Procedural mesh + optional GLTF/GLB |
| Physics | Custom arcade flight model |

## Getting started

### Prerequisites

- Node.js 20+
- npm (or pnpm / yarn)
- A modern browser

### Install and run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview the production build |
| `npm test` | Run unit regressions |

## Controls

| Input | Action |
|-------|--------|
| **W / S** | Pitch up / down |
| **A / D** | Yaw left / right |
| **Q / E** | Roll (Q right, E left) |
| **Shift** | Engine power up (speed target) |
| **Ctrl** or **1** | Engine power down |
| **2** | Engine power up |
| **Space** | Afterburner |

| **Hold MMB + drag** | Look / pan (not cockpit) |
| **Scroll** | Zoom (not cockpit) |
| **C** | Toggle external / cockpit camera |
| **N** | Weather |
| **M** | Mute / unmute audio |
| **Gamepad** | Left stick pitch/roll, LT/RT throttle, A / Cross afterburner |
| **R** | New world + runway |
| **Esc** | Pause menu |

**Takeoff:** Hold Shift to spool, build speed, then **W** to rotate. Gear is automatic. Engine percent is the speed you want (50% ~ 1500 kts).

Landing is gentle with gear down. After the circuit, land to score. Hard impacts explode; press **R** for a new world. Retry the same course from pause or the results screen. Fullscreen is a click toggle in the pause menu.

## Optional aircraft model

The built-in aircraft is an original procedural mesh. For visual development, run
the dev server and open /dev/aircraft.html to inspect the model, gear animation,
and exhaust under neutral lighting. /dev/terrain.html provides a daylight world
review with orbit controls and reseeding. These pages are development tools and
are not included in the production build.

The terrain review uses fixed seeds and deterministic feature searches for
smooth green hills, alpine massifs, irregular lakes, river valleys, inland seas
and badlands, plus a
flight benchmark at either 400 m/s or the current maximum afterburner speed,
with draw counts and frame timings. Streaming prioritizes contact detail, then
missing coverage and coarse replacements, before distant detail rebuilds.
Near-field vegetation roots and meshes are cached per streamed tile, so the
per-frame fade path does not repeatedly search or traverse the scene tree.
Geography is deterministic for a seed and coordinate; this generator changes old landscapes.
Green provinces now use stronger rolling hills, so flat sheets are rarer
without bringing back sharp lowland spikes.
Selected humid lowlands now also carry a bounded karst signal: broad limestone
bowls and low ridges add another terrain family while staying smooth enough for
flight and blending into neighboring biome colors.
Foothill shoulders also receive a restrained olive/stone material band, making
the mountain-to-lowland transition readable without new geometry or noise calls.
Alpine ranges use narrower ridge spines, deeper winding valleys, and multi-scale
summit folds plus a bounded peak-and-saddle sculpt so high terrain breaks into
distinct flyable peaks instead of broad tables. Snow and mountain faces use
stronger deterministic rock bands, altitude exposure, and cool valley contrast
so the existing relief remains readable at flight distance without extra terrain
geometry or noise calls.
Cold highlands also get occasional broad glacial cirques, reusing existing
alpine signals to carve smooth bowls and cool blue ice-rock material bands
without sharp peaks or additional noise work.
Seas sit at zero elevation; each lake has its own level below the surrounding
rim. River reaches descend between those levels. Shallow water carries moving,
low-contrast foam breakup instead of a uniform shoreline, while river ribbons carry
direction-aware moving riffles, variable widths, tapered tributary ends, and
broken bank foam. Rivers receive a stronger depth/color response so they do not
read as pale uniform strips at flight scale. This is procedural drainage, not a
rainfall or fluid simulation.
Steeper reaches now carry a bounded grade signal into the same shader, adding
rapids foam and extra ripple energy without a second river mesh or draw family.
Non-mouth tributaries use long, three-stage, slightly submerged endpoint tapers
so streamed river pieces feather into their channel instead of ending as
flat-cut ribbons; confluences get a small shared rounded shoulder to hide
arrival seams.
Large fog-ring tiles decimate cached lake and sea shoreline fans, keeping distant
water bounded while nearby shorelines retain their full irregular outline.
Dry river shoulders receive a subtle biome-aware wet-meadow and silt tint so
channels read as ecological corridors instead of isolated blue strips.

Rare procedural cities and more frequent villages occupy suitable dry terrain.
Villages range from compact hamlets to several-kilometre ribbon, crossroads and
basin settlements; the rarest cities span roughly 17-20 km and contain 650-1,300
buildings with mixed towers, stepped cores, slabs, hangars and pitched rooflines. Organic branches,
dead ends and broken district connectors replace repeated grids. Building
footprints, heights, stepped/octagonal silhouettes, rooflines and biome palettes
vary by world seed, using deliberately exaggerated scale for readability from the jet.
Cities now seed a deterministic mixed-use downtown ring around the civic plaza
before filling their broad outer districts, so the skyline reads clearly from
the flight-scale review as well as from the city edge. Protected villages get
a modest density bonus so they read as destinations instead of tiny hamlets,
while organic villages keep their rarer size bands. Village roads also seed a
few deterministic frontage lots before the wider scatter pass, so long
approaches read as lived-in instead of empty ribbons. Dry villages tend toward
stretched ribbons, wet villages gather into basin profiles, and cold/highland
villages favor compact crossroads while seed variation remains intact. Larger
villages can also
receive a small instanced civic spire or dome, giving
their varied footprints a recognizable center without adding per-building
draws, and every village stays within a hard 70-building budget. Every settlement reserves a deterministic central plaza or village
green so road approaches have breathing room instead of filling the whole
footprint with blocks.
Facade windows use a wider, lower-contrast rhythm so villages and cities keep
readable building silhouettes instead of collapsing into dense dark grids.
Shared wall materials also add deterministic low-contrast panel seams and floor
bands, keeping large blocks from collapsing into featureless boxes at flight
scale without adding geometry or draw calls.
Each new airfield also reserves independent city and village anchor searches;
the runway heading biases those landmarks into the first takeoff corridor, and
deterministic fallback cells keep both tiers alive when a rough seed rejects
the first shelf or a streaming reset retries the cell, while ordinary
settlement rolls remain naturally sparse. Organic sites are centre-biased
inside their stream cells so valid villages and cities are more likely to be
seen before the aircraft crosses the fog boundary. The protected village uses
a larger crossroads, basin, or ribbon profile instead of silently collapsing
to the smallest hamlet. Cities rise from lower outer
districts into taller cores instead of forming one uniform wall. The two
protected landmarks also use
small shared beacon meshes above their tallest roofs, making the guaranteed
destinations readable through flight fog and low-light weather without adding
per-building geometry.
Settlement placement runs in a background worker; buildings and roofs are
instanced, with ground detail culled at distance. Trees and rocks use the same
bounded instanced streaming path, with detailed props limited to the near field.
The terrain review includes city/village destinations and a Flight scale view
using the game's actual chase camera and aircraft.
Selected nearby settlements are joined by sparse regional roads rather than a
uniform world grid. Villages prioritize a reachable city hub for their single
regional link, creating readable hub-and-spoke networks without a dense road web.
Routes choose a curved terrain path, follow a bounded grade,
and lift into bridge or viaduct approaches across water and deep folds. Wet
spans switch to a concrete-toned bridge deck, while a cool slate highway deck,
brighter shared centerlines and edge strips keep links readable at flight distance.
Local district roads also receive a single batched centerline pass for readable
street networks at flight distance.

Place a GLB at `public/models/f35.glb`. The app hydrates it in the background and falls back to the built-in procedural mesh if the file is missing or slow. See `public/models/ATTRIBUTION.md` for licensing notes.

## Project layout

```
Blackout/
├── public/
│   ├── favicon.svg
│   └── models/              # optional f35.glb
├── src/
│   ├── main.ts
│   ├── core/                # input, time, fullscreen lock
│   ├── aircraft/            # state, mesh, flight model
│   ├── camera/              # chase / cockpit
│   ├── world/               # terrain, sky, airfield
│   ├── ui/                  # HUD, menus
│   ├── systems/             # collision, mission, crash FX
│   └── audio/               # engine/wind loops + event cues
├── CHANGELOG.md
├── index.html
├── package.json
└── README.md
```

## Roadmap

Shipped: flight, circuit, crash boom, airfield, menus, streaming world, day/night.

The current ship focuses on a readable arcade flight loop, strong aircraft presentation, and a bounded streamed world. Out of scope for now: radar, weapons, fuel.

## License

License TBD.

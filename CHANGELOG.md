# Changelog

## 2026-09-12

### Ship

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

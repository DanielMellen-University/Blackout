# Changelog

## 2026-09-07

### Settlements

- Add rare 17-21 km procedural cities with 650-1,600 buildings and irregular villages in varied sizes.
- Replace repeated grids with asymmetric districts, bent approaches, branches, dead ends and terrain-following roads.
- Mix blocks, slabs, pitched hangars, octagonal towers and stepped skyscrapers.
- Fit dry, gentle lots to existing terrain, with biome-specific architecture and oversized buildings for flight-camera readability.
- Stream instanced buildings and roofs, precompute terrain suitability in a worker, and include building collision.
- Connect selected nearby settlements with off-thread regional routes, gentle approaches and readable center markings.
- Add batched local street centerlines so district roads remain legible from the chase camera without per-segment draw calls.
- Add settlement destinations and a chase-camera scale check to the terrain review.
- Rework settlement morphology so villages use rare hamlet, ribbon, crossroads and basin profiles with varied radii, loops and oversized landmark buildings; cities remain rare, broad and dense.

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

### Terrain readability

- Feed continuous ridge, valley, plateau, and caldera signals into terrain vertex colors so distant terrain keeps geological structure without extra draw calls.

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

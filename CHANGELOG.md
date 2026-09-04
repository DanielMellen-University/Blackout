# Changelog

## 2026-09-04

### Audio

- Engine rumble and wind hiss via Web Audio (procedural noise, no sample files).
- Rumble follows throttle and afterburner; wind follows airspeed.
- AudioContext resumes on Play; muted on title, pause, and crash.

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

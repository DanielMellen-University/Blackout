# Blackout

**Browser-based arcade flight simulator.** Jump in a realistic-looking F-35, take off, fly hard, and either land or crash in style.

Built for **vibe coding**: fast to get flying, fun to iterate on, no pretensions of being Microsoft Flight Simulator. Open a page, hit a key, and within about 30 seconds you are airborne.

---

## Table of Contents

- [Vision](#vision)
- [Goals and Non-Goals](#goals-and-non-goals)
- [Current Status](#current-status)
- [Core Features (MVP)](#core-features-mvp)
- [Tech Stack](#tech-stack)
- [Flight Model Philosophy](#flight-model-philosophy)
- [Architecture](#architecture)
- [Key Modules](#key-modules)
- [Controls](#controls)
- [HUD](#hud)
- [Asset Plan](#asset-plan)
- [Project Structure](#project-structure)
- [Development Phases](#development-phases)
- [Tuning Knobs](#tuning-knobs)
- [Success Criteria](#success-criteria)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Contributing / Vibe Coding Notes](#contributing--vibe-coding-notes)
- [License](#license)

---

## Vision

Core fantasy: **You are in an F-35.** Throttle up, roll down a runway, pull the nose up, and the jet responds. Chase cam tracks you. HUD shows the basics. You can bank hard, climb, stall the nose if you push it, and either grease a landing or pancake into the terrain and restart.

Blackout prioritizes **feel and presence** over aerospace accuracy. The model should look like an F-35 from a normal camera distance; the physics should feel snappy and readable, not like a training syllabus.

---

## Goals and Non-Goals

### Goals

| Goal | Why it matters |
|------|----------------|
| Feel good to fly on night one | Momentum over perfection |
| Convincing F-35 look | The fantasy sells on first glance |
| Lightweight and browser-native | No install, share a URL, stay fast |
| Expandable core | Add sound, particles, gear later without rewrite |

### Non-Goals (for now)

- Full aerodynamic fidelity / real stability derivatives
- Global real-world terrain streaming
- Multiplayer / networking
- Complex systems (radar, weapons employment, fuel management, FMC, etc.)
- Multi-aircraft fleet or mission editor

These may be revisited after the MVP feels great to fly.

---

## Current Status

| Item | State |
|------|--------|
| Vite + TypeScript + Three.js app | **Done** |
| Procedural F-35 mesh (placeholder) | **Done** (visual polish still in progress) |
| Optional GLB load (`public/models/f35.glb`) | **Done** |
| Free-fly movement (body-relative) | **Done** (Phase 0 smoke test) |
| Multi-mode camera (C to cycle) | **Done** |
| RMB look / pan, scroll zoom | **Done** |
| Camera auto-return after idle | **Done** (~6.7s) |
| Terrain ground occlusion for camera | **Done** (flat ground) |
| Debug HUD (pos, speed, cam, fps) | **Done** |
| `FlightModel` (real flight physics) | Not started (Phase 1) |
| Ground collision / crash / land | Soft floor only (Phase 2) |
| Sound, particles, polish | Not started (Phase 3) |

**Next concrete step:** Phase 1. Wire `FlightModel` (thrust, gravity, lift/drag, damping) and take off from the runway for real.

---

## Core Features (MVP)

- [x] Scene renders in browser at solid frame rate
- [x] Flyable jet mesh (procedural placeholder; optional realistic GLB)
- [x] Keyboard free-fly + multi-mode camera
- [x] Simple terrain + runway
- [ ] Arcade-leaning flight model (thrust, gravity, basic lift/drag, simple stall, damping)
- [ ] Basic flight HUD: airspeed, altitude, attitude, throttle, gear
- [ ] Ground collision, crash, and restart
- [ ] Solid **60 fps** target in modern browsers under load

### Nice-to-have after MVP

- Gear animation and landing gear physics
- Afterburner / engine particles
- Crash VFX and camera shake
- Audio (engine loop, wind, touchdown, explosion)
- Better terrain (heightmap or light procedural)
- Gamepad support
- Simple mission: takeoff, fly through gates, land

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|--------|
| Rendering | **Three.js** (WebGL) | Full control, large ecosystem |
| Language | **TypeScript** | Safer iteration on flight math and scene graph |
| Build / dev | **Vite** | Instant HMR, simple static deploy |
| Physics | Custom simplified forces (Phase 1) | Free-fly in Phase 0; no full physics engine required |
| Models | Procedural mesh + optional **GLTF / GLB** | Drop-in path at `public/models/f35.glb` |
| Optional later | **Rapier** | Only if rigid-body collisions outgrow raycasts |

**Why Three.js over a game engine?** Blackout is a focused flight toy, not a multi-scene RPG. Three.js keeps the stack thin, debuggable, and friendly to "open the repo and change a number" vibe coding.

---

## Flight Model Philosophy

**Arcade with a light coat of realism.**

Phase 0 uses body-relative free-fly (smoke test). Phase 1 will apply each simulation tick roughly:

1. **Thrust** along the aircraft forward vector (scaled by throttle)
2. **Gravity**
3. **Speed-dependent lift and drag**
4. **Simple stall**: nose drops when angle of attack gets too high
5. **Angular damping** so it does not feel like a spaceship
6. **Control rates**: pitch / roll / yaw inputs map to angular rates (not full control-surface CFD)

**No** coefficient tables. **No** high-fidelity stability derivatives. Just tunable constants until it feels right.

### Integration approach

- `requestAnimationFrame` outer loop
- Phase 0: variable frame `dt` (clamped) for free-fly
- Phase 1+: fixed timestep for physics (e.g. 1/60 s) with accumulator when needed

Pseudo-flow (Phase 1 target):

```
inputs -> FlightModel.step(state, dt) -> integrate position/orientation
       -> collision check -> camera update -> HUD update -> render
```

---

## Architecture

```
Main Loop (rAF)
├── InputManager          # keyboard (gamepad later)
├── Aircraft              # state + Three.js mesh + free-fly
├── FlightModel           # forces, torques, integration (Phase 1 stub)
├── World / Terrain       # ground, runway, sky, lights
├── CameraSystem          # chase / close / cockpit / wingman / orbit
├── HUD                   # HTML overlay readouts
└── Collision / Crash     # Phase 2 stub (soft floor in free-fly for now)
```

### Data flow (Phase 0)

```
User Input --> InputManager --> Aircraft.controls
                                      |
                                      v
                              Aircraft.freeFlyStep()
                                      |
                    +-----------------+-----------------+
                    v                 v                 v
              Aircraft mesh     CameraSystem          HUD
              (position/quat)   (modes + RMB look)  (debug readouts)
```

Keep modules **small and replaceable**. The flight model should not know about Three.js materials; the HUD should not integrate physics.

---

## Key Modules

### InputManager

Maps keyboard to a neutral `ControlState`. Phase 0 free-fly reuses axes as:

| Axis field | Phase 0 free-fly meaning | Binding |
|------------|--------------------------|---------|
| `pitch` | Forward / back | W / S |
| `roll` | Yaw turn | A / D |
| `yaw` | Vertical | E / Q |
| `throttle` | Speed scale | 1 / 2 |
| `boost` | Speed multiplier | Shift |
| gear toggle | Toggle gear flag | G |
| camera | Queue mode cycle | C |
| reset | Queue respawn | R |

Output: normalized axes and toggles. No raw `KeyboardEvent` leakage into physics later.

### Aircraft

Holds simulation + presentation glue:

- Position (`Vector3`), velocity, orientation (`Quaternion`)
- Angular velocity and mass (reserved for Phase 1)
- Current control inputs
- Three.js mesh (procedural F-35 or optional GLB)
- Soft floor until real collision lands

### FlightModel

Stub for Phase 1. Pure-ish function of state + inputs + `dt`. Easy to unit-test with no WebGL.

### CameraSystem

| Mode | Behavior |
|------|----------|
| **chase** | Behind and above, hard-locked to the jet |
| **close** | Tighter chase |
| **cockpit** | First-person freelook; airframe hidden |
| **wingman** | Side formation angle |
| **orbit** | Free spherical orbit (same RMB controls) |

Also: hold **RMB** to look/pan, scroll to zoom, pitch clamped to +/-90 degrees, ground occlusion on flat terrain, idle auto-return to mode default after ~6.7s.

### HUD

Lightweight HTML/CSS overlay. Phase 0 shows debug: position, speed, camera mode, fps.

### World

- Flat textured terrain + fog
- Runway with centerline, thresholds, edge lights
- Hemisphere + directional lights

### Collision

Stub for Phase 2. Phase 0 soft floor lives in `Aircraft.freeFlyStep`.

---

## Controls

### Phase 0 (current)

| Input | Action |
|-------|--------|
| **W / S** | Forward / back along nose |
| **A / D** | Turn left / right |
| **E / Q** | Up / down |
| **Shift** | Boost |
| **1 / 2** | Throttle down / up (free-fly speed scale) |
| **Hold RMB + drag** | Look / pan camera |
| **Scroll** | Zoom (not in cockpit) |
| **C** | Cycle camera mode |
| **R** | Reset to spawn |
| **G** | Toggle gear flag (visual systems later) |

Right-click context menu is disabled so RMB is free for the camera.

### Phase 1+ (planned flight)

| Input | Action |
|-------|--------|
| **W / S** | Pitch |
| **A / D** | Roll |
| **Q / E** | Yaw |
| **Shift / Ctrl** | Throttle |
| **G** | Landing gear |
| **C** | Camera mode |
| **R** | Restart after crash |

Gamepad mapping can mirror dual-stick layout later.

---

## HUD

Design principles:

1. Readable at a glance while flying
2. Non-diegetic is fine for MVP
3. Prefer high-contrast, muted military UI accents

Phase 0 layout is debug corners. Phase 2 target sketch:

```
+------------------------------------------+
|  SPD  240    ALT  1200    thr  85%  GEAR |
|                                          |
|              [ attitude / horizon ]      |
|                                          |
|                     .                    |
+------------------------------------------+
```

---

## Asset Plan

| Asset | Priority | Notes |
|-------|----------|--------|
| F-35 GLTF/GLB | **P0** | Optional drop-in; procedural mesh is default |
| Runway mesh / markings | **P0** | In code today |
| Terrain / ground | **P0** | Flat plane + texture |
| Sky / lighting | **P0** | Daytime + fog |
| Afterburner particles | P2 | Visual throttle feedback |
| Crash FX | P2 | Smoke, debris optional |
| Audio | P2 | Engine, wind, touchdown, bang |

**Licensing:** Prefer CC0 / clear commercial-friendly or self-authored assets. Document sources in `public/models/ATTRIBUTION.md` when added.

**Performance budget (soft):**

- Keep main aircraft under a sensible triangle count for mid-range laptops
- Compress textures (KTX2 / basis later if needed)
- Avoid huge env maps on day one

---

## Project Structure

```
Blackout/
├── public/
│   ├── favicon.svg
│   └── models/                 # optional f35.glb
│       └── ATTRIBUTION.md
├── src/
│   ├── main.ts                 # bootstrap, rAF loop
│   ├── style.css
│   ├── core/
│   │   ├── InputManager.ts
│   │   ├── Time.ts             # frame dt + fps
│   │   └── types.ts
│   ├── aircraft/
│   │   ├── Aircraft.ts         # state + free-fly
│   │   ├── FlightModel.ts      # Phase 1 stub
│   │   └── createPlaceholderF35.ts
│   ├── world/
│   │   ├── World.ts
│   │   └── Runway.ts
│   ├── camera/
│   │   └── CameraSystem.ts
│   ├── ui/
│   │   └── HUD.ts
│   └── systems/
│       └── Collision.ts        # Phase 2 stub
├── index.html
├── package.json
├── tsconfig.json
└── README.md
```

---

## Development Phases

### Phase 0: Skeleton (largely done)

- Vite + TypeScript + Three.js scene
- Procedural F-35 placeholder (optional GLB)
- Multi-mode camera + free-fly movement
- Minimal HUD

**Exit:** Model visible, scene runs smoothly, jet movable from keyboard.

### Phase 1: Flight

- Hook up `FlightModel` + real control mapping
- Thrust, gravity, lift/drag, damping
- Takeoff and circuit from the runway

**Exit:** You can take off and fly a circuit by feel.

### Phase 2: Feel

- Flight HUD instruments
- Ground collision, stall, basic landing
- Tune until it feels like a jet toy, not a physics paper

**Exit:** Land or crash and restart without opening the console.

### Phase 3: Polish

- Better terrain and lighting
- Sound, particles, gear animation
- Visual polish (including a stronger aircraft mesh or real GLB)

**Exit:** Something you would proudly send a friend a link to.

---

## Tuning Knobs

Expect flight constants to live in one place (e.g. `FlightModel` or `tuning.ts`):

| Parameter | Effect |
|-----------|--------|
| `maxThrust` | Acceleration / climb authority |
| `mass` | Inertia feel |
| `liftCoeff` / `dragCoeff` | Cruise speed and glide |
| `stallAoA` | When the nose falls off |
| `pitchRate` / `rollRate` / `yawRate` | Responsiveness |
| `angularDamping` | Stops spaceship spin |
| `cameraLag` / `cameraOffset` | Chase cam drama (if springs return) |
| `crashSpeedThreshold` | Landing vs crash |

**Rule of thumb:** If a tweak needs a PR description longer than one sentence, the architecture is fighting you. Simplify the knob.

---

## Success Criteria

> You open the page, hit a key, and within **20 to 30 seconds** you are flying an F-35 that **looks the part** and **feels responsive**.

That is the primary metric for Blackout. Secondary: stable frame rate, restartable crashes, and a codebase a future you can still enjoy editing late at night.

---

## Getting Started

### Prerequisites

- Node.js 20+ (LTS recommended)
- npm, pnpm, or yarn
- A modern browser (Chrome, Firefox, Edge, Safari)

### Install and run

```bash
npm install
npm run dev
```

Open the local URL Vite prints (typically `http://localhost:5173`).

### Optional F-35 model

Drop a GLB at `public/models/f35.glb`. On boot, Blackout tries to load it and falls back to the procedural silhouette if missing. See `public/models/ATTRIBUTION.md`.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server + HMR |
| `npm run build` | Typecheck + production bundle |
| `npm run preview` | Preview production build |

---

## Contributing / Vibe Coding Notes

This project is optimized for **fast, enjoyable iteration**:

1. **Play first, optimize second.** Get airborne before refactoring abstractions.
2. **Tune constants in one file.** Flight feel should be a slider culture, not a scavenger hunt.
3. **Keep modules honest.** Input is not physics is not render.
4. **Commit small, descriptive chunks.** Especially while the core is forming.
5. **Do not invent systems sim.** If it does not help "feel good to fly," defer it.

### Suggested commit style

Imperative mood, focused on *why* when useful:

```
Add fixed-timestep flight integration loop
Tune roll rate and angular damping for snappier banks
Wire chase camera spring follow
```

---

## License

TBD. Decide before shipping public builds or third-party assets.

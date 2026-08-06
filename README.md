# Blackout

**Browser-based arcade flight simulator** — jump in a realistic-looking F-35, take off, fly hard, and either land or crash in style.

Built for **vibe coding**: fast to get flying, fun to iterate on, no pretensions of being Microsoft Flight Simulator. Open a page, hit a key, and within ~30 seconds you’re airborne.

---

## Table of Contents

- [Vision](#vision)
- [Goals & Non-Goals](#goals--non-goals)
- [Core Features (MVP)](#core-features-mvp)
- [Tech Stack](#tech-stack)
- [Flight Model Philosophy](#flight-model-philosophy)
- [Architecture](#architecture)
- [Key Modules](#key-modules)
- [Controls (Planned)](#controls-planned)
- [HUD](#hud)
- [Asset Plan](#asset-plan)
- [Project Structure (Planned)](#project-structure-planned)
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

## Goals & Non-Goals

### Goals

| Goal | Why it matters |
|------|----------------|
| Feel good to fly on night one | Momentum over perfection |
| Convincing F-35 look | The fantasy sells on first glance |
| Lightweight & browser-native | No install, share a URL, stay fast |
| Expandable core | Add sound, particles, gear later without rewrite |

### Non-Goals (for now)

- Full aerodynamic fidelity / real stability derivatives  
- Global real-world terrain streaming  
- Multiplayer / networking  
- Complex systems (radar, weapons employment, fuel management, FMC, etc.)  
- Multi-aircraft fleet or mission editor  

These may be revisited after the MVP feels great to fly.

---

## Core Features (MVP)

- [ ] Flyable F-35 with a realistic GLTF/GLB model  
- [ ] Arcade-leaning flight model (thrust, gravity, basic lift/drag, simple stall, damping)  
- [ ] Keyboard + mouse controls (gamepad later)  
- [ ] Chase camera and cockpit camera  
- [ ] Basic HUD: airspeed, altitude, attitude, throttle, gear  
- [ ] Simple terrain + runway  
- [ ] Ground collision → crash + restart  
- [ ] Solid **60 fps** target in modern browsers  

### Nice-to-have after MVP

- Gear animation and landing gear physics  
- Afterburner / engine particles  
- Crash VFX and camera shake  
- Audio (engine loop, wind, touchdown, explosion)  
- Better terrain (heightmap or light procedural)  
- Gamepad support  
- Simple mission: takeoff → fly through gates → land  

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|--------|
| Rendering | **Three.js** (WebGL; WebGPU path later if useful) | Full control, huge ecosystem, easy high-quality aircraft models |
| Language | **TypeScript** | Safer iteration on flight math and scene graph |
| Build / dev | **Vite** | Instant HMR, simple static deploy |
| Physics | **Custom simplified forces** | No full engine required for MVP |
| Models | **GLTF / GLB** | Industry standard for Three.js |
| Optional later | **Rapier** | Only if rigid-body collisions outgrow raycasts |

**Why Three.js over a game engine?** Blackout is a focused flight toy, not a multi-scene RPG. Three.js keeps the stack thin, debuggable, and friendly to “open the repo and change a number” vibe coding.

---

## Flight Model Philosophy

**Arcade with a light coat of realism.**

Every simulation tick we roughly apply:

1. **Thrust** along the aircraft forward vector (scaled by throttle)  
2. **Gravity**  
3. **Speed-dependent lift and drag**  
4. **Simple stall** — nose drops when angle of attack gets too high  
5. **Angular damping** — so it doesn’t feel like a spaceship  
6. **Control rates** — pitch / roll / yaw inputs map to angular rates (not full control-surface CFD)

**No** coefficient tables. **No** high-fidelity stability derivatives. Just tunable constants until it feels right.

### Integration approach (planned)

- `requestAnimationFrame` outer loop  
- **Fixed timestep** for physics (e.g. 1/60 or 1/120 s) with accumulator  
- Render interpolation optional if we substep physics  

Pseudo-flow:

```
inputs → FlightModel.step(state, dt) → integrate position/orientation
       → collision check → camera update → HUD update → render
```

---

## Architecture

```
Main Loop (rAF + fixed timestep)
├── InputManager          # keyboard / mouse / later gamepad
├── Aircraft              # state + Three.js mesh
├── FlightModel           # forces, torques, integration
├── World / Terrain       # ground, runway, sky
├── CameraSystem          # chase + cockpit
├── HUD                   # overlay readouts
└── Collision / Crash     # ground hits, reset
```

### Data flow

```
User Input ──► InputManager ──► Aircraft.controls
                                      │
                                      ▼
                              FlightModel.step()
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              Aircraft mesh     CameraSystem          HUD
              (position/quat)   (chase/cockpit)   (speed/alt/…)
                    │
                    ▼
              Collision → CrashHandler → reset spawn
```

Keep modules **small and replaceable**. The flight model should not know about Three.js materials; the HUD should not integrate physics.

---

## Key Modules

### InputManager

Maps devices to a neutral control state:

| Action | Typical binding |
|--------|-----------------|
| Pitch | W/S or mouse Y |
| Roll | A/D or mouse X |
| Yaw | Q/E |
| Throttle | Shift/Ctrl or 1–0 / wheel |
| Gear toggle | G |
| Camera switch | C |
| Restart | R |

Output: normalized axes in `[-1, 1]` and buttons/toggles. No raw `KeyboardEvent` leakage into the flight model.

### Aircraft

Holds simulation + presentation glue:

- Position (`Vector3`), velocity, orientation (`Quaternion`)  
- Angular velocity  
- Current control inputs  
- Throttle (0–1), gear state  
- Reference to the Three.js F-35 mesh  
- Mass, reference area, and other scalar params used by the flight model  

### FlightModel

Pure-ish function of state + inputs + `dt` → updated state (or force/torque then integrate). Easy to unit-test with no WebGL.

### CameraSystem

- **Chase**: spring-follow, slightly above and behind; lag that sells speed  
- **Cockpit**: first-person, locked to aircraft (optional slight head bob later)  

### HUD

Canvas 2D or lightweight HTML/CSS overlay. Minimal and clean — no cluttered glass cockpit for MVP.

Suggested readouts:

- Airspeed (knots or m/s — pick one and stick to it)  
- Altitude (AGL or MSL simplified)  
- Attitude (horizon / pitch ladder lite)  
- Throttle %  
- Gear up/down  
- Optional: AoA warning, “STALL”, crash banner  

### World

- Flat or lightly procedurally generated terrain  
- One solid runway for takeoff/landing  
- Sky: Three.js `Sky` shader, or gradient + directional light sun  
- Fog for scale and performance  

### Collision / Crash

- Raycast or simple AABB/height vs ground  
- On hard impact: freeze or tumble briefly → “CRASH” → respawn at runway threshold with reset state  

---

## Controls (Planned)

Defaults (subject to change once playable):

| Input | Action |
|-------|--------|
| **W / S** | Pitch down / up *(or inverted option)* |
| **A / D** | Roll left / right |
| **Q / E** | Yaw left / right |
| **Shift / Ctrl** | Throttle up / down |
| **Mouse** | Optional look / secondary pitch-roll |
| **G** | Toggle landing gear |
| **C** | Toggle chase ↔ cockpit |
| **R** | Restart after crash (or anytime) |
| **Esc** | Pause / pointer unlock |

Gamepad mapping can mirror a dual-stick layout later (left stick pitch/roll, triggers throttle, face buttons gear/camera).

---

## HUD

Design principles:

1. **Readable at a glance** while flying  
2. **Non-diegetic is fine** for MVP (classic corner instruments OK)  
3. Prefer high-contrast, monochrome / muted military UI accents  

Layout sketch:

```
┌──────────────────────────────────────────┐
│  SPD  240    ALT  1200    thr  85%  GEAR │
│                                          │
│              [ attitude / horizon ]      │
│                                          │
│                     ·                    │
└──────────────────────────────────────────┘
```

---

## Asset Plan

| Asset | Priority | Notes |
|-------|----------|--------|
| F-35 GLTF/GLB | **P0** | Realistic at chase/cockpit distances; watch polycount & texture size |
| Runway mesh / markings | **P0** | Clear centerline + thresholds for landings |
| Terrain / ground | **P0** | Flat plane + texture or low-poly hills |
| Sky / lighting | **P0** | Daytime first |
| Afterburner particles | P2 | Visual throttle feedback |
| Crash FX | P2 | Smoke, debris optional |
| Audio | P2 | Engine, wind, touchdown, bang |

**Licensing:** Prefer CC0 / clear commercial-friendly or self-authored assets. Document sources in `assets/ATTRIBUTION.md` when added.

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
│   └── models/                 # drop f35.glb here (optional)
│       └── ATTRIBUTION.md
├── src/
│   ├── main.ts                 # bootstrap, rAF + fixed timestep loop
│   ├── style.css
│   ├── core/
│   │   ├── InputManager.ts
│   │   ├── Time.ts             # fixed timestep accumulator
│   │   └── types.ts
│   ├── aircraft/
│   │   ├── Aircraft.ts
│   │   ├── FlightModel.ts      # stub for Phase 1
│   │   └── createPlaceholderF35.ts
│   ├── world/
│   │   ├── World.ts            # scene, lights, terrain, runway
│   │   └── Runway.ts
│   ├── camera/
│   │   └── CameraSystem.ts     # orbit + follow
│   ├── ui/
│   │   └── HUD.ts
│   └── systems/
│       └── Collision.ts        # stub for Phase 2
├── index.html
├── package.json
├── tsconfig.json
└── README.md
```

---

## Development Phases

### Phase 0 – Skeleton ✅

- Vite + TypeScript + Three.js scene  
- Procedural F-35 placeholder (optional GLB load from `public/models/f35.glb`)  
- Orbit + follow camera  
- Free-fly WASD / QE movement smoke test  
- Minimal HUD (position, speed, camera, fps)  

**Exit:** Model visible, scene renders at ~60 fps, jet movable from keyboard.

### Phase 1 – Flight

- Hook up `FlightModel` + `InputManager`  
- Thrust, gravity, lift/drag, damping  
- Get airborne and controllable from the runway  

**Exit:** You can take off and fly a circuit by feel.

### Phase 2 – Feel

- Chase + cockpit cameras  
- HUD  
- Ground collision, stall behavior, basic landing  
- Tune until “feels like a jet toy,” not a physics paper  

**Exit:** Land or crash and restart without opening the console.

### Phase 3 – Polish

- Better terrain and lighting  
- Sound, particles, gear animation  
- Visual polish and juice  

**Exit:** Something you’d proudly send a friend a link to.

---

## Tuning Knobs

Expect these constants to live in one place (e.g. `FlightModel` config or `tuning.ts`) so iteration is painless:

| Parameter | Effect |
|-----------|--------|
| `maxThrust` | Acceleration / climb authority |
| `mass` | Inertia feel |
| `liftCoeff` / `dragCoeff` | Cruise speed & glide |
| `stallAoA` | When the nose falls off |
| `pitchRate` / `rollRate` / `yawRate` | Responsiveness |
| `angularDamping` | Stops spaceship spin |
| `cameraLag` / `cameraOffset` | Chase cam drama |
| `crashSpeedThreshold` | What counts as a landing vs crash |

**Rule of thumb:** If a tweak needs a PR description longer than one sentence, the architecture is fighting you — simplify the knob.

---

## Success Criteria

> You open the page, hit a key, and within **20–30 seconds** you are flying an F-35 that **looks the part** and **feels responsive**.

That is the primary metric for Blackout. Secondary: stable frame rate, restartable crashes, and a codebase a future-you can still enjoy editing at 1 a.m.

---

## Getting Started

### Prerequisites

- Node.js 20+ (LTS recommended)  
- npm, pnpm, or yarn  
- A modern browser (Chrome, Firefox, Edge, Safari)

### Install & run

```bash
npm install
npm run dev
```

Open the local URL Vite prints (typically `http://localhost:5173`).

### Phase 0 controls

| Input | Action |
|-------|--------|
| **W A S D** | Move forward / strafe / back |
| **Q / E** | Down / up |
| **Shift** | Boost |
| **1 / 2** | Throttle down / up (free-fly speed scale) |
| **LMB drag** | Orbit camera |
| **Scroll** | Zoom |
| **C** | Toggle orbit ↔ follow camera |
| **R** | Reset to spawn |

### Optional F-35 model

Drop a GLB at `public/models/f35.glb`. On boot, Blackout tries to load it and falls back to a procedural jet silhouette if missing. See `public/models/ATTRIBUTION.md`.

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

1. **Play first, optimize second** — get airborne before refactoring abstractions.  
2. **Tune constants in one file** — flight feel should be a slider culture, not a scavenger hunt.  
3. **Keep modules honest** — input ≠ physics ≠ render.  
4. **Commit small, descriptive chunks** — especially while the core is forming.  
5. **Don’t invent systems sim** — if it doesn’t help “feel good to fly,” defer it.

### Suggested commit style

Imperative mood, focused on *why* when useful:

```
Add fixed-timestep flight integration loop
Tune roll rate and angular damping for snappier banks
Wire chase camera spring follow
```

---

## License

TBD — decide before shipping public builds or third-party assets.

---

## Status

| Item | State |
|------|--------|
| Design / vision README | Done |
| Vite + Three.js scaffold | **Done (Phase 0)** |
| Free-fly + orbit/follow cam | **Done (Phase 0)** |
| Flight model | Not started (Phase 1) |
| Playable MVP | Not started |

**Next concrete step:** Phase 1 — hook up `FlightModel` (thrust, gravity, lift/drag, damping) and take off from the runway.

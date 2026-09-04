# Blackout

Browser-based arcade flight simulator. Pilot an F-35, take off, fly hard, and either land or crash in style.

Built with **TypeScript**, **Three.js**, and **Vite**. No install beyond a modern browser once the app is running.

## Features

- Title screen: Play, Controls, Game info
- Pause menu in flight (**Esc**): resume, fullscreen, quit to title
- Checkpoint circuit (5 rings; HUD arrow, range, and a beacon on the live gate)
- Arcade flight: nose-follows-path, ENG% is a speed target (50% ~ 500 kts)
- Inland spawn on naturally flat ground; short pad level for the strip; hangar and tower
- Crash boom (arcing fireballs) or scored landing; **R** new world
- Cameras: chase, close, cockpit (locked to the jet), wingman, orbit; speed FOV juice
- Middle-mouse look / pan, scroll zoom (not in cockpit)
- HUD: IAS to 1000 kts, ENG, ALT AGL, ADI, gear, weather/time
- Procedural F-35 with afterburner plume and gear (optional GLB)
- Engine rumble + wind hiss (Web Audio)
- Streaming terrain (~8 km), LOD, fog wall, day/night, weather (**N**), clouds
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
| **C** | Cycle camera |
| **N** | Weather |
| **R** | New world + runway |
| **Esc** | Pause menu |

**Takeoff:** Hold Shift to spool, build speed, then **W** to rotate. Gear is automatic. Engine percent is the speed you want (50% ~ 500 kts).

Landing is gentle with gear down. After the circuit, land to score. Hard impacts explode; press **R** for a new world. Retry the same course from pause or the results screen. Fullscreen is a click toggle in the pause menu.

## Optional aircraft model

Place a GLB at `public/models/f35.glb`. The app loads it on startup and falls back to the built-in procedural mesh if the file is missing. See `public/models/ATTRIBUTION.md` for licensing notes.

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
│   └── audio/               # engine/wind loops
├── CHANGELOG.md
├── index.html
├── package.json
└── README.md
```

## Roadmap

Shipped: flight, circuit, crash boom, airfield, menus, streaming world, day/night.

Next: vegetation v2, route clearance, handling retune.

Out of scope for now: radar, weapons, fuel.

## License

License TBD.

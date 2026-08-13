# Blackout

Browser-based arcade flight simulator. Pilot an F-35, take off, fly hard, and either land or crash in style.

Built with **TypeScript**, **Three.js**, and **Vite**. No install beyond a modern browser once the app is running.

## Features

- Title screen with how-to-play and full controls
- Checkpoint circuit (5 rings around the airfield; HUD RUN)
- Arcade flight model (thrust, lift, drag, stall lite, gear drag)
- Runway spawn and takeoff; crash / soft landing; **R** new world + runway
- Multi-mode camera (chase, close, cockpit, wingman, orbit) with speed FOV juice
- Middle-mouse look / pan, scroll zoom
- Flight HUD: IAS (to 1000 kts), engine power, altitude AGL, attitude (ADI), gear, weather/time
- Procedural F-35 with afterburner plume and gear show/hide (optional GLB)
- Infinite streaming terrain (~8 km) with LOD, fog wall, and fade-in tiles
- Day/night cycle, weather (**N**), sun/moon lighting, layered clouds
- Biomes: plains, forest, rainforest, desert, mesa, swamp, hills, mountain/snow, water/ocean
- Terrain features: rivers, ravines, dunes, mesas, coasts
- Fullscreen on Play (**Esc** / **F** toggle; click game if Esc cannot re-enter)

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

## Controls

| Input | Action |
|-------|--------|
| **W / S** | Pitch up / down |
| **A / D** | Yaw left / right |
| **Q / E** | Roll (Q right, E left) |
| **Shift** | Engine power up (min → max) |
| **Ctrl** or **1** | Engine power down (max → min) |
| **2** | Engine power up |
| **Space** | Afterburner boost |
| **G** | Toggle landing gear |
| **Hold MMB + drag** | Look / pan |
| **Scroll** | Zoom |
| **C** | Cycle camera mode |
| **N** | Cycle weather |
| **R** | New world + runway |
| **Esc** / **F** | Toggle fullscreen (in flight) |

**Takeoff:** Hold Shift to spool throttle, build speed down the runway, then pull **W** to rotate. Raise gear with **G** after liftoff.

Hold middle mouse to look. Landing is gentle with gear down; hard impacts crash (press R).

## Optional aircraft model

Place a GLB at `public/models/f35.glb`. The app loads it on startup and falls back to the built-in procedural mesh if the file is missing. See `public/models/ATTRIBUTION.md` for licensing notes.

## Project layout

```
Blackout/
├── public/
│   ├── favicon.svg
│   └── models/              # optional f35.glb
├── src/
│   ├── main.ts              # entry, render loop
│   ├── core/                # input, time, types
│   ├── aircraft/            # aircraft state, mesh, flight model stub
│   ├── camera/              # multi-mode camera
│   ├── world/               # scene, terrain, runway
│   ├── ui/                  # HUD overlay
│   └── systems/             # collision stub
├── index.html
├── package.json
└── README.md
```

## Roadmap

Shipped: arcade flight, landing/crash, HUD/ADI, streaming world, day/night and weather, title screen, afterburner and gear visuals.

1. **Aircraft identity** - procedural mesh and material polish (optional GLB stays secondary)
2. **Mission loop** - checkpoint gates, complete/fail state, restart integration
3. **World dress** - budgeted vegetation v2, airfield landmarks
4. **Juice** - engine/wind audio, event SFX, light crash VFX
5. **Ship** - performance pass, README accuracy, warning retune, attribution

Out of scope for now: radar, weapons, fuel systems.

## License

License TBD.

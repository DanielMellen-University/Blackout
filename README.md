# Blackout

Browser-based arcade flight simulator. Pilot an F-35, take off, fly hard, and either land or crash in style.

Built with **TypeScript**, **Three.js**, and **Vite**. No install beyond a modern browser once the app is running.

## Features

- Arcade flight model (thrust, lift, drag, stall lite, gear drag)
- Runway spawn and takeoff (throttle up, gain speed, pull nose)
- Crash / soft landing detection with restart
- Multi-mode camera: chase, close chase, cockpit, wingman, orbit
- Middle-mouse look / pan, scroll zoom, idle camera recenter
- Flight HUD: speedometer (IAS), engine power gauge (min–max), altitude, gear, air/ground
- Procedural F-35 mesh (optional custom GLB)
- Infinite streaming terrain with biomes (plains, forest, desert, hills, mountains, snow, water)
- Long fog horizon and large render distance

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
| **R** | Reset to runway |

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

1. **Flight model** - thrust, gravity, lift/drag, stall, damping
2. **Landing and crash** - ground collision, restart flow
3. **Flight HUD** - airspeed, altitude, attitude, throttle, gear
4. **Polish** - audio, particles, improved mesh or production GLB

## License

License TBD.

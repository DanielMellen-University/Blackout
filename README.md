# Blackout

Browser-based arcade flight simulator. Pilot an F-35, take off, fly hard, and either land or crash in style.

Built with **TypeScript**, **Three.js**, and **Vite**. No install beyond a modern browser once the app is running.

## Features

- Title screen: Play, Controls, Game info
- Pause menu in flight (**Esc**): resume, fullscreen, quit to title
- Checkpoint circuit (5 rings; HUD arrow, range, and a beacon on the live gate)
- Arcade flight: nose-follows-path, ENG% is a speed target (50% ~ 1500 kts)
- Inland spawn on naturally flat ground; short pad level for the strip; hangar and tower
- Crash boom (arcing fireballs) or scored landing; **R** new world
- Cameras: stable external chase and cockpit view, toggled with **C**
- Middle-mouse look / pan, scroll zoom (not in cockpit)
- HUD: IAS to 3000 kts (50% ENG ~ 1500, 100% ~ 3000), ENG, ALT AGL, ADI, gear, weather/time. Acceleration and deceleration respond 5× faster.
- Rebuilt F-35-style airframe with canted tails, intake throats, gold canopy, articulated landing gear, and a soft single-engine afterburner
- Engine rumble + wind hiss (Web Audio); short event cues for afterburner engage, gates, touchdown, and crash
- Infinite geographic provinces: broad alpine massifs, smooth green hills, dunes, weathered mesas, basalt uplands, salt flats, tundra, savanna, forests and rainforest regions.
- Landforms have distinct regional families: long rounded ridge chains with carved alpine valleys, dry plateaus and terraces, dune fields, and rare smooth volcanic cones with calderas. Green lowlands remain rolling instead of needle-like.
- Water is an independent surface with variable basin counts, irregular coves, narrower inland seas, bent rivers with deterministic tributaries, teal shallows, deep blue channels, shoreline foam tint, and animated glints.
- Terrain vertex colors now carry the landform signal too, giving ridges, alpine valleys, plateaus, and calderas distinct readable shading even on distant low-detail tiles.
- Mostly dry land with uncommon enclosed seas, irregular lakes, and meandering rivers that vary in width and descend from lake outlets to sea level. Water is separate geometry over a sediment bed, with calm reflections and fine ripples.
- Streaming terrain (16.8 km radius), adaptive detail tiles and smoothly blended biomes. Trees and rocks remain temporarily disabled.
- Terrain generation is frame-budgeted; cached catchments, spatially indexed river reaches, and coarse distant tiles keep generation and draw calls bounded. Rendering resolution adapts gradually under sustained load.
- Weather fronts now move through plausible neighboring states with smooth fog, light, cloud-deck and wind transitions. Clear, fog, rain, thunderstorms, snow and blizzards each have distinct visibility and precipitation. Layered clouds render in three instanced batches. Press **N** to cycle weather manually.
- Terrain materials respond to the same blended precipitation values: rain darkens the ground and snow adds altitude-aware cool cover without rebuilding streamed chunks.
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

The terrain review includes fixed-seed destinations for smooth green hills,
alpine massifs, irregular lakes, river valleys, inland seas and badlands, plus a
flight benchmark at either 400 m/s or the current maximum afterburner speed,
with draw counts and frame timings. Streaming prioritizes contact detail, then
missing coverage and coarse replacements, before distant detail rebuilds.
Geography is deterministic for a seed and coordinate; this generator changes old landscapes.
Seas sit at zero elevation; each lake has its own level below the surrounding
rim. River reaches descend between those levels. Shallow water carries moving,
low-contrast foam breakup instead of a uniform shoreline. This is procedural drainage,
not a rainfall or fluid simulation.

Rare procedural cities and more frequent villages occupy suitable dry terrain.
Villages range from compact hamlets to several-kilometre ribbon, crossroads and
basin settlements; the rarest cities span roughly 17-20 km and contain 650-1,300
buildings. Organic branches,
dead ends and broken district connectors replace repeated grids. Building
footprints, heights, stepped/octagonal silhouettes, rooflines and biome palettes
vary by world seed, using deliberately exaggerated scale for readability from the jet.
Settlement placement runs in a background worker; buildings and roofs are
instanced, with ground detail culled at distance. Trees and rocks remain disabled.
The terrain review includes city/village destinations and a Flight scale view
using the game's actual chase camera and aircraft.
Selected nearby settlements are joined by sparse regional roads rather than a
uniform world grid. Routes choose a curved terrain path, follow a bounded grade,
and lift into bridge or viaduct approaches across water and deep folds. Highway
centerlines and edge strips keep those links readable at flight distance.
Local district roads also receive a single batched centerline pass for readable
street networks at flight distance.

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
│   └── audio/               # engine/wind loops + event cues
├── CHANGELOG.md
├── index.html
├── package.json
└── README.md
```

## Roadmap

Shipped: flight, circuit, crash boom, airfield, menus, streaming world, day/night.

Next: performance pass, vegetation v2 (still disabled until budgeted), warning retune.

Out of scope for now: radar, weapons, fuel.

## License

License TBD.

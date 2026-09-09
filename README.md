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
- Infinite geographic provinces: broad alpine massifs, smooth green hills, dunes, weathered mesas with stepped shelves, basalt uplands, salt flats, tundra, savanna, forests and rainforest regions.
- Landforms have distinct regional families: long rounded ridge chains with carved alpine valleys, dry plateaus and terraces, dune fields, and rare smooth volcanic cones with calderas. Green lowlands remain rolling instead of needle-like.
- Water is an independent surface with variable basin counts, irregular coves, narrower inland seas, bent rivers with deterministic tributaries, teal shallows, deep blue channels, shoreline foam tint, and animated glints.
- Water shares precipitation uniforms with terrain: rain roughens ripple and foam motion while snow cools the surface without rebuilding clipped water meshes.
- Cities use landmark-only tower cores surrounded by slabs, industrial halls, blocks, stepped forms, and broader biome-specific color palettes.
- Terrain vertex colors now carry the landform signal too, giving ridges, alpine valleys, plateaus, and calderas distinct readable shading even on distant low-detail tiles.
- Snow and mountain palettes add stable exposed-rock bands and cool alpine-valley shading so high relief stays readable instead of becoming one white sheet.
- Mostly dry land with uncommon, compact inland seas, irregular lakes, and meandering rivers that vary in width and descend from lake outlets to sea level. Water is separate geometry over a sediment bed, with calm reflections and fine ripples.
- Streaming terrain (16.8 km radius), adaptive detail tiles and smoothly blended biomes. Trees and rocks use bounded instanced streaming in the near field.
- Terrain generation is frame-budgeted; cached catchments, spatially indexed river reaches, and coarse distant tiles keep generation and draw calls bounded. Rendering resolution adapts gradually under sustained load.
- Weather fronts now move through plausible neighboring states with smooth fog, light, cloud-deck and wind transitions. Clear, fog, rain, thunderstorms, snow and blizzards each have distinct visibility and precipitation. Layered clouds render in three instanced batches. Press **N** to cycle weather manually.
- Terrain materials respond to the same blended precipitation values: rain darkens the ground and snow adds stronger altitude/slope-aware cool cover without rebuilding streamed chunks. Snowfall uses varied soft flakes in one pooled pass so it remains readable at flight scale.
- Settlement streets and bridge decks use the same blended precipitation values, so roads wet and cool with the terrain.
- Settlement facades and roof materials share those precipitation uniforms, darkening in rain and collecting cool snow on horizontal surfaces.
- Building window grids also share the day/night factor, staying subdued by day and warming into low-cost city lights after sunset.
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
Foothill shoulders also receive a restrained olive/stone material band, making
the mountain-to-lowland transition readable without new geometry or noise calls.
Alpine ranges use narrower ridge spines, deeper winding valleys, and multi-scale
summit folds plus a bounded peak-and-saddle sculpt so high terrain breaks into
distinct flyable peaks instead of broad tables. Snow and mountain faces use
stronger deterministic rock bands, altitude exposure, and cool valley contrast
so the existing relief remains readable at flight distance without extra terrain
geometry or noise calls.
Seas sit at zero elevation; each lake has its own level below the surrounding
rim. River reaches descend between those levels. Shallow water carries moving,
low-contrast foam breakup instead of a uniform shoreline, while river ribbons carry
direction-aware moving riffles, variable widths, tapered tributary ends, and
broken bank foam. Rivers receive a stronger depth/color response so they do not
read as pale uniform strips at flight scale. This is procedural drainage, not a
rainfall or fluid simulation.
Non-mouth tributaries use staged, slightly submerged endpoint tapers so streamed
river pieces fade into their channel instead of ending as flat-cut ribbons.
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
Larger villages can also receive a small instanced civic spire or dome, giving
their varied footprints a recognizable center without adding per-building
draws. Every settlement reserves a deterministic central plaza or village
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

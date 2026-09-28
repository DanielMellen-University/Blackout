# Blackout

Browser arcade flight game. Pilot an F-35, take off, fly a short gate run low enough to see the ground, and land or crash.

Built with TypeScript, Three.js, and Vite.

Current release: **v0.12.0** (`Systems expansion`).

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. `npm test` runs the suite. `npm run build` typechecks and builds. World replacement is transactional: a failed rebuild rolls back to a usable streamed world instead of leaving the runway over an empty scene.

## Aircraft and weather

The procedural F-35 has a shaped gold canopy, recessed intakes, separate rudders, animated landing gear and exhaust, and batched surface detail. Engine thrust, fuel burn, audio, plume, and HUD all share the same finite-safe afterburner gate. The first-person view remains unobstructed.

Weather transitions blend layered cloud cover, wind, precipitation, lighting, and visibility. Clouds fade at full size, shade toward the sun, and reduce visibility when you fly through them. The HUD calls out cloud edges, entry, and breaks, the cockpit veil adds a subtle cloud mist, and the existing audio bed responds to gusts while gently muffling wind and precipitation inside formations without adding nodes. Rain streaks drift through world space; precipitation and overhead cover clear above the cloud tops. Meaningful rain, snow, or strong gusts add a restrained camera and airframe buffet that stays quiet under reduced-motion preferences. Stormy nights receive a small bounded exposure lift so terrain silhouettes stay readable without brightening clear nights or daytime. Nearby traffic now gets a short audio double-pulse alongside its directional alert. Graphics presets retain bounded cloud and precipitation pools.

Protected villages now sit inside a nearer discovery band, while the guaranteed city remains a farther regional landmark. Radar target cycles now have restrained lock and lock-loss chirps alongside the existing HUD banners. Water keeps rich close-range flow and foam detail but fades high-frequency shimmer before the fog edge, and its independent surface is depth-biased to avoid shoreline speckle. Use `/dev/aircraft.html` for orbit views and gear/afterburner checks, or `/dev/terrain.html` for weather presets, flight-scale inspection, and frame-time measurements.

## Fly

Press Play when the airfield is ready.

- W / S pitch
- A / D yaw
- Q / E roll
- Shift raises the throttle, Ctrl lowers it
- Space is afterburner
- B is the speed brake, and the wheel brake on the ground
- C cycles chase, orbit, and cockpit
- MMB looks around; camera sensitivity, speed framing, auto-return, and separate audio mixes are adjustable in the pause menu
- Esc pauses

The nose is the flight path. Throttle is thrust: a climb spends speed, and closing the throttle slows you down. Afterburner is the burst that gets it back.

## A sortie

The cue at the top of the screen points at the next gate. Fly through the rings, then bring the jet back to the runway. A landing scores the run. A crash ends it. From the results card, retry the same course or start a new world. Curated routes include orbit, sweep, slalom, ridge, canyon, coastal, river, volcanic, and desert runs.

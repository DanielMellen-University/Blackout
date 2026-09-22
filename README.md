# Blackout

Browser arcade flight game. Pilot an F-35, take off, fly a short gate run low enough to see the ground, and land or crash.

Built with TypeScript, Three.js, and Vite.

Current release: **v0.11.0** (`Systems expansion`).

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. `npm test` runs the suite. `npm run build` typechecks and builds.

## Fly

Press Play when the airfield is ready.

- W / S pitch
- A / D yaw
- Q / E roll
- Shift raises the throttle, Ctrl lowers it
- Space is afterburner
- B is the speed brake, and the wheel brake on the ground
- C cycles chase, orbit, and cockpit
- Esc pauses

The nose is the flight path. Throttle is thrust: a climb spends speed, and closing the throttle slows you down. Afterburner is the burst that gets it back.

## A sortie

The cue at the top of the screen points at the next gate. Fly through the rings, then bring the jet back to the runway. A landing scores the run. A crash ends it. From the results card, retry the same course or start a new world.

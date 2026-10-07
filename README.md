# Blackout

Browser arcade flight game. Pilot an F-35, take off, fly a gate run, and land or crash. New pilots start in Training Orbit. Explore procedural mountains, waterways, cities, and villages, or chase medals and personal bests in authored courses and rotating Ops.

Current release: **v0.12.0** (`Systems expansion`). Roadmap chunk: **10.849**. Previous roadmap chunk: **10.848**.
Recent changes from **10.849**. Remove the floating nose lamp, wingtip vapor, Mach cone, speed streaks, and visual sonic-boom ring. Keep the afterburner, animated gear, aircraft lights, weather, and sonic-boom sound; flight handling is unchanged.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. Run `npm test` for the suite and `npm run build` for version checks, TypeScript, and the production build.

Run `npm run perf:terrain -- --seed=42 --samples=16` for a CPU geometry profile that closes on completion. Add `--sliced` to report individual work-step costs. It does not measure FPS; see [streaming performance notes](docs/terrain-streaming-performance.md) for scope and recorded samples.

## Fly

Default keyboard controls:

- W / S pitch, A / D yaw, Q / E roll
- Shift / Ctrl raise or lower throttle
- Space afterburner; B speed brake and wheel brake
- G landing gear; V stability assist
- C cycles chase, orbit, and cockpit; middle mouse looks around
- P or Escape pauses; R resets the mission
- N cycles weather; T cycles radar targets; X toggles ghost replay

Keyboard mappings, camera, graphics, audio, and reduced motion are adjustable in the pause menu. Standard gamepads also support the core flight controls.

A mission is one flight attempt, from launch until landing or a crash. Clear the gates, follow the return cue to the airfield, and land to bank your score. After a landing or crash, retry the same course or choose another. Infinite World and custom seeds let you revisit procedural worlds; Daily, Weekly, and Monthly Ops share rotating challenges. Records, favorites, and best-run ghosts are saved locally.

## Project

Built with TypeScript, Three.js, and Vite. Graphics presets and adaptive resolution scale visual detail. Terrain and settlements stream through bounded worker queues, with synchronous fallback when workers are unavailable.

- [Project overview](docs/PROJECT_OVERVIEW.md)
- [Roadmap](docs/ROADMAP.md)
- [Changelog](CHANGELOG.md)

Use `/dev/aircraft.html` for model inspection, `/dev/terrain.html` for terrain and weather review, and `/dev/debrief.html` for lightweight landing-feedback review without terrain or WebGL.

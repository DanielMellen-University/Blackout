# Blackout

Browser arcade flight game. Pilot an F-35, take off, fly a gate run, and land or crash. New pilots start in Training Orbit. Explore procedural mountains, waterways, cities, and villages, or chase medals and personal bests in authored courses and Daily challenge.

Current release: **v0.12.0** (`Systems expansion`). Roadmap chunk: **10.951**. Previous roadmap chunk: **10.950**.

Recent changes from **10.951**. Set the approved priority order to terrain, flight physics then nitro/boost, randomly generated terrain-shaped missions, and gameplay. Record the b18 through b21 plan, approval rule and current-mission polish freeze. Preserve paused exclusions, the approximate 200 MB heap target and closed city/roads redesign.

Recent changes from **10.950**. Repair CI by retaining the shipped accessible AGL description in instrument tests and trimming older README history to the changelog. Preserve neutral altitude readings, flight physics and all paused exclusions.

Recent changes from **10.949**. Polish existing flight reports so crash and ditch outcomes are clear and each failure reason appears once, while preserving score, coaching, retry and record behavior. Correct the featured-mission documentation to include the already-shipped Contour circuit. Add no features or mission types. See docs/reviews/debrief-10.949/README.md for focused tests and browser evidence.

Recent changes from **10.948**. Record six isolated, unprofiled 120-second city and northeast flights on the shipped 10.947 runtime. Pooled means are 39.01 and 38.33 FPS, p95 is 33.4 ms on both routes, and no flight interval exceeds 100 ms. Main-thread JS heap peaks range from 187.3 to 208.9 MB; one run exceeds the approximate 200 MB reference. Make no performance changes or improvement claim. See docs/reviews/performance-10.948/README.md for all runs and limits.

Recent changes from **10.947**. Fix focused debrief activation, restore controller retry and mission selection with release gating, and extinguish fuel-empty exhaust. Verify crash recovery, go-around, engine-out landing and keyboard/controller rollout without changing flight physics or collision. See docs/reviews/recovery-10.948/README.md for evidence and limits.

Recent changes from **10.946**. Polish cloud boundaries on existing meshes, correct port and starboard navigation lights, and label terrain-relative altitude AGL. Complete two ten-minute Free flights on seeds 31415 and 27182 with chase and cockpit stills every minute, plus matched before/after views. Preserve physics, collision, water, landscape revision 29, route revision 30, all resource budgets and paused exclusions. See docs/reviews/polish-10.946/README.md.

Earlier delivery notes are in [CHANGELOG.md](CHANGELOG.md).

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
- G landing gear; V light stability assist (trim resumes two seconds after releasing yaw/roll)
- C cycles chase, orbit, and unobstructed first person; middle mouse looks around in external views
- P or Escape pauses; R ends the flight and generates a new world
- N cycles weather; T cycles radar targets; X toggles ghost replay

Keyboard mappings, camera, graphics, audio, and reduced motion are adjustable in the pause menu. Standard gamepads also support the core flight controls.

Open **Controls** or **Flight manual** from the launch screen or pause menu. Controls follows your configured axis directions and action keys. The manual covers takeoff, handling, instruments, missions, landing, and exploration. Back or Escape returns to launch; when opened during flight, it returns to paused settings. Use **Retry same course** in Pause to restart the current mission, or Enter from results/the crash cinematic.

A mission is one flight attempt, from launch until landing or a crash. Clear the gates, follow the return cue to the airfield, and land to bank your score. After a landing or crash, retry the same course or choose another. Random world and custom seeds let you revisit procedural worlds; Daily challenge offers shared conditions. Records, favorites, and best-run ghosts are saved locally.

## Mission picker

Launch and Pause > Next mission share a featured row: **Free flight**, **Training orbit**, **Daily challenge**, **Contour circuit**. **Random world** stays first in the scrollable grid. Search, categories, sorting, counts, and empty messages apply only to the remaining missions; featured cards and Random world always remain visible. Choosing a card prepares the mission without launching it. Arrow keys follow the displayed rows; Home/End reach the first/last visible card, and Enter/Space select it.

Regular mission cards have an independent star in the top-right: navy when unsaved, orange when favorited. Clicking a star never selects or launches that mission. Select a regular mission and press F, or Tab to its star and use Enter/Space. Favorites share existing saved data across both pickers. Featured modes and Random world have no stars. The launch panel stays centered and fully bounded; shorter windows scroll its columns internally. The takeoff brief below pilot rank follows your configured controls.

Weekly and Monthly modes are hidden from browsing. Saved selections of these modes fall back to Training orbit; old records and explicit replay links remain supported. A saved Ops filter falls back to All courses.

Free flight has no mission goals or score. Land and take off again without ending the session. Its Flight systems card and mission progress/records are hidden; speed, engine, altitude, attitude, and optional landmark navigation remain available. Crash cinematics still play, followed by a simple restart screen. Other modes keep their mission UI and scoring.

Daily challenge displays a wall-clock countdown to midnight EST (fixed UTC-5, year-round). This countdown is UI-only preparation: challenge seeds, weather, routes, record keys, replays, and the actual UTC rollover are unchanged. Wiring the actual reset to EST and adding unique world-generation conditions per mission are deferred to the next phase.

## Project

The connected basin router is enabled in the shared world generator. Run `node scripts/profile-drainage.mjs` for the reproducible CPU-only three-seed length comparison against 10.881. The full water overhaul is still in progress: angular shoreline details, cold-generation cost, and controlled foreground performance review remain open. See [water surface review](docs/water-surface-review.md).

Vegetation (trees, rocks, and other natural props) is removed and development is paused. Do not restore or develop it unless explicitly requested; see [repository rules](AGENTS.md) and [roadmap exclusions](docs/ROADMAP.md#paused-systems).

Built with TypeScript, Three.js, and Vite. Graphics presets and adaptive resolution scale visual detail. Terrain and settlements stream through bounded worker queues, with synchronous fallback when workers are unavailable.

- [Project overview](docs/PROJECT_OVERVIEW.md)
- [Roadmap](docs/ROADMAP.md)
- [Changelog](CHANGELOG.md)

Use `/dev/aircraft.html` for model inspection, `/dev/terrain.html` for terrain and weather review, and `/dev/debrief.html` for lightweight landing-feedback review without terrain or WebGL.

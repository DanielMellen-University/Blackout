# Blackout

Browser arcade flight game. Pilot an F-35 through gate runs that start and finish in the air, or take off and land in Free flight. New pilots start in Training Orbit. Explore procedural mountains, waterways, cities, and villages, or chase medals and personal bests in authored courses and Daily challenge.

Current release: **v0.12.0** (`Systems expansion`). Roadmap chunk: **11.044**. Previous roadmap chunk: **11.043**.

Recent changes from **11.044**. Lake shores flare smoothly into joined river mouths instead of meeting them at a hard corner, and the seed-73 pond outlet no longer leaves a grass strip between two water surfaces. Water, carving and collision share the fitted shoreline. Cold regional generation for the measured seed-73 region costs about 55% more CPU, with the largest cooperative step unchanged at about 6.3 ms. See [water surface review](docs/water-surface-review.md). From **11.043**: The review pilot defers cold hydrology look-ahead work without changing generated output. Node median largest slices move from 46.10 to 2.40 ms; an isolated browser check moves from 41.15 to 5.65 ms, with higher total CPU. SwiftShader flight attempts remain incomplete, so no FPS gain or completed 10.989 re-verification is claimed. See [performance review](docs/reviews/performance-11.043/README.md).

Earlier delivery notes are in [CHANGELOG.md](CHANGELOG.md).

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. Run `npm test` for the suite, `npm run typecheck` for a TypeScript check without building, and `npm run build` for version checks, TypeScript, and the production build.

Use Node 22, the version CI runs (`.nvmrc` pins it for nvm and fnm, and a test keeps the CI version in step with it). A few hydrology snapshot tests hash generated geometry, and newer Node releases round some math differently, so those hashes can fail locally on Node 24 while CI passes.

Run `npm run perf:terrain -- --seed=42 --samples=16` for a CPU geometry profile that closes on completion. Add `--sliced` to report individual work-step costs. It does not measure FPS; see [streaming performance notes](docs/terrain-streaming-performance.md) for scope and recorded samples. Run `npm run perf:operation` to remeasure the ridge relay. That records simulated flight time, not FPS.

## Fly

For the b32 developer feel test, add `?dev=perfect-line` to the URL to reveal **Perfect Line (prototype)** on the title screen. Start airborne at 150 m/s, follow 15 gates down the canyon and finish in the air. Press **R** any time to retry immediately. Results are transient and do not affect mission records.

Add `?dev=operation` to launch **Ridge relay** from the flight plan. It opens in the cockpit, with the stage HUD over the view and the gates and altitude band drawn on the line you are scored against. Fly each leg yourself or leave the model on the controls. Stick mode uses W/S pitch, A/D roll, Q/E rudder, Shift/Ctrl power and Space nitro, and a standard gamepad does the same. After ingress choose valley or ridge; after transit choose conserve or commit. The results show the score, medal, best and a per-stage breakdown. Replay plays the saved transcript on that HUD. The featured row stays Free flight, Training orbit and Daily challenge, and the course catalog stays at 82.

`OperationSession.exportReplay()` returns the latest completed replay as a JSON string, or `null` when unavailable. It also works after reloading the saved session. The pure `exportLatestOperationReplay(progress)` helper accepts stored progress. Save that string to a file, then run `npm run verify:operation -- <file>` with Node 22 and the installed project dependencies. Exit codes are 0 for a score match, 1 for a mismatch and 2 for unreadable or invalid input. Try `npm run verify:operation -- docs/reviews/operation-11.040/seed-42-valley-commit.replay.json`. Files are limited to 16 MiB of UTF-8 and 32 JSON container levels. Invalid input reports a reason and exact field path; usage/read errors go to stderr. The file includes a canonical-content checksum and exact samples; the summary model includes stage measurements, gates, medal and decisions. See [replay file review](docs/reviews/operation-11.040/README.md).

Default keyboard controls:

- W / S pitch, A / D yaw, Q / E roll
- Shift / Ctrl (or 2 / 1) raise or lower throttle
- Space afterburner with nitro (5 s reserve, 20 s refill, 125% total gate refill budget shared across the run); B speed brake and wheel brake
- G landing gear; V light stability assist (trim resumes two seconds after releasing yaw/roll)
- C cycles chase, orbit, and unobstructed first person; middle mouse looks around in external views
- P or Escape pauses; R ends the flight and generates a new world (Perfect Line: instant same-line retry)
- N cycles weather; T cycles radar targets; X toggles ghost replay
- M mutes or unmutes audio; Y copies a replay link for the current world

Keyboard mappings, camera, graphics, audio, and reduced motion are adjustable in the pause menu. Space, B and G can be moved to another key there; picking a key another action already uses swaps the two.

Standard gamepads (Xbox / PlayStation layout): left stick pitch and roll, right stick yaw; RT / R2 and LT / L2 raise and lower throttle; A / Cross afterburner; LB / L1 speed brake; X / Square gear; Y / Triangle camera; B / Circle flight assist; View / Share mute; Start / Options pause; D-pad up weather, down new world, left ghost, right radar target. On results, A / Cross retries and B / Circle chooses a mission.

Open **Controls** or **Flight manual** from the launch screen or pause menu. Controls follows your configured axis directions and action keys. The manual covers takeoff, handling, instruments, missions, landing, and exploration. Back or Escape returns to launch; when opened during flight, it returns to paused settings. Use **Retry same course** in Pause to restart the current mission, or Enter from results/the crash cinematic.

A gated mission is one flight attempt, from launch until the final gate or a crash. Pass the last gate to finish and bank your score in the air. After a finish or crash, retry the same course or choose another. Random world and custom seeds let you revisit procedural worlds; Daily challenge offers shared conditions. Records, favorites, and best-run ghosts are saved locally.

## Mission picker

Launch and Pause > Next mission share a featured row: **Free flight**, **Training orbit**, **Daily challenge**. **Contour circuit** and **Weather circuit** are in the course list; **Perfect Line (prototype)** is hidden unless `?dev=perfect-line` is set. **Ridge relay** is hidden unless `?dev=operation` is set, and it launches immediately instead of joining the catalog. **Random world** stays first in the scrollable grid. Search, categories, sorting, counts, and empty messages apply only to the remaining missions; featured cards and Random world always remain visible. Choosing a mission card prepares it without launching; Perfect Line uses its existing immediate launch. Arrow keys follow the displayed rows; Home/End reach the first/last visible card, and Enter/Space select it.

Regular mission cards have an independent star in the top-right: navy when unsaved, orange when favorited. Clicking a star never selects or launches that mission. Select a regular mission and press F, or Tab to its star and use Enter/Space. Favorites share existing saved data across both pickers. Featured modes and Random world have no stars. The launch panel stays centered and fully bounded; shorter windows scroll its columns internally. The takeoff brief below pilot rank follows your configured controls.

Weekly and Monthly modes are hidden from browsing. Saved selections of these modes fall back to Training orbit; old records and explicit replay links remain supported. A saved Ops filter falls back to All courses.

Free flight has no mission goals or score. Land and take off again without ending the session. Its Flight systems card and mission progress/records are hidden; speed, engine, altitude, attitude, and optional landmark navigation remain available. Crash cinematics still play, followed by a simple restart screen. Other modes keep their mission UI and scoring.

Daily challenge displays a countdown to UTC midnight, when the challenge resets.

## Project

The connected basin router is enabled in the shared world generator. Run `node scripts/profile-drainage.mjs` for the reproducible CPU-only three-seed length comparison against 10.881. The full water overhaul is still in progress: far coast stair-steps and controlled foreground performance review remain open. Angular lake mouths and pond outlet strips are fixed in 11.044, which also records the cold-generation cost. See [water surface review](docs/water-surface-review.md).

Vegetation (trees, rocks, and other natural props) is removed and development is paused. Do not restore or develop it unless explicitly requested; see [repository rules](AGENTS.md) and [roadmap exclusions](docs/ROADMAP.md#paused-systems).

Built with TypeScript, Three.js, and Vite. Graphics presets and adaptive resolution scale visual detail. Terrain and settlements stream through bounded worker queues, with synchronous fallback when workers are unavailable.

- [Project overview](docs/PROJECT_OVERVIEW.md)
- [Roadmap](docs/ROADMAP.md)
- [Changelog](CHANGELOG.md)
- [Water surface review](docs/water-surface-review.md)
- [Terrain streaming performance](docs/terrain-streaming-performance.md)

Use `/dev/aircraft.html` for model inspection, `/dev/terrain.html` for terrain and weather review, and `/dev/debrief.html` for lightweight landing-feedback review without terrain or WebGL.

# Blackout

Browser arcade flight game. Pilot an F-35, take off, fly a gate run, and land or crash. New pilots start in Training Orbit. Explore procedural mountains, waterways, cities, and villages, or chase medals and personal bests in authored courses and Daily challenge.

Current release: **v0.12.0** (`Systems expansion`). Roadmap chunk: **10.965**. Previous roadmap chunk: **10.964**.

Recent changes from **10.965**. Add the approved b21 nitro reserve, a stronger 650 m/s boost, gate refills and empty-edge hysteresis. Separate revision 32 records and ghosts while retaining older families. Preserve dry b20 physics and paused exclusions. See docs/reviews/nitro-b21/README.md.

Recent changes from **10.964**. Close the approved b20 physics half of roadmap step 2 after the lift/drag/stall and control-rate retune, revision 31 record isolation, compatibility fixes and 78 verified browser flights. Keep nitro and boost OPEN for b21, preserve all paused exclusions and leave the closed terrain and city/roads work unchanged. Synchronize release metadata. See docs/reviews/physics-b20/README.md.

Recent changes from **10.963**. Verify b20 in 78 production browser flights with 328 accepted stills: every one of the 76 non-Free mission entries completes five gates and lands, and Free flights on seeds 42 and 73 perform hard turns, stall/recovery, climbs/dives and full runway stops. Retain source/hook hashes, all excluded attempts and clean isolated audio repeats. Preserve missions, terrain, boost and paused exclusions. See docs/reviews/physics-b20/README.md.

Recent changes from **10.962**. Fix two b20 compatibility regressions found in production browser review. Derive the 80 kt takeoff brief from the configured rotation speed and keep revision 31 Free flight unscored and open after landing. Preserve all physics numbers, routes, records and boost behavior. Browser completion evidence continues in docs/reviews/physics-b20/README.md.

Recent changes from **10.961**. Retune jet lift, drag, stall progression and roll/pitch response for b20. Charge turn drag from the flight-path bend, preserve dry cruise and existing afterburner behavior, and recover low-speed stalls with power and forward stick. Store revision 31 records and ghosts separately, label retained pre-b20 records and exempt them from pruning. Pin numerical probes and historical terrain evidence to their proper runtimes. Browser flight verification follows. See docs/reviews/physics-b20/README.md.

Recent changes from **10.960**. Remove the ripgrep dependency from terrain close-out evidence validation. Enumerate source files with Git, preserving the frozen-runtime hashes and every evidence acceptance rule. Verify focused evidence checks, the full suite and the production build before the b20 physics retune.

Recent changes from **10.959**. Mark roadmap step 1 DONE for the scoped b19 terrain good-enough bar. Retain the six-seed appearance and normal-altitude LOD decisions, and three clean ten-minute flights on seeds 42, 73 and 1. Preserve the seed-1337 review-harness issue, excluded alternate-seed stalls and high-altitude image limitation in the final report. Synchronize release metadata without changing production physics or terrain. No b20 work starts. See docs/reviews/terrain-closeout-b19/final-report.md.

Recent changes from **10.958**. Record the third clean 650-second flight on seed 1 with the original review pilot and acceptance rules. Exclude the full seed-2026 and seed-9001 attempts for timing gaps, retaining all 66 stills. Validate all 21 required records and guard alternate-route, diagnostic, duration, coverage and timing acceptance. Keep production physics and terrain unchanged. See docs/reviews/terrain-closeout-b19/b19s-endurance.md.

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

Launch and Pause > Next mission share a featured row: **Free flight**, **Training orbit**, **Daily challenge**, **Contour circuit**, **Weather approach**. **Random world** stays first in the scrollable grid. Search, categories, sorting, counts, and empty messages apply only to the remaining missions; featured cards and Random world always remain visible. Choosing a card prepares the mission without launching it. Arrow keys follow the displayed rows; Home/End reach the first/last visible card, and Enter/Space select it.

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

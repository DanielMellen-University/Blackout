# Blackout

Browser arcade flight game. Pilot an F-35, take off, fly a gate run, and land or crash. New pilots start in Training Orbit. Explore procedural mountains, waterways, cities, and villages, or chase medals and personal bests in authored courses and Daily challenge.

Current release: **v0.12.0** (`Systems expansion`). Roadmap chunk: **10.938**. Previous roadmap chunk: **10.937**.

Recent changes from **10.938**. Reproduce the seed-73 Free flight ridge strike at exactly 616.5 seconds, within 0.063 m of the original record. Capture the authoritative climbing impact and 26.249-degree slope, with resident/analytic ground agreeing within 7.5 mm. Preserve physics and collision; the existing eight-kilometre review pilot separately completes 653.7 seconds. Add generated contact/classification regressions and an isolated city-route FPS/stutter sample. Preserve landscape revision 29, route revision 30, water, all budgets and paused exclusions. See docs/reviews/ridge-10.938/README.md for evidence and limits.

Recent changes from **10.926**. Remove measured mixed-LOD seam allocation churn without changing rendered buffers. Sampled diagnostic allocation falls from 14.414 to 1.516 GB; all 35 tile-pair attribute/index and restored-skirt hashes match 10.925. Fresh matched six-flight sets reduce intervals over 50 ms from 496 to 313, while pooled p95 and the 83.4 ms maximum stay unchanged. Northeast peak heap falls from 201.6 to 190.8 MB and still misses 155.4 MB; city peak is 222.7 versus 223.2 MB. The historical 400 ms gap is not reproduced and its cause remains unverified. Preserve contact/water, detail, all budgets, revision 28 and paused exclusions. The 123 focused checks, production build and paired low-altitude chase/cockpit review pass. See docs/reviews/performance-10.926/README.md for raw evidence and limits; memory and overall performance acceptance remain open.

Recent changes from **10.925**. Show Free flight final glide guidance and give its valid approach cone navigation priority. Include the exact 30 degree nose and ground-track boundary despite floating-point rotation error, while rejecting measurable excess. Review three generated runways in Free flight and Training Orbit through real physics contact and desktop debrief, with paired low-altitude production chase/cockpit views. Preserve flight physics, collision, terrain, water, budgets, revision 28 and paused exclusions. Scripted approaches prescribe the trajectory and pre-complete Training gates; manual handling and full gate flights remain unverified. See docs/reviews/landing-10.925/README.md for evidence and limits. Northeast memory/hitch acceptance and broader coastal coverage remain open.

Recent changes from **10.924**. Match dry shared-edge lighting normals on the 17.5 m world basis and join resident mixed-LOD edge profiles with render-only connector skirts, including non-nested grids. Preserve contact heights, core terrain positions and indices, water, distances, all configured budgets, revision 28 and paused exclusions. Edge publication shares the existing upload deadline and cap, with no additional draw. Final evidence matches 35 identical before/after tile pairs with zero tested uncovered dry gaps. See docs/reviews/terrain-10.924/README.md for measured edge deltas, geometry cost, paired four-seed views and limitations. Landing follow-through and northeast memory/hitch acceptance remain open.

Recent changes from **10.923**. Use a common 17.5 m slope-tint basis at dry tile boundaries to remove mixed-LOD rock-color seams. Four actual shared-vertex jumps of 0.019-0.114 RGB fall to zero while heights, normals, indices, water and collision stay byte-identical. Review alpine, badlands, green and volcanic terrain plus roads and sea contact on four additional seeds. Preserve detail, distances, all budgets, revision 28 and paused exclusions. Additional boundary probes add measured CPU cost; the 155.4 MB northeast heap target, large hitches, remaining geometric/normal seams and actual landing approaches remain open. The 96 focused checks, production build and 32 paired low-altitude chase/cockpit views pass. See [the terrain review](docs/reviews/terrain-10.923/README.md) for measured CPU cost and remaining geometry/normal seams.

Recent changes from **10.922**. Retain verified road fitter/refit, biome blend and shader/material allocation improvements. Cached 1,200-color CPU falls from 1.911 to 1.101 ms and rough road fitting from 62.759 to 12.967 ms, with identical payloads. Drop shared fallback materials, quad merging and unproven scheduler/sort experiments. Final matched six-flight results reduce >50 ms intervals from 92 to 38, but retain a 400 ms hitch and northeast peak heap of 214.7 MB against the 155.4 MB target; memory and overall performance acceptance remain open. City peak heap falls from 204.1 to 184.4 MB. Preserve detail, distances, all budgets, revision 28 and paused exclusions. See [the performance review](docs/reviews/performance-10.922/README.md) for evidence and limits.

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

Launch and Pause > Next mission share a featured row: **Free flight**, **Training orbit**, **Daily challenge**. **Random world** stays first in the scrollable grid. Search, categories, sorting, counts, and empty messages apply only to the remaining missions; featured cards and Random world always remain visible. Choosing a card prepares the mission without launching it. Arrow keys follow the displayed rows; Home/End reach the first/last visible card, and Enter/Space select it.

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

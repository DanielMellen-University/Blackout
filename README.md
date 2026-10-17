# Blackout

Browser arcade flight game. Pilot an F-35, take off, fly a gate run, and land or crash. New pilots start in Training Orbit. Explore procedural mountains, waterways, cities, and villages, or chase medals and personal bests in authored courses and Daily challenge.

Current release: **v0.12.0** (`Systems expansion`). Roadmap chunk: **10.916**. Previous roadmap chunk: **10.915**.

Recent changes from **10.916**. Carry regional fronts, world-cell cloud identities, interpolated cloud drift and the distant sky with one deterministic seeded prevailing wind. Keep local wind strength and gusts tied to the existing weather fields, with smooth directional variation. Preserve manual profiles/locks, pause, revisits, all cloud/rain/snow capacities, draws and workers. Re-center the developer storm path for the new transport. All 70 focused weather checks pass; inspect six production-camera chase/first-person stills crossing clear/cloudy/rain at 150 m AGL, with matching wind, fog and buffet telemetry and no page/shader errors. See [the weather review](docs/reviews/weather-10.916/README.md). The [10.915 instrumented comparison](docs/reviews/performance-10.915/README.md) still has more >50 ms hitches and higher heap peaks, with one unproven 483 ms native/scheduling gap; it excludes this weather follow-up. No overall FPS/heap win is claimed. Broader weather/audio and sustained-memory acceptance, coastal connectivity and rough-terrain road artwork remain open. Geometry, collision, distance, ghost revision 27, records and paused exclusions remain unchanged.

Recent changes from **10.913**. Draw local and regional gravel shoulders as two outer bands instead of a full cap across the asphalt. Keep four triangles per profile segment and the same draws, worker/profile/support caps and 1,024-vertex drape budget; shoulder rows use four vertices instead of three. Inspect shoulder height beside the lane. Extend actual far-near-far asphalt and shoulder checks to a seed-1 ground grade above 20% and a seed-73 coastal site near 5 m elevation. Add a fixed coastal review destination. Ghost revision 27 and saved records remain. Full triangle-interior/live-transition contact, globally connected coasts and controlled performance/memory acceptance remain open.

Recent changes from **10.912**. Refine settlement places with a compact paved village core, residential frontage and a distinct industrial edge. Add farmhouse, rowhouse, inn and depot footprints using existing instance families. Survey up to four gentle dry sites per farm, keep fields only with both accepted farm buildings, and retain rural access lanes independently of cultivation. Prefer outward fuel-stop arterials for regional attachment within the same eight-candidate dry-shoulder check. Reject incomplete fuel pads. Add on-demand low-altitude views of actually loaded neighbourhoods. Keep four settlements, 1,500 buildings, six regional links and all worker/profile/support/draw budgets. Planning stays in the existing worker; ghost revision 27 skips incompatible paths while preserving saved records. Rough/coastal artwork, continuous gameplay travel and controlled performance/memory acceptance remain open.

Recent changes from **10.911**. Keep final glide guidance within 30 degrees of inbound nose and ground track, allowing modest crosswind crabs. Keep Training Orbit hints visible through gates, return and repeated approach setup until completion or a crash; ordinary missions retain timed hints. The pushed 10.910 thermal selection and CI repairs take precedence over the saved duplicate edits. Ghost revision 26 and saved records remain. Focused checks and rendered review fixtures cover the change; complete generated-world approaches and physical-device onboarding remain open.

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

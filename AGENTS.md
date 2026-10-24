# Repository work rules

## Paused systems - explicit user decision

- Vegetation development is paused. Trees, rocks, bushes, grass props, foliage shaders, and their terrain-streaming infrastructure have been removed. Do not restore, replace, optimize, or develop this system unless the user explicitly asks to resume it. General requests to improve the game or complete the roadmap do not lift this pause.
- Blackout/redout mechanics, screen veils, transition banners, and associated G-load tones are removed. Do not reintroduce them without an explicit user request. Preserve the aircraft's load-factor telemetry, G readout, scoring, and flight physics.
- Keep these exclusions in the roadmap and do not list the removed systems as shipped features or future work. Terrain biomes, ground color/relief, settlements, weather, and water are separate systems and remain in scope.
- The entire flight-warning strip is removed: stall, go-around, flare, gear, obstacle, fuel, overspeed, pull-up, and low-altitude alerts, along with its alert tones, evaluator/probes, and styling. Do not reintroduce this category without an explicit user request. Preserve instruments, altitude telemetry, flight physics, terrain/obstacle collision detection, and ordinary navigation/glide guidance.

- Keep prototypes, tests, debug and dev-only features out of player-facing UI; testing access must use a dev-only URL param or flag that is off by default.

## Locked decisions - explicit user decisions (Oct 24 2026)

- Camera views are final as of 11.009. Third person follows Q/E roll rigidly like first person, every switch opens behind and a bit above the jet, and the middle view distance is 14. Do not change camera views, framing, smoothing or defaults without an explicit user request.
- Nitro has no speed or acceleration cap while active (5 s drain, 20 s refill, gate top-ups). Speed decays naturally after release. Do not reintroduce a nitro cap.
- Gates are 50% larger (GATE_SIZE_SCALE 1.5 for ring, tube and trigger radius). Keep visual and trigger sizes scaled together.
- The featured top row is exactly Free flight, Training orbit and Daily challenge. Do not touch UI unless the user asks.
- The lines/valley-run gameplay overhaul is on hold. Do not start it or propose options until the user asks.
- Every new feature, mission type or roadmap item needs the user's approval first. Fixes to shipped features within approved scope are fine.

## How to work

- Small fixes are small: find the cause, make the smallest change, run only the targeted tests, push. No full suites or frame-metric runs for a quick fix.
- Ship one change at a time, in the order asked. One commit per fix, pushed as soon as it passes. Do not batch several fixes into one push or run them in parallel.
- Bigger work, especially 3D modelling and terrain shaping, goes through Codex with model gpt-6.1-sol at high reasoning effort. Codex runs must render headless, take screenshots and view them before shipping, and report the screenshot paths. Quick fixes are done directly, not through Codex.
- Never use port 5173 for checks or previews. The user's own dev server runs there from this repo; do not stop it.

## Verification and delivery

- Preserve unrelated local changes. Pull `origin/main` before each work session.
- Test affected behavior before pushing. Feature batches also run the production build; quick fixes run targeted tests only.
- Keep Version, README, ROADMAP, and CHANGELOG release metadata synchronized.

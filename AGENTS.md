# Repository work rules

## Paused systems — explicit user decision

- Vegetation development is paused. Trees, rocks, bushes, grass props, foliage shaders, and their terrain-streaming infrastructure have been removed. Do not restore, replace, optimize, or develop this system unless the user explicitly asks to resume it. General requests to improve the game or complete the roadmap do not lift this pause.
- Blackout/redout mechanics, screen veils, transition banners, and associated G-load tones are removed. Do not reintroduce them without an explicit user request. Preserve the aircraft's load-factor telemetry, G readout, scoring, and flight physics.
- Keep these exclusions in the roadmap and do not list the removed systems as shipped features or future work. Terrain biomes, ground color/relief, settlements, weather, and water are separate systems and remain in scope.

## Verification and delivery

- Preserve unrelated local changes. Pull `origin/main` before each work session.
- Test affected behavior and run the production build before committing and pushing coherent changes.
- Keep Version, README, ROADMAP, and CHANGELOG release metadata synchronized.

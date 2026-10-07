# Roadmap

Chunk **10.838** is current. Previous ship: **10.837**. Public release stays **v0.12.0** (`Systems expansion`). Keep Version, README, ROADMAP, and CHANGELOG synchronized in each shipped batch.

## Shipped baseline

The playable loop includes courses, contracts, landings, Daily/Weekly/Monthly Ops, ghost replay, Training Orbit, and persisted course filters. Procedural terrain, waterways, settlements, and roads stream with bounded queues and instance budgets.

The distance-math pass covers traffic, radar, collision sweeps, wakes, warnings, thermals, vegetation, cloud fades, airfield pads, PAPI, and settlement scheduling. Chunk 10.835 finishes reuse of queue distances and deterministic squared ranking of road jobs. Changelog entries 10.831 through 10.834 are restored and the production version gate is synchronized again.

Chunk 10.836 makes navigation ETA use target-relative velocity, keeps slow approaches independent of HUD refresh cadence, and resets trend history when gates or radar landmarks change. Direct approaches, crossing flight, departures, and target switches have regression coverage.

Chunk 10.837 captures pre-resolution touchdown speed, adds one targeted landing correction and finite contact telemetry, aligns flare/go-around cues with the collision speed limit, and covers the previous sink-rate gap. Scoring math is shared with coaching without adding allocations to live previews. Debriefs scroll on short screens; `/dev/debrief.html` reuses the real results UI without booting the world or persisting records. Automated behavior and DOM checks pass; visual inspection remains outstanding because the browser tool rejected access under its URL policy.

Chunk 10.838 centralizes takeoff labels, follows inverted pitch and remapped gear keys in the title and live briefing, and uses touch/controller labels after meaningful device input. Idle pads, menu typing, and released touch controls do not steal the active-source cue; controller disconnects clear stale device guidance. The briefing budget now consumes simulated flight time, not pause/loading time. Existing input priorities and 30 Hz controller polling remain unchanged.

## Current priorities

1. **Landing follow-through.** Verify runway alignment and glide guidance in actual approaches, and inspect the new debrief on desktop and phone-sized screens when browser inspection is available. Preserve the existing one-warning priority and restrained audio cadence.
2. **Controls and onboarding.** Play through the first-flight and recovery flow across devices. Remapped pitch/gear and active-device hints are covered; review discoverability and whether pilots can complete Training Orbit without opening settings.
3. **Performance and stability.** Profile streaming during fast travel and rendering in dense landmarks and weather. Prioritize measured bottlenecks, bounded memory, and worker fallback coverage.
4. **Catalog and Ops.** Improve course selection, personal goals, and record retention within the existing modes.

## Work and verification

- Pull origin/main before each work session and preserve unrelated local changes.
- Ship coherent batches with focused behavior tests and a production build before committing and pushing.
- Preserve comments that explain generation and lifecycle invariants when recovering a file. Never replace a source with a placeholder to bypass tool limits.
- Use existing instance, draw-call, and worker budgets. A math-only change is not evidence of an FPS improvement without measurement.
- Keep release notes and this roadmap accurate. `docs/AUDIT-2026-09-04.md` is historical evidence, not the live backlog.

## Non-goals

No weapons, combat, multiplayer, Discord integration, or parallel world systems. Do not rewrite published commit history as part of source cleanup. Do not mark unverified or unshipped features complete.

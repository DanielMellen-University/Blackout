# Roadmap

Chunk **10.835** is current. Previous ship: **10.834**. Public release stays **v0.12.0** (`Systems expansion`). Keep Version, README, ROADMAP, and CHANGELOG synchronized in each shipped batch.

## Shipped baseline

The playable loop includes courses, contracts, landings, Daily/Weekly/Monthly Ops, ghost replay, Training Orbit, and persisted course filters. Procedural terrain, waterways, settlements, and roads stream with bounded queues and instance budgets.

The distance-math pass covers traffic, radar, collision sweeps, wakes, warnings, thermals, vegetation, cloud fades, airfield pads, PAPI, and settlement scheduling. Chunk 10.835 finishes reuse of queue distances and deterministic squared ranking of road jobs. Changelog entries 10.831 through 10.834 are restored and the production version gate is synchronized again.

## Current priorities

1. **Navigation feedback.** Show arrival estimates based on velocity toward the target, and reset distance-trend cues when gates or radar targets change. Verify direct approaches, crossing flight, and departures.
2. **Landing clarity.** Review approach cues, warning priority, and touchdown debriefs. Give pilots actionable corrections with restrained visual and audio feedback.
3. **Controls and onboarding.** Keep keyboard, touch, and gamepad hints accurate after remapping. Make recovery and first flights easy to understand.
4. **Performance and stability.** Profile streaming during fast travel and rendering in dense landmarks and weather. Prioritize measured bottlenecks, bounded memory, and worker fallback coverage.
5. **Catalog and Ops.** Improve course selection, personal goals, and record retention within the existing modes.

## Work and verification

- Pull origin/main before each work session and preserve unrelated local changes.
- Ship coherent batches with focused behavior tests and a production build before committing and pushing.
- Preserve comments that explain generation and lifecycle invariants when recovering a file. Never replace a source with a placeholder to bypass tool limits.
- Use existing instance, draw-call, and worker budgets. A math-only change is not evidence of an FPS improvement without measurement.
- Keep release notes and this roadmap accurate. `docs/AUDIT-2026-09-04.md` is historical evidence, not the live backlog.

## Non-goals

No weapons, combat, multiplayer, Discord integration, or parallel world systems. Do not rewrite published commit history as part of source cleanup. Do not mark unverified or unshipped features complete.

# Roadmap

Chunk **10.842** is current. Previous ship: **10.841**. Public release stays **v0.12.0** (`Systems expansion`). Keep Version, README, ROADMAP, and CHANGELOG synchronized in each shipped batch.

## Shipped baseline

The playable loop includes courses, contracts, landings, Daily/Weekly/Monthly Ops, ghost replay, Training Orbit, and persisted course filters. Procedural terrain, waterways, settlements, and roads stream with bounded queues and instance budgets.

The distance-math pass covers traffic, radar, collision sweeps, wakes, warnings, thermals, vegetation, cloud fades, airfield pads, PAPI, and settlement scheduling. Chunk 10.835 finishes reuse of queue distances and deterministic squared ranking of road jobs. Changelog entries 10.831 through 10.834 are restored and the production version gate is synchronized again.

Chunk 10.836 makes navigation ETA use target-relative velocity, keeps slow approaches independent of HUD refresh cadence, and resets trend history when gates or radar landmarks change. Direct approaches, crossing flight, departures, and target switches have regression coverage.

Chunk 10.837 captures pre-resolution touchdown speed, adds one targeted landing correction and finite contact telemetry, aligns flare/go-around cues with the collision speed limit, and covers the previous sink-rate gap. Scoring math is shared with coaching without adding allocations to live previews. Debriefs scroll on short screens; `/dev/debrief.html` reuses the real results UI without booting the world or persisting records. Automated behavior and DOM checks pass; visual inspection remains outstanding because the browser tool rejected access under its URL policy.

Chunk 10.838 centralizes takeoff labels, follows inverted pitch and remapped gear keys in the title and live briefing, and uses touch/controller labels after meaningful device input. Idle pads, menu typing, and released touch controls do not steal the active-source cue; controller disconnects clear stale device guidance. The briefing budget now consumes simulated flight time, not pause/loading time. Existing input priorities and 30 Hz controller polling remain unchanged.

Chunk 10.839 adds active-update watchdogs for silent terrain/settlement workers, reuses existing bounded failure queues, handles settlement message errors, and rejects duplicate/nonmatching replies. `npm run perf:terrain` profiles actual CPU geometry without a listening or lingering server. Recorded seeds 42 and 1337 show near builds dominate the sampled CPU cost, including 42–47 ms first builds; these are not FPS measurements. Previous browser benchmark numbers are explicitly historical.

Chunk 10.840 uses a shared cooperative geometry iterator for fallback sampling, preserves worker output and detail, and retains only one suspended tile. Resets, disposal, unwanted tiles, and seed changes cancel that tile and release partial geometry/climate state. Streaming telemetry counts suspended work, so benchmark completion cannot mistake it for an idle stream. Independent legacy byte hashes cover land, skirts, ponds, broad water, reduced far fallback, and the runway pad. CPU slice measurements still expose cold hydrology and water assembly over budget; no hard 2 ms or FPS claim is made.

Chunk 10.841 separates compact catalog scanning from the selected briefing and expandable progress/records. A single next-sortie target follows first completion, the next medal gap, then repeatable complete-circuit time after gold. Random-world goals never compare different routes' times; free flight remains exploration without a checkpoint clock. Filtered-out selections retain their identity and a visible-list tab stop. Arrow navigation follows actual CSS columns and scrolls choices into view. Escape clears the shared search before global pause capture; Enter/Space activate native picker controls instead of launching. The records disclosure participates in pause focus trapping, which excludes hidden ancestors. Ops difficulty uses resolved profiles, and weather/night filters include repeatable seeded launch conditions. No new storage, timers, or per-flight-frame work is added. Behavior/native-element adapter tests pass; pixel-level and real-device visual QA remain outstanding under the browser access limitation.

Chunk 10.842 captures the active sortie independently of next-course menu selection. Records, ghosts, contracts, debriefs, and copied replay links use that immutable identity; same-course retries retain the original Ops period. Fresh launches apply pending selections/custom seeds, while failed rebuilds retain the actual course and restart its mission. Catalog time advances on visible idle/pause RAF checks (at most once a minute), visibility return, and launch/reset actions, with no background timer or wall-clock polling in live flight. Explicit historical pins affect only their matching Ops mode and are released when selecting another course/custom seed. Retention protects exact active/replayed record families, not whole stale periods; historical completions never rewind newer streaks. UTC day/month/ISO-week boundaries, record persistence, replay links, retention release, invalid clocks, and monotonic streaks have focused regression coverage. Browser end-to-end QA remains outstanding under the existing access limitation; no FPS improvement is claimed.

## Current priorities

1. **Landing follow-through.** Verify runway alignment and glide guidance in actual approaches, and inspect the new debrief on desktop and phone-sized screens when browser inspection is available. Preserve the existing one-warning priority and restrained audio cadence.
2. **Controls and onboarding.** Play through the first-flight and recovery flow across devices. Remapped pitch/gear and active-device hints are covered; review discoverability and whether pilots can complete Training Orbit without opening settings.
3. **Performance and stability.** Profile streaming during fast travel and rendering in dense landmarks and weather. Silent-worker recovery and sliced fallback sampling are covered. Cold catchment creation (including normal probes), analytic water assembly, and mesh attachment can still overrun their indivisible phases; measure and address those next without reducing geometry, collision, or water detail. Preserve bounded memory and worker budgets.
4. **Catalog and Ops.** Inspect the streamlined picker visually and play through its medal/time goals. Exercise long-open rollover, paused selection/resume/retry, historical replay release, and retention end-to-end in the browser; core lifetime and storage invariants are covered. Review cross-tab progression handling without introducing parallel record systems.

## Work and verification

- Pull origin/main before each work session and preserve unrelated local changes.
- Ship coherent batches with focused behavior tests and a production build before committing and pushing.
- Preserve comments that explain generation and lifecycle invariants when recovering a file. Never replace a source with a placeholder to bypass tool limits.
- Use existing instance, draw-call, and worker budgets. A math-only change is not evidence of an FPS improvement without measurement.
- Keep release notes and this roadmap accurate. `docs/AUDIT-2026-09-04.md` is historical evidence, not the live backlog.

## Non-goals

No weapons, combat, multiplayer, Discord integration, or parallel world systems. Do not rewrite published commit history as part of source cleanup. Do not mark unverified or unshipped features complete.

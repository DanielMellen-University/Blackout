# Roadmap

Chunk **10.834** is current. Previous ship: **10.833**. Public release stays **v0.12.0** (`Systems expansion`). Keep `src/core/Version.ts`, the README lead, and this file on the same chunk.

## Where we are

Blackout is a browser arcade F-35 flight game. The playable loop is shipped: courses, contracts, landings, Daily/Weekly/Monthly Ops, ghost replay, Training Orbit onboarding, and persisted course filters. Pilots take off, fly a gate run, and land or crash. Weapons and combat are not part of the product.

Through **10.833** the unreleased hot-path pass squared or gated comparison-only distance and speed roots across traffic alerts, radar contacts, obstacle and contact sweeps, wakes, landing scrub, warning lookahead, thermals, vegetation slope, cloud fade, airfield pad blends, PAPI approaches, grounded runway speed, settlement streaming ranks and evictions, regional road candidate ranking, regional connection range gates, and hydrology lake separation. Draw counts, result semantics, and the fixed-step flight loop stayed unchanged.

## Docs and release hygiene

- **CHANGELOG sync debt.** Remote `CHANGELOG.md` Unreleased still tops at **10.830**. Chunks **10.831** through **10.833** (and this docs chunk) need prepended entries. The file is ~126KB; GitHub MCP truncates large payloads, so do not stub or rewrite it through MCP. Sync with a local git commit or another non-MCP path that can carry the full file.
- **Version check.** `npm run version:check` expects the top CHANGELOG ship bullet to match `ROADMAP_CHUNK`. Until the CHANGELOG catch-up lands, that check will fail against tip even when Version and README agree.
- **Historical docs.** `docs/AUDIT-2026-09-04.md` is a frozen Sept 2026 audit snapshot. Many defects it lists are already fixed; treat it as history, not the live plan.

## Remaining hot-path sqrt debt

Finish the squared-distance pass only where a root is comparison-only or duplicated. Keep HUD copy, draw calls, and fixed-step outcomes identical.

1. **Settlement queue scoring (next code slice).** `src/world/SettlementSystem.ts` (~92KB) still carries duplicate distance work in queue scoring versus stored `job.distance`, and `takeNearestRoadJob` still ranks with exact distances instead of squared ranks. Too large for a safe MCP edit; ship via a local or chunked non-MCP path with focused tests.
2. **Regional road geometry.** Ranking and connection gates are squared through **10.832**; leftover geometry or planner roots that are comparison-only should follow the same rule.
3. **WaterSystem.** Audit `src/world/WaterSystem.ts` for comparison-only distance roots on fade, culling, or attachment paths. Materialize exact distances only when a shader, HUD, or effect needs the linear value.
4. **FlightModel.** Audit `src/aircraft/FlightModel.ts` for comparison-only speed or distance roots on grounded, envelope, or authority gates. Reuse values already resolved in the same tick when a duplicate root appears.

## Near-term priorities after the sqrt pass

Stay inside courses, contracts, landings, and Ops. Prefer small measurable ships.

- **Stability and fail-closed edges.** Keep worker, seed, gamepad, and world-rebuild paths failing closed without throwing through the animation loop.
- **Readable flight feedback.** Polish warnings, contract acknowledgements, and debrief clarity without new systems or draw-call budgets.
- **Streaming cost.** Settlement and terrain hot paths after the sqrt pass: allocations, redundant sampling, and planner garbage under fast travel.
- **Catalog and Ops feel.** Course picker, mastery, and rotating Ops already exist; tune clarity and retention of bounded records rather than inventing parallel modes.
- **Docs hygiene.** After any chunk, sync Version, README lead, ROADMAP, and (when a non-MCP path is available) CHANGELOG in the same breath.

## Soft next slices

Daily runs can grab any one of these without inventing scope:

1. Settlement squared queue distance vs `job.distance` (SettlementSystem, local path).
2. `takeNearestRoadJob` squared ranking (same file).
3. WaterSystem comparison-only root audit and one gated ship.
4. FlightModel comparison-only root audit and one gated ship.
5. CHANGELOG prepend for **10.831**–**10.834** via local git (full file, no stub).
6. Small UX or fail-closed polish that does not add weapons, multiplayer, or new world systems.

## Non-goals

- No weapons, combat modes, damage models, or targeting beyond existing radar locks used for contracts and situational awareness.
- No Discord integration and no multiplayer.
- No stubbing or truncating `CHANGELOG.md` or other large sources to force an MCP push.
- Do not mark unshipped features as done. The Sept 2026 audit is not a backlog of open work unless re-verified against tip.

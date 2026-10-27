# Mission overhaul roadmap (Oct 24 2026)

Status: direction **A+C picked** by Daniel on Oct 24 2026 (wide lines plus scored flying). Replaces the Oct 22 rule of 15 to 100 gates. B is not used. Code only in approved daily slices. Starts after landing removal (ROADMAP item 6). This replaces the separate lines and valley-run overhaul (old item 7) and builds on [fun exploration](fun-exploration.md).

## What is wrong now

- **Gates too close.** 15 to 100 gates are spread evenly over a loop of roughly 6 to 9 km, so the longer runs put gates about 80 to 200 m apart. That is under a second per gate at cruise: constant twitch corrections, no flow, no room for nitro.
- **Same shape every time.** Every generated mission is one flat stadium oval (out, around, back). Themes only change its size and side. It is not routed through terrain.
- **Wide valleys.** Valley and canyon themes are kilometres wide, so you fly over them, not through them. Only Perfect Line has a real corridor.
- **Flat heights.** Gates sit about 105 to 225 m above the start, so there is almost no climbing or diving.
- **Landing flow.** Every run ends with a fly-back and a landing. Item 6 removes this.
- **Scoring ignores the flying.** Gates, time and landing extras only. Flying low, close to terrain or carrying speed earns nothing.

## Goals

- Runs feel like flying a line through terrain, with flow between gates and space to use nitro.
- Start in the air, finish in the air, instant retry.
- Every run reads differently: height changes, turns that use the terrain, breathing space.
- Keep b20 physics, uncapped nitro, budgets, the five themes, final camera views and the no-landings rule.

## Direction options (tap card)

- **A. Wide lines:** fewer gates (about 8 to 20), 0.8 to 2.5 km apart, routed through valleys and over ridges with real height changes. Replaces the 15 to 100 gate rule.
- **B. Canyon journeys:** one-way point-to-point runs through carved canyons and valleys, gates as waypoints, finish in the air at the destination. Keeps 15 to 100 gates but spaced over much longer routes.
- **C. Checkpoints plus flying score:** wide checkpoints with free routing between them, scored on time plus bonuses for flying low and close to terrain. Replaces the 15 to 100 gate rule.

## Picked: A+C

8 to 20 gates, 0.8 to 2.5 km apart, routed through valleys and over ridges with real height changes. Score is time plus bonuses for flying low, close to terrain and carrying speed. Phases M0, M1, M4 and M5 in full, M2 light, M3 optional. Estimated about 20 to 30% of the weekly limit in total.

## M0 and spacing slice spec (b40 r5, 11.015)

Generate 8–20 gates on the existing seeded stadium routes, with consecutive gate centers 800–2,500 m apart. Keep course identities, catalog slots, weather and seeds; preserve the existing runway start and airborne finish for gated runs. Free flight retains its ground start, takeoff and landing behavior. Retain the current scoring and flight physics. Terrain-following routes, airborne starts and flying-score bonuses belong to later slices.

Acceptance: verify the count and spacing on generated and migrated routes across themes and seeds, including the final route after terrain clearance; check route clearance and flyability, and capture and inspect a gated run. Verify Free flight still starts on the runway and can land. The open runway-alignment contract question in landing-removal step 6.4 remains unchanged.

**Status: partial; no generator change shipped.** A bounded search through 161 arc-length samples per existing stadium, with 805–2,300 m horizontal legs and turns below 74°, failed to find a route for 72 of 500 theme/seed cases. It is a discrete search, not a proof that no placement exists. A trial widening narrow loops to 1,700 m found placements in 25,000 theme/seed cases, but exceeded the original width for some seeds. Sparse Waterway placements also missed the river or lake in 11 of 36 checked seeds. A later search requiring the last two gates to stay on the runway axis found placements for 2,500 theme/seed cases; the combined implementation has not passed the full checks.

**NEEDS DANIEL:** May narrow seeded routes extend beyond their original width to support the 800 m minimum spacing while retaining the 75° turn limit, with Waterway placements adjusted to retain both river and lake? Alternatively, retain each seed's original bounds and investigate a different placement method; the sampled search did not establish a solution. Course identities and the 75° check remain unchanged. This does not resolve the separate step 6.4 runway-alignment contract question.

## Week 2 daily slices (approved Oct 24 2026)

Daniel approved this list on Oct 24 2026, without the in-flight bonus readout. It runs after week 1 (landing removal, ROADMAP item 6). If a slice fails, it is retried the next weekday and the rest shift by a day.

| Day | Slice |
|---|---|
| Mon Nov 2 | PARTIAL, 11.015: M0 spec documented; gate spacing awaits the route decision above |
| Tue Nov 3 | PARTIAL, 11.016: generated gate heights follow sampled terrain with clearance and slope limits; the existing horizontal stadium does not deliberately route through valleys and over ridges. **NEEDS DANIEL:** choose how much the horizontal line may bend within its bounds to seek those features while retaining existing gate spacing, the 75° turn limit and theme features. |
| Wed Nov 4 | Every gated run starts in the air, lined up on gate 1. Free flight keeps its runway start (ROADMAP item 10, folded in) |
| Thu Nov 5 | M4 scoring: time plus bonuses for flying low, close to terrain and carrying speed. New record revision, old records kept separately |
| Fri Nov 6 | Proof flights only: headless flights and screenshots on each theme. No UI change |

No in-flight bonus readout. The bonuses count but show only in the existing final results. After week 2, each next slice (M2 corridors, M3 rocks and arches, M5 moving all 72 missions) needs Daniel's OK first.

## Phases after landing removal

Rough usage is share of the weekly Codex limit at gpt-6.1-sol high. Each phase is split into daily slices of about 3 to 5% and each phase needs Daniel's OK.

| Phase | What | A | B | C | Usage |
|---|---|---|---|---|---|
| M0 | Spec for the picked direction, gate spacing numbers, acceptance screenshots (docs only) | yes | yes | yes | ~1% |
| M1 | Route generator: new spacing, terrain-following routes, height changes, airborne start | yes | yes (point-to-point) | yes (checkpoints) | 4 to 6% |
| M2 | Terrain corridors: carve readable canyons and valley lines along the route | light | yes | light | 5 to 8% |
| M3 | 3D modelling: rock and cliff meshes, gate model, arches | optional | yes | optional | 4 to 6% |
| M4 | Scoring and records: time and flow based, new record revision; C adds low-flying and near-terrain bonuses | yes | yes | yes (bigger) | 3 to 6% |
| M5 | Migrate all 72 missions and the Ops periods, proof flights and screenshots per theme | yes | yes | yes | 4 to 6% |

Totals: A about 16 to 25%, B about 21 to 32%, C about 18 to 28%. At one slice per weekday that is roughly one to two weeks of daily runs.

## Limits

No landings. Camera views are final. No dev features in player UI. No UI changes beyond what a phase names. No vegetation, warning strip or blackout/redout effects. Heap about 200 MB, existing worker and draw budgets.

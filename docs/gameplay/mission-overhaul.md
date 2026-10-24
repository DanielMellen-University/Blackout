# Mission overhaul roadmap (Oct 24 2026)

Status: PLANNED. No direction picked. No overhaul code until Daniel picks one. Starts after landing removal (ROADMAP item 6). This replaces the separate lines and valley-run overhaul (old item 7) and builds on [fun exploration](fun-exploration.md).

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

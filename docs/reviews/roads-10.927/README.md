# 10.927 broader coastal road coverage

Two locally cut-off coastal villages now obtain valid regional roads: seed 42, village `4,-4`, and seed 808, village `-7,-3`. The fixed eight-village survey across seeds 73, 42, 808 and 1337 improves from five connected sites to seven. An independent expansion to sixteen villages on those four seeds improves from ten to twelve, with no previously connected site becoming disconnected. `measurements.md` records every before/after outbound link, including changed winners and remaining failures.

## What was wrong

Coastal routing was selected only from the elevations of the chosen street joins. A low coastal settlement can attach on an uphill street, so both joins may exceed 25 m even when the village centre is in the coastal band. Those villages incorrectly used local monotone refinement instead of the bounded two-way coastal detour.

The coastal search's eleven evenly spaced lanes were also too widely separated to resolve narrow inland departures and valleys. The existing lanes now concentrate near the centre using signed power 2.5, retaining exactly the same outer reach, stations, neighbours, clearance probes and rejection rules. The chosen spacing fixes both generated regressions; the square and cube experiments each fix only one. `experiments.json` preserves all four explored candidates and their survey results. The classification-only candidate did not increase connected-site count and is not claimed as a standalone win.

No search or physical limit increases: at most 64 stations, eleven lanes, 5,000 coastal/refinement probes, four complete profiles per link and four ranked neighbour attempts. The 8,192-point, 192-support, 1,800 m wet span, 1,200 m dry structure span, 96 m structure height and 0.24 grade ceilings remain. Street/shoulder attachments stay dry, building and service clearance remains mandatory, and opposite endpoint queries generate identical profiles. Settlement, building, road, worker, render, terrain, water and drape budgets remain unchanged. No terrain excavation or paused system is added.

## Generated results and verification

The new seed-42 link is `4,-3|4,-4`: 2,379 profile points, nine supports, a 628.95 m maximum dry engineered span, 27.82 m maximum structure height and 0.2352 maximum grade. The seed-808 link is `-7,-3|-8,-3`: 1,435 points, eight supports, a 599.58 m dry engineered span, 33.97 m maximum structure height and the same maximum grade. Both have dry ends, no wet crossing in the selected profiles, and identical reverse-query results. Supported dry structures retain the existing fills/piers; a road is not raised across an entire valley to conceal grade failures.

Generated-world regressions independently sample resolved ground/water, check dry endpoints, engineering bounds, support counts and canonical reverse queries. The existing seed-73 coastal crossing regression still checks wet centreline points against raised decks and the unchanged crossing limits. A new narrow-departure test proves the fixed lane/probe budget can leave a blocked shore through a corridor within 100 m of the centreline. Eleven focused/release files pass 69 checks and the production build passes.

Landscape compatibility advances from revision 28 to 29 because regional road selection and profiles can change. Stored progress, records and traces are preserved; incompatible old ghosts are skipped. This is not a terrain or water generation change.

## Remaining cutoffs and scope

The sixteen-site survey still finds no accepted outbound link at:

- Seed 73, `-3,8`: proposed wet spans, tall structures and route clearance fail.
- Seed 42, `-6,-4`: proposed wet/dry spans, height, grade and clearance fail.
- Seed 42, `-7,-5`: proposed wet/dry spans, height, fixed endpoint grades and clearance fail.
- Seed 1337, `6,-6`: proposed wet/dry spans, height, grade and fixed endpoint grades fail.

These are outcomes of the existing bounded discovery/search, not proof that no conceivable route exists. No failed proposal is forced through a physical limit. The survey measures accepted outbound discovery at each settlement, rather than proving connectivity of the entire infinite graph or absence of every possible incoming road. Broader coastal coverage and full network acceptance remain open. `broader-after.json` preserves each attempted compact profile and its source-line rejection diagnostics; missing street attachments also consume the production attempt cap, as covered by the focused tests.

The fresh six-flight measurements in 10.926 precede these routing changes. This batch makes no FPS, heap or sustained-travel claim. Northeast heap acceptance, the historical 400 ms cause, startup attachment stalls, manual handling and physical-device landing checks remain open.

## Visual review and reproduction

`before-views.json` and `after-views.json` record four matched village sites: seed 73 `-5,-3`, seed 42 `4,-4`, seed 808 `-7,-3` and seed 1337 `-2,-4`. Each has actual production chase/cockpit views at 30 m road clearance, 1280 x 720 and pixel ratio 1. The before seed-42/808 sites expose local streets only; the after capture waits for the expected surveyed regional link and selects it explicitly. The sites match across versions, but local-street and new-connector poses are different world positions. All sixteen final stills are inspected, with no page/console errors in either clean capture. These are prescribed resident-road poses, not manual handling or a performance benchmark.

The first visual pilot rendered the same sites but encountered Vite websocket failures. It is retained under `pilot-hmr` with development tokens redacted and is not the final clean verification. The repeated before capture uses a frozen 10.926 server with live HMR transport and grants local-network access only to its fresh browser context. The after source is frozen before capture. No game rendering or physics override is used.

Run `scripts/survey-coastal-roads.mjs OUTPUT.json` offline, separately from timing measurements. Use `COAST_SITES=4` for the sixteen-site corpus and `COAST_FIXTURES=BEFORE.json` to repeat identical sites after a change. Source manifests accompany final records; reconstructed before manifests identify frozen `959c15e`. The diagnostic transform records existing null rejections without altering their outcomes. Planning times are CPU diagnostics, not frame-time results.

With the installed Playwright module and Chromium, run `scripts/review-coastal-villages.mjs DIRECTORY LABEL SURVEY.json`. Supply `COAST_VIEW_FIXTURES=BEFORE.json` for the after capture and point `REVIEW_URL` at the appropriate frozen or candidate Vite server. The final paired screenshots are visually inspected before delivery.

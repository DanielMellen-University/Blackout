# Catalog and Ops browser checks, 10.934

The game behavior from 8075519 passes the exercised browser lifecycle paths. No production behavior fix is needed in this part. Release metadata, the reproducible external browser driver and review evidence are added. Route revision 30, physics, water/contact, detail, distances, every resource budget and paused-system exclusions remain unchanged.

## Verified paths

| Path | Browser result |
| --- | --- |
| Long-open Daily rollover | Keep the same visible page open for 70.199 seconds across UTC midnight. The selected briefing changes from 2026-10-18, seed 168005, to 2026-10-19, seed 129180. The preview world's seed and aircraft position remain unchanged. Launch captures the new period and matching generated seed. |
| Paused selection | Choose Training Orbit in Next mission while the current Daily mission is paused. Both title/pause selectors follow the pending choice; active Daily identity and world seed stay unchanged. |
| Resume and Retry | Resume retains the active Daily identity. Retry still restarts that Daily period and seed, while the pending Training choice stays selected. New world then launches Training Orbit, seed 1. |
| Historical Daily | Launch 2026-09-01, select Training while paused, and observe the replay pin release. Retry retains the active historical mission; New world applies Training and releases the old protected family. |
| Historical Weekly | The same sequence passes for 2026-W36. Weekly remains available through an explicit historical URL even though it is excluded from ordinary browsing. |
| Historical Monthly | The same sequence passes for 2026-09. Monthly is likewise tested through an explicit historical URL. |
| Custom seed | Load seed 73 while a historical Daily pin is present. Selection changes to Random, the pin clears, and launch captures the actual seed-73 world. |

`browser.json` contains all 24 accepted browser states, exact selected and active definitions, actual world seeds/profiles, replay IDs, protected-record sets, pause/playing state, DOM selection values and briefing text. Each state has a screenshot. All 24 are visually inspected; immediate menu-close captures can include the existing fade transition. Selected cards, pause actions and launch states remain usable in the inspected desktop layout. No application/shader errors are recorded. This is lifecycle evidence, not a complete responsive-design or screenshot comparison pass.

The initial wall clock is controlled before page creation, then advances with real elapsed time. The normal visible-menu RAF and once-per-minute catalog refresh perform the rollover. No timer, clock jump, catalog refresh, session capture, selection or reset function is invoked directly by the driver. All actions use the normal DOM controls and Escape key. The fixed UTC-5 countdown is intentionally separate from the UTC catalog rollover and is unchanged.

The observer only reads state. `observer.js` preserves its exact source, and `browser.json` identifies main, CourseSession and CoursePicker hashes plus the base commit. Period-only historical URLs select the pinned target before launch; the unlaunched random preview remains a separate active snapshot until launch captures that historical period. The first pilot incorrectly expected the preview to already be a historical active mission. `pilot/` retains its successful rollover/resume/retry evidence and the failed observer assumption; the final run corrects that assertion and completes every path. No game code is changed to satisfy the observer.

## Checks and limits

The 49 focused CourseSession, picker DOM, record retention, Ops streak and menu tests pass. Six release/README checks and the production build also pass, with the existing bundle-size advisory. Logs are retained here. `visual/` contains a separate clear-weather seed-42 coast check at 90 m clearance in production chase/cockpit cameras, 1280 x 720 and pixel ratio 1. Both stills are visually inspected, with coast, water contact, terrain and aircraft intact and no application/shader errors. These runs are not performance measurements.

Reproduce with `scripts/review-catalog-ops.mjs`, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and `REVIEW_URL` against the Vite development server and a GPU-enabled browser. `scripts/summarize-catalog-ops.mjs` independently checks the saved lifecycle and visual records. Use `scripts/review-shores.mjs` with `SHORE_SEEDS=42` for the separate low-altitude views.

Durable deletion/retention of populated historical records, cross-tab progression, scored medal/time-goal playthroughs, physical-device controls, alternate viewport sizes and multi-day/week/month open-session endurance remain unverified in the browser. The active/replay protection-set transitions are observed here; stored-data invariants retain their focused unit coverage. No memory/heap optimization or performance improvement is attempted. Vegetation, the flight-warning strip and G-load veils remain excluded.

# Weather approach verification, 10.952

Ship the approved mission from parked commit `a7715db` as is onto current main. The mission, picker, route and review scripts match that parked source; current main recovery, fuel-empty exhaust and debrief fixes remain. No redesign, mission polish or flight physics changes.

The inherited picker test navigated from Weather approach back to Contour before asserting that Weather approach was selected. Its sequence now navigates back to Weather approach before checking selection through filtering. No picker behavior changed for this correction.

## Browser flight

Run `scripts/review-weather-approach.mjs` on seed 619, using the existing external controls-only pilot. Chromium at 1280 x 720, pixel ratio 1, balanced graphics; Vite development server with the review hook. The pilot supplies ordinary controls before the unchanged aircraft step. No aircraft pose, velocity, gate completion, challenge clock, score or storage writes by the pilot. This is automated flight coverage; human handling and subjective audio are unverified.

The flight takes off, clears all five gates, follows the existing approach and lands 36.55 m from the generated runway center. Rain, right crosswind; 78.52 seconds, score 90,454, gold medal, HARD landing. The result is complete and landed. Reload retains the best, history, ghost, trace, badge and streak record families under `seed:619:weather`. No page or shader errors were captured. See [the compact summary](summary.json) for source hashes, gate events and retained keys.

Inspected stills:

- [Launch picker](launch.png): all five featured missions, with Weather approach selected.
- [Chase flight](chase.png): rain, gate three and existing instruments.
- [Cockpit approach](cockpit.png): inbound view after all five gates.
- [Flight report](debrief.png): complete route, gold medal and landing feedback.
- [Reload](reload.png): Weather approach retained with its earned best-time goal.

## Verification and evidence scope

Focused checks: 30 tests across `weatherApproachMission`, `coursePickerDom`, `courseLibrary` and `contourMission` pass. All 1,625 tests across 165 files pass with two workers. The production build passes, including release metadata and TypeScript checks.

The parked review tree contains 66 generated evidence files totaling 16,308,732 bytes, including about 45,000 JSON sample lines, repeated screenshots and copied hook files. None of that tree is ported. The existing `refs/backup/b17-leftovers` ref is retained unchanged. Keep five fresh representative stills and this compact summary; generated hooks and full raw samples remain outside the repository in `/tmp/blackout-b18-weather-952`.

Reproduce with the installed Playwright module and Chromium paths supplied through `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`, plus `SCORED_SEED=619`, `REVIEW_URL=http://127.0.0.1:5174`, and `node scripts/review-weather-approach.mjs /tmp/blackout-weather-review`. Full suite command: `npm test -- --maxWorkers=2 --reporter=verbose`. Production command: `npm run build`.

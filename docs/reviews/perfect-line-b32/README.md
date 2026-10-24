# Perfect Line feel test, b32 / 11.000

Only the Oct 23 approved cheapest Direction A prototype is delivered. Implementation is [ad51d7d4](https://github.com/DanielMellen-University/Blackout/commit/ad51d7d4), chunk 10.999. The final verification advances release metadata to 11.000; public version remains v0.12.0. No further feature is approved.

Choose **Perfect Line (prototype)** on the title screen, by click or keyboard activation. Start airborne at 150 m/s above the entrance, follow all 15 gates in order and finish in the air. Use the existing flight controls, B to brake and Space for nitro. **R** immediately retries the same fixed seed, including after a crash. Escape opens the ordinary menu to quit. No landing is required. The finish time stays in the flight view and is discarded on retry.

The hand-shaped 11.2 km line varies bend radius, rises across two broad saddles and opens two breathing spaces. It uses the existing mountain terrain profile and ordinary streaming, workers, collision and gate pool. The seed is 32026. Physics, nitro tuning, scaled gate awards, presentation fixes, worker/upload/draw budgets, settlements and roads are unchanged. No medals, unlocks, saved times, new save fields, extra courses or new menu phases are added. Vegetation, props, the flight-warning strip and blackout/redout systems stay excluded.

## Verification

- `npm test -- --maxWorkers=2`: 181 files, 2,744 tests pass, plus both native frame-metric tests. The first suite caught a palette-literal violation in the prototype readout. Using existing palette variables resolves it; the complete clean repeat passes without timeout changes.
- `npm run build`: release metadata, TypeScript and production build pass. The existing Vite large-chunk advisory remains.
- The deterministic test rebuilds the same route and terrain after unrelated seed/profile state, asserts exactly 15 gates and runs the existing controls-only pilot through production physics and collision to an airborne finish within 60 to 90 seconds. It applies all 15 awards through the unchanged refill helper, with zero gate misses.
- Both production browser flights clear 15/15 gates and receive 15/15 refill events without a crash, landing or runtime error. R returns to the same seed and gate 1 without a menu. Quitting and launching the selected ordinary mission restores its normal gates. Comparing every local-storage key before and after the prototype shows zero writes.

| Receipt | Airborne finish | Peak native frame | Intervals >100 ms | Peak sampled JS heap |
| --- | ---: | ---: | ---: | ---: |
| [Capture-free timing](timing.json) | 84.05 s | 100.0 ms | 0 | 129.2 MB |
| [Visual flight](visual.json), excluded from timing acceptance | 84.05 s | 116.7 ms | 1 | 171.3 MB |

The timing receipt retains every observed RAF interval, source hashes, hook hash, state samples and retry/storage checks. It uses a production Vite build with external review hooks, balanced quality, Chromium Vulkan at 1280 x 720, and the existing pilot's ordinary controls. No tests, builds, screenshots, camera switches, profiler or other review browser overlap its measured flight. Measurement starts after the launch panel closes. Retry is observed at 0.05 s in the fresh run, with seed 32026, no passed gates and the original airborne speed. Screenshot runs are separate. The ordinary production build is untouched by the review hook.

The known b30 15-gate hitch is still open. Its >100 ms intervals do not reproduce in the clean timing flight, but the capture run has one 116.7 ms interval. Different terrain, seed and capture conditions prevent a causal comparison or a claim that the hitch is fixed. The heap sample is below the approximate 200 MB target; this short test does not establish endurance behavior.

Inspected stills: [entrance bend](flight-3.png), [first saddle](flight-30.png), [second saddle](flight-60.png), [airborne finish](finish.png). The visual pass corrected a readout/compass overlap, the prototype mode label and the navigation gate counter. No geometry, physics or budget repair was needed.

The line is intentionally forgiving. The pilot holds roughly 150 m/s without boost and proves reachability, not human enjoyment or bank/boost mastery. Five minutes of manual retries are still needed to judge the feel. No medals, progression, records, new courses, openings or city/road work should follow without separate approval.

Reproduce with `node scripts/review-perfect-line.mjs`; set `REVIEW_CAPTURE=1` for the separate visual flight. `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` can point to an existing Playwright installation and Chromium executable. The script builds review output under `/tmp`, leaves ordinary `dist` untouched and closes its preview server.

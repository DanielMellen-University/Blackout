# Four-theme proof, 10.981

This completes the approved b24 polish proof for the four existing generator themes only: Desert run, Mountain valley run, Coastal island run and Volcanic run. Step 3 remains STARTED. Any further theme, feature, mission type, system or roadmap item requires separate approval. Older missions remain functional and await their later overhaul.

The proof seeds are 42, 1337 and 9001 for each theme, separate from the tuning seeds 73, 808 and 2026. Each flight uses the production Vite build with the retained controls-only pilot and read-only observers. The pilot sets ordinary controls; it never writes aircraft pose, velocity, physics, gate acceptance, score, clock, results or terrain. Source and hook hashes are retained with every receipt. Normal production builds contain no review hook.

Timing uses sequential complete browser flights with capture OFF, profiler OFF and a fixed chase camera. Balanced quality uses a 1280x720 viewport at device scale 1, native RAF, full rendering cadence and ordinary adaptive resolution. No tests, builds or other review browser overlap timing. Timing starts after the ordinary 1.5-second launch panel hides, immediately before the controls-only pilot starts. The first ten RAF observations are omitted as in 10.977. Every raw timestamped interval is retained; no slow interval is filtered by duration. Counts use strictly greater than 50 and 100 ms. Heap peak is the largest roughly one-second sample of main-thread used JS heap, not total browser, worker or GPU memory. These short course flights do not replace long-duration memory acceptance.

The 10.978 launch-inclusive evidence remains separate. Its reproduced early-flight stall was a blocking compositor canvas readback: a 283.3 ms baseline RAF gap and 284.180 ms nested GLES2::ReadPixels span. The production WebGL context now requests desynchronized presentation while retaining antialiasing and the original opaque alpha setting. The matched complete seed-42 Desert maximum became 66.8 ms, with zero intervals over 100 ms. FPS changed from 49.84 to 48.15 and p95 stayed 33.4 ms, so this is a large-stall repair, without an overall FPS improvement claim. See [the attribution and retained diagnostics](stutter-10.978.md). Browsers may ignore the presentation hint.

All twelve flights pass immutable runtime/pilot identity checks and recomputed timing metrics. Each clears five gates, uses boost, receives five ordinary 25% gate-refill calls, touches down inside the existing runway footprint and earns gold against the unchanged 88,000 threshold. The 60 refills preserve the production clamp at a full reserve. There are no sampled resident-coverage misses after ten seconds. All maxima meet the approximate 100 ms target, with zero intervals over 100 ms. Sampled heap stays below the approximate 200 MB target without heap tuning.

| Theme | Seed | Flight s | Medal | FPS | p95 ms | >50 ms | >100 ms | Max ms | Heap MB |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| desert-run | 42 | 114.5 | gold | 49.6 | 33.4 | 8 | 0 | 50.1 | 68.8 |
| desert-run | 1337 | 112.0 | gold | 47.7 | 33.4 | 9 | 0 | 66.7 | 73.2 |
| desert-run | 9001 | 97.3 | gold | 46.5 | 33.4 | 12 | 0 | 66.7 | 72.7 |
| mountain-valley-run | 42 | 120.2 | gold | 42.7 | 33.4 | 26 | 0 | 66.7 | 90.9 |
| mountain-valley-run | 1337 | 119.7 | gold | 46.7 | 33.4 | 8 | 0 | 66.7 | 84.5 |
| mountain-valley-run | 9001 | 103.2 | gold | 45.5 | 33.4 | 15 | 0 | 66.7 | 110.6 |
| coastal-island-run | 42 | 112.1 | gold | 40.1 | 33.4 | 39 | 0 | 66.7 | 126.7 |
| coastal-island-run | 1337 | 107.0 | gold | 42.6 | 33.4 | 31 | 0 | 66.8 | 117.9 |
| coastal-island-run | 9001 | 107.2 | gold | 44.4 | 33.4 | 24 | 0 | 66.7 | 130.6 |
| generated-volcanic-run | 42 | 108.6 | gold | 42.0 | 33.4 | 20 | 0 | 66.7 | 106.0 |
| generated-volcanic-run | 1337 | 104.3 | gold | 41.0 | 33.4 | 36 | 0 | 66.7 | 118.1 |
| generated-volcanic-run | 9001 | 105.6 | gold | 41.6 | 33.4 | 40 | 0 | 83.4 | 165.4 |


The proof receipts are under `polish-proof/`, with recomputed results in `polish-proof-summary.json`. Desert and Mountain valley retain landscape/route revisions 33/36, Coastal retains 34/37, and Volcanic retains 35/38. Existing bounded theme record and ghost families remain separated. B20 physics, b21 nitro, collision, water and resource budgets are preserved. The runtime source hashes match 10.980 except release metadata.

The separate final-build chase/cockpit sessions are under `polish-proof-visual/`. These are visual smoke checks through gate one and are excluded from timing and completion acceptance. The completed six-flight tuning reviews remain the before/after appearance and landing evidence in [10.979](polish-10.979.md) and [10.980](polish-10.980.md).

Older-mission functional smoke checks use Training Orbit seed 1, Contour circuit seed 42, Weather approach seed 619, Range sweep seed 2, Precision slalom seed 3 and the older catalog Volcanic run seed 8. Each loads, takes off, clears gate one, triggers the ordinary refill and remains airborne without browser errors. All twelve chase/cockpit gate stills were inspected. Receipts are under `polish-legacy/`, with `polish-legacy-summary.json`. These representative smoke checks are excluded from timing and full-flight completion acceptance; the older catalog is preserved without polish.

The final four-theme review inspected sixteen close runway and gate stills. Terrain relief, coast/water joins, cone silhouettes, horizon light and runway surfaces are coherent in the reviewed views, with no observed new seam, gap or floating strip.

No runtime bug was found in this proof matrix. The batch has no remaining blocker. Step 3 remains STARTED: further themes and any further feature, mission type, system or roadmap item need separate approval. Older missions await their later overhaul. The separate historical b19 long-duration seed-1337 hydrology look-ahead issue and high-altitude image limitation remain documented in ROADMAP; these short generated-course flights do not close them. Vegetation/props, blackout/redout veils and the flight-warning strip remain removed. Weapons, combat, multiplayer and parallel record systems remain non-goals; city/roads redesign stays closed at 10.942.

Reproduce with `node scripts/build-generator-review.mjs` and serve `/tmp/blackout-generator-production` on port 5176. Run `node scripts/review-approved-polish.mjs`, then `node scripts/summarize-approved-polish.mjs`. Separate visual checks use `REVIEW_PART=polish-proof-visual REVIEW_CAPTURE=1 REVIEW_SMOKE=1 REVIEW_RUNWAY_VIEWS=1 REVIEW_SEEDS=42 node scripts/review-approved-polish.mjs`. Older-mission smoke checks use `node scripts/review-legacy-polish.mjs`. Use distinct part names for new timing receipts to retain these observations. Verification logs are under `proof-verification/`.

Verification passes: 145 focused checks across the four recipes, terrain/LOD, route clearance, existing catalog and mission profiles, records/replay, b20 physics, b21 nitro, collision/water agreement, removed systems, presentation and release metadata; two frame-metrics checks; and the production build. The preceding 10.980 CI is green.

# Water review 11.045

## Far coast

Sea triangles now clip against the corrected drawn terrain bed, including vertices whose original biome was dry. Previously the coarse shore-bed correction could lower those vertices below sea level while the original binary biome mask still excluded their water. That mismatch cut cell-sized steps into the coast. Freshwater retains its river/basin mask; the direct water-builder compatibility path retains its previous default. Hydrology generation is unchanged.

Reproduction: `/dev/terrain.html?destination=ocean&seed=1`, with the review camera at `(-10904.482029513456, 9000, -16945.05757175386)`, looking at `(-11904.482029513456, 15, -11945.05757175386)`. This is the seed-1 regional sea, Clear weather, 1600 by 1000, pixel ratio 1. Both captures settled for 45 seconds and reported 554 loaded tiles, zero pending/in-flight/ready terrain jobs and four workers. The renderer was real Chrome with ANGLE/Vulkan on Intel Xe Graphics. These stills are visual evidence, not frame-performance measurements.

Before, `b9e1ac86`:

![Before, sea shoreline from 9000 m](before-ocean-seed-1-9000m.png)

After:

![After, sea shoreline from 9000 m](after-ocean-seed-1-9000m.png)

Both images were inspected. The large steps at the left shore and the upper end of the inlet are removed. Coarse bank shading remains visible along the left edge. This does not certify all coasts or low-altitude transitions.

Run `scripts/review-water-coast.mjs before|after` with Node 22, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and optionally `REVIEW_URL` (default `http://127.0.0.1:5186`). Start Vite on that port with `--strictPort`. The script only exposes the existing development review camera through a browser response override; it adds no player UI. Destination, seed and settling time can be set with `REVIEW_DESTINATION`, `REVIEW_SEED`, and `REVIEW_SETTLE_MS`. Capture details are in the adjacent JSON files.

Validation: 52 checks across `waterCoarseCoast`, `waterSystem`, `waterMeshSteps`, `terrainGeometrySteps`, and `terrainWaterBed`, plus `npx tsc --noEmit`, pass on Node 22. Existing hash expectations are unchanged. The focused regression covers submerged formerly dry corners, the interpolated zero-height crossing, all-dry cells and preserved freshwater masks.

## Cold generation

No cold-generation optimization is retained. The largest sampled cost is water-river union work, followed by cold drainage channels/routing. Their algorithms are outside this branch's file ownership. A safe bounds/triangle rejection experiment in `WaterSystem.ts` preserved every sampled geometry digest, but did not demonstrate a reduction when measured in alternating pairs. Its seed-73 far work median/p95 was 202.02/290.06 ms before and 206.79/291.67 ms after; the water-river phase medians were 119.74 and 120.70 ms. The experiment was removed. Its exact patch and raw paired results remain in `cold-paired.json`.

### Method

Node v22.23.2, Intel Core i5-1135G7, on this machine. `profile-water-cold.mjs` collects independent empty-cache builds; `profile-water-cold-paired.mjs` alternates reference/candidate order AB then BA using two isolated module loaders in one process. Before each sample, a queried alternate seed clears hydrology and drainage caches, then the requested seed starts with an empty cache. No browser or tests were launched by this review during these studies. Normal host applications and the separately authorized water review could still vary host load. JIT remains warm across repetitions, so these are first-visit cache costs, not fresh-process startup distributions.

Each of the nine cases has 12 cold samples per side, including the first. At this sample count nearest-rank p95 equals the maximum. Median averages the central pair; p95 uses nearest rank. Work is the sum of wall-clock durations of iterator `next()` calls. Largest slice is one `next()` call, including any scheduling interruption. Process CPU is Node's user plus system CPU during the build, including VM helper threads and instrumentation, so it can differ from elapsed work. Phase totals and all individual samples are retained in JSON. No frame or GPU result is inferred from these CPU measurements.

Reference is main `b9e1ac86`; retained candidate uses the coast correction `c4cf05bc`. Hydrology, near and far coordinates are respectively the same fixed point per seed: seed 1 `(-33600,-18480)`, seed 73 `(-8400,-20580)`, seed 1337 `(63840,34860)`. Hydrology builds one 32 km catchment. Near builds a 420 m LOD-0 tile; far builds a 3360 m LOD-2 tile, including any additional cold halo catchments and river unions. These are water-area fixtures, not an exhaustive search of the infinite world.

### Retained main/branch comparison

All times are milliseconds, median/p95. Every sampled hydrology digest and every sampled complete terrain/water buffer digest matches across the comparison. Existing test hashes were not edited.

| Seed / case | Main work | Branch work | Main process CPU | Branch process CPU | Main largest slice | Branch largest slice |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 / hydrology | 34.05/81.98 | 35.87/79.37 | 49.63/182.03 | 57.97/180.83 | 2.41/6.13 | 2.33/4.93 |
| 1 / near | 46.26/76.26 | 42.54/76.53 | 78.64/181.57 | 59.96/177.45 | 2.02/4.17 | 2.33/5.75 |
| 1 / far | 45.48/58.86 | 44.91/55.96 | 55.66/152.31 | 55.76/92.61 | 1.97/3.01 | 1.90/3.13 |
| 73 / hydrology | 49.80/74.00 | 49.30/66.12 | 65.83/138.77 | 58.19/110.52 | 1.80/3.37 | 1.88/2.50 |
| 73 / near | 103.64/162.06 | 102.57/186.89 | 147.72/307.57 | 114.50/318.93 | 7.35/16.57 | 7.64/17.44 |
| 73 / far | 259.53/492.91 | 237.84/619.36 | 339.44/521.86 | 284.52/601.79 | 3.89/17.79 | 3.74/15.38 |
| 1337 / hydrology | 137.18/264.57 | 181.86/302.84 | 88.72/190.47 | 88.39/348.46 | 10.55/14.50 | 11.26/53.07 |
| 1337 / near | 247.23/348.56 | 262.90/448.42 | 204.09/356.76 | 209.26/441.44 | 7.89/20.24 | 12.92/20.20 |
| 1337 / far | 251.39/460.26 | 234.27/261.81 | 233.09/316.46 | 228.52/403.73 | 8.63/17.12 | 5.45/13.29 |

These retained tiles do not hit the changed sea edge and their output/work is unchanged. Timing differences are noise, not an optimization. Unmodified seed-1337 hydrology itself shows large drift, and the 53.07 ms largest branch slice is retained. No hard slice deadline or speedup is claimed.

The retained branch's main phase medians: seed-73 far water-river 138.93 ms, hydrology channels 33.30 ms, shore/ground 27.80 ms and routing 11.62 ms. Seed-73 near climate sampling takes 31.36 ms, channels 32.84 ms, water-river 10.44 ms and the final slope/normal stage labelled skirt 7.64 ms. Seed-1337 far channels take 141.95 ms and routing 58.81 ms in the noisier final study. Pure catchment construction is unchanged: seed-1 channels/routing 19.35/11.28 ms, seed-73 32.70/10.97 ms, seed-1337 72.51/78.83 ms. The full phase breakdown and actual maxima remain in the raw data.

Reproduce with Node 22, with browser review and tests stopped:

```sh
node scripts/profile-water-cold.mjs --baseline=b9e1ac86 --samples=12 --output=/tmp/cold-main.json
node scripts/profile-water-cold-paired.mjs --baseline=b9e1ac86 --samples=12 --output=/tmp/cold-main-branch.json
```

`cold-main.json` is the initial separate main-only study. `cold-main-branch.json` is the retained paired comparison above. `cold-paired.json` records the discarded culling experiment against `c4cf05bc`, including its patch. The separate initial study's much slower numbers and the paired control drift are why no cold improvement is asserted.

Validation: 46 targeted water/terrain checks, both profiler syntax checks and `npx tsc --noEmit` pass. No safe, measured cold-cost reduction was found within owned files.

## Controlled foreground comparison

Both routes completed and passed the script's matching checks. Reference is main `b9e1ac86`; candidate is `53ed4a08` (runtime code unchanged from `c4cf05bc`). This is one pair, run main then branch, not a repeated performance distribution.

### Protocol and scope

`scripts/review-water-foreground.mjs` runs each pinned reference through a separate Vite server instance on port 5188, sequentially, with one review tab at a time. It freezes source from Git, applies the same temporary measurement hooks to both builds, then closes the browser and server before starting the other side. No production source or player UI is instrumented on disk.

Real Chrome 153.0.8010.12 ran headless with ANGLE/Vulkan on Intel Xe Graphics, Mesa Vulkan 1.3.255. SwiftShader and xvfb were not used. Both documents reported visible and focused, with no visibility changes or JavaScript page errors. Settings were seed 1, Balanced, 1280 by 720, fixed pixel ratio 1, existing chase camera and normal Free flight rendering, physics, streaming, atmosphere and HUD. The fixture prescribes aircraft pose and boost controls; it is not a manual handling or landing test.

The maximum-speed route is 680 m/s at 5000 m altitude, from `(-12000,-16000)` east to `(2000,-16000)`, reversing on the same 14 km corridor. Each run travels 81.6 km in 120 simulated seconds. Of 141 coast-field probes 100 m apart along that corridor, 128 (90.8%) are sea. The route, settings and renderer match. The normal desktop and separately authorized review were not shut down, so host/GPU load is not isolated. No tests or other profilers were launched by this review during either run. First-run module/shader/filesystem warmup can affect startup; these are not repeated cold-start readings.

Frame intervals come from the existing bounded RAF timestamp recorder, including hitches; the whole 120-second route fits its ring. JS heap is Chrome's precise `performance.memory` reading, not process memory or VRAM. Resource samples occur about every 30 simulated seconds. Both runs retain four terrain workers and unchanged upload/render-distance/cache budgets.

CPU hooks time `World.update`, terrain update/drain/install calls and every worker terrain iterator `next()`. Identical counters add overhead to both builds. Main-thread method timings nest and must not be added together. Worker work is summed iterator wall time, not OS thread CPU, and concurrent worker totals can exceed wall time. Browser slice statistics below are distributions of each completed job's largest step. CPU counters and CDP TaskDuration/ScriptDuration cover launch through the final 10-second poll, including startup and up to one polling interval after route completion. They are not an exact 120-second flight-only CPU window. Frame and endpoint heap values remain the recorder's exact route-finish snapshot. Long Tasks and complete phase breakdowns are retained in JSON. This is an instrumented full-game comparison, not an uninstrumented FPS gain claim.

### Results

| Measure | Main | Branch |
| --- | ---: | ---: |
| Airfield ready after navigation | 6015.7 ms | 2208.7 ms |
| Launch to initial terrain coverage | 8031.2 ms | 4108.6 ms |
| Route wall time | 120028.6 ms | 121245.1 ms |
| Startup intervals, count | 230 | 210 |
| Startup interval median / p95 / maximum | 33.3 / 50.1 / 366.7 ms | 16.7 / 33.4 / 99.9 ms |
| Flight intervals, count | 4031 | 3806 |
| Flight interval median / p95 / p99 | 33.3 / 50.0 / 50.1 ms | 33.3 / 50.0 / 50.1 ms |
| Flight interval maximum | 83.4 ms | 699.9 ms |
| Flight intervals over 50 / 100 ms | 72 / 0 | 78 / 2 |
| JS heap start / endpoint / peak, decimal MB | 98.6 / 184.5 / 209.1 | 93.7 / 166.0 / 200.7 |
| Endpoint geometries / textures | 1347 / 4 | 1189 / 4 |
| Endpoint loaded tiles | 898 | 803 |
| Endpoint pending / in-flight / ready | 303 / 0 / 16 | 320 / 0 / 19 |
| World.update median / p95 / max | 2.5 / 9.7 / 53.2 ms | 2.6 / 9.6 / 22.7 ms |
| Terrain.update median / p95 / max | 2.2 / 9.4 / 21.3 ms | 2.2 / 9.3 / 22.4 ms |
| Terrain queue-drain median / p95 / max | 2.0 / 2.4 / 21.2 ms | 2.1 / 2.4 / 11.7 ms |
| Terrain install median / p95 / max | 0.1 / 0.2 / 10.4 ms | 0.1 / 0.2 / 2.5 ms |
| World.update total | 14236.6 ms | 13679.2 ms |
| Completed worker jobs | 2146 | 1666 |
| Summed worker generation work | 17258.3 ms | 10967.9 ms |
| Worker job total median / p95 / max | 4.30 / 21.90 / 246.70 ms | 4.15 / 18.90 / 220.00 ms |
| Per-job largest slice median / p95 / max | 1.2 / 7.1 / 21.5 ms | 1.1 / 4.2 / 9.6 ms |
| CDP main-thread TaskDuration / ScriptDuration | 48.973 / 43.277 s | 48.331 / 41.915 s |

The branch retains two flight hitches of 550.0 and 699.9 ms. Their cause is unverified; these hooks do not measure every browser/GPU/host stage. Similar median/p95 does not cancel the worse maximum. Lower worker totals and endpoint heap are not evidence of faster generation or a memory improvement: the branch completed fewer jobs and retained fewer tiles, and GC/host timing differs. Both routes finish with substantial pending terrain work. This review does not establish that streaming keeps up everywhere at maximum speed.

Heap grows during both short runs. There is no forced GC or post-quiescence acceptance, so this is not a leak test. A 15-minute endurance/memory comparison, attribution of the long hitches, an exact flight-only CPU window, other seeds/routes/weather, low-altitude motion and exhaustive coasts remain unverified. No FPS gain is claimed. The controlled 120-second route comparison itself completed.

### Repeated and reversed runs

The same script was run for three more pairs on the same laptop and renderer, comparing the same refs, `b9e1ac86` and `645bb10e`. Each pair runs sequentially in one session. Flight frame intervals in ms:

| Pair, order | Run | Median | p95 | p99 | Max | Frames over 100 ms |
| --- | --- | --- | --- | --- | --- | --- |
| 1, branch first | branch | 33.3 | 33.4 | 50.0 | 66.7 | 0 |
| 1, branch first | main | 33.3 | 49.9 | 50.0 | 83.2 | 0 |
| 2, main first | main | 33.3 | 50.0 | 66.7 | 700.0 | 2 |
| 2, main first | branch | 33.4 | 83.3 | 116.7 | 233.4 | 64 |
| 3, main first | main | 49.9 | 99.9 | 116.6 | 149.9 | 50 |
| 3, main first | branch | 33.4 | 66.7 | 83.3 | 149.9 | 5 |

Main produced a 700 ms hitch in pair 2, so the long hitches from the first comparison are not specific to this branch. Run to run variation on this host is larger than any difference between the two versions, and either version can have the worse run. No regression or improvement is established; their cause remains unverified.

Endpoint screenshots were inspected: [main](foreground-main-endpoint.png) and [branch](foreground-branch-endpoint.png). They show the matching Free flight pose and world at the route endpoint. The separate 9000 m stills above demonstrate the shoreline change.

Reproduce with Node 22 and installed Playwright/Chrome paths:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
CHROMIUM_PATH=/path/to/chrome \
REVIEW_BASELINE=b9e1ac86 REVIEW_CANDIDATE=53ed4a08 \
node scripts/review-water-foreground.mjs
```

Optional settings: `REVIEW_DIRECTORY`, `REVIEW_PORT` (default 5188, strict), `REVIEW_SECONDS` (120 to 900) and `REVIEW_WALL_LIMIT_MS`. `REVIEW_GPU=swiftshader` enables an explicit software fallback if hardware rendering fails; the default Vulkan run rejects an unexpected software renderer. Each run saves its source commit, arguments, renderer, matching checks, frame arrays, CPU phase counters, heap/resource timeline and endpoint image. Completed progress markers are omitted from the committed evidence because the final JSON contains the complete record.

## Final verification

Node 22.23.2 verification passed:

- Full suite: `npm test -- --maxWorkers=2 --testTimeout=15000`, eight Node checks and all 3462 Vitest tests across 287 files, 247.09 seconds for Vitest.
- `npx tsc --noEmit`.
- `npm run build`, including `version:check`, passed. The existing Three.js chunk-size warning remains.
- Foreground script syntax and both saved runs' route/settings/focus checks passed. All 12 digests in each of the nine cold pairs match; existing fixture files are unchanged.

The first default `npm test` run passed 3460 Vitest tests and timed out two tests at the existing 5000 ms limit (`legacyMissionGenerator` and `riverUnion`), after 159.49 seconds. A one-worker retry hit that same limit in `regionalWorld`'s wetland-distribution check at 5147 ms and was stopped. The final complete pass used two workers and a 15000 ms CLI timeout. No test file, assertion or hash fixture was changed, and no tests were excluded. See `verification.json`.

The last commit adds only the measurement script and review evidence; runtime code is the measured candidate. Release metadata remains with the other branch as requested.

The paused vegetation, flight-warning and blackout/redout systems remain excluded. No camera, mission, gate, scoring, featured-card, Free flight landing behavior or release metadata changes are included.

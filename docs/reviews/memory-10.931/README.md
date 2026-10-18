# Bounded memory diagnostic, 10.931

The active target is about 200 MB. This pass performs one snapshot comparison and makes no retained-memory optimization. Both post-collection heaps and both strong snapshot totals are already well below the revised target. It does not chase the former 155.4 MB limit.

The shipped 10.930 source, commit 2baa61e, runs in separate fresh Chromium processes at 1280 x 720, pixel ratio 1, Balanced quality, four terrain workers and unchanged resource budgets. The existing prescribed maximum-speed FlightReview fixture is used for this diagnostic. This is separate from the controls-only endurance evidence in 10.930. No other review browser or test/build runs during capture. Allocation sampling is off, so these runs do not pay its diagnostic allocation overhead.

| Route | Capture | Main heap before snapshot | Main heap after collection | Strong snapshot self total |
| --- | --- | ---: | ---: | ---: |
| Northeast, seed 73 | 200 MB trigger at 14.15 s | 200.84 MB | 76.83 MB | 87.28 MB |
| City corridor, seed 1337 | Route end at 120 s, trigger not reached | 129.40 MB | 74.39 MB | 87.30 MB |

The northeast frame that requested pause reports 200.14 MB. Inventory work before the snapshot sees 200.84 MB. The HUD fixture JSON updates once a second, so its last displayed peak is older than that trigger. The city run's actual per-frame observed peak is 148.18 MB over 120 seconds; it never reaches 200 MB. The driver therefore takes its one snapshot at route end. That city snapshot is **not a peak capture**. At that end state the aircraft has already left the loaded city, so its retention cannot stand in for the city-core peak. The absolute northeast route maximum is also unverified because the diagnostic stops at its trigger.

Snapshots force collection. The before/after inventory heap values use performance.memory; the strong-self totals sum the snapshot's strong graph, including external/native backing data, and use different accounting. They must not be subtracted into a claimed retained-memory improvement. Worker heaps, GPU/driver memory and always-new-region acceptance are not measured here. Streaming workers can finish queued jobs while the simulation is paused; queue counts therefore move during capture even though the inspected geometry/contact byte groups and aircraft positions remain unchanged.

## Largest retained categories and decision

The largest strong self type is native backing storage: 56.60 MB northeast and 53.11 MB city. This includes geometry/attribute buffers and external development-source text. The largest named script dominator is the Vite Three.js module at about 16.02 MB in each snapshot, including roughly 11.78 MB of external source text and an inline source map. These nested dominator values overlap and are not additive. The category is not evidence of a gameplay leak.

The direct scene inventory attributes 8.83/10.02 MB to terrain geometry, 5.89/7.18 MB to water geometry, and 9.09/2.13 MB to other geometry in northeast/city respectively. These inventory groups do not cover every native allocation. Regional drainage's node map retains about 2.26/2.98 MB; sampled hydrology caches retain about .11/.20 MB. The snapshots give no measured basis for cutting required world buffers, caches, detail or distances. No candidate optimization is attempted and no memory/FPS improvement is claimed.

`comparison.json` summarizes the actual capture states. Each route directory retains its raw compressed heap snapshot, dominator ranking, inventory, source hashes and paused still. Both stills are visually inspected as diagnostic pause views, with no application errors. They are not low-altitude artwork evidence. The low-altitude checks are retained in Parts B and C.

## Driver and verification

`scripts/snapshot-flight-heap.mjs` now defaults to a 200 MB trigger, accepts `HEAP_ROUTE=world|city`, names snapshots by route, and saves a still. `HEAP_TARGET_MB` can adjust a diagnostic trigger; it is not a production memory policy. Allocation sampling requires explicit `HEAP_SAMPLE_ALLOCATIONS=1`. Existing profiling callers can opt back in. The file suffix `-5` means the trigger was armed after five seconds, not that capture happened at five seconds.

Reproduce one snapshot each with `HEAP_ROUTE=world HEAP_SECONDS=5` and then `HEAP_ROUTE=city HEAP_SECONDS=5`, using the installed Playwright module, Chromium path and review server URL. Rank each snapshot with `scripts/rank-heap-retainers.mjs`. The driver syntax check, focused resource/coverage/version checks and production build pass. This bounded pass takes minutes, with no further attempt to reduce memory below 200 MB. Current-revision full-peak comparison, sustained memory and the historical hitch cause remain open. Paused systems and all rendering/streaming budgets stay unchanged.

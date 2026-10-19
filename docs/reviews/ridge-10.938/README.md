# Seed-73 ridge contact, 10.938

The historical Free flight crash reproduces at exactly 616.5 simulation seconds. The new origin position is only 0.063 m from the 10.930 record. This is a real collision with a rising ridge under the preserved external three-kilometre-lookahead pilot. No game physics or collision defect is demonstrated, so those systems are preserved.

## Exact reproduction

The frozen game is `cb51f2f`, the source identified by the original 10.930 served-source manifest. `pilot.js` begins with the byte-identical historical seed-73 pilot, then adds read-only contact capture. Its wrapper records the rich impact before `aircraft.crash()` clears the snapshot. It also retains half-second samples after 570 seconds. The browser runner exits with its expected `Flight hit ground` error after writing the actual crash; this is the reproduced outcome, not an application exception.

| Observation | Recorded value |
| --- | ---: |
| Contact simulation time | 616.500 s |
| Surface | dry land |
| Failure classification | slope |
| Surface slope | 26.249 degrees |
| Pre-impact vertical speed | +33.108 m/s |
| Velocity into the terrain normal | -38.910 m/s |
| Tangential speed | 214.272 m/s |
| Analytic surface at origin | 3,180.9810 m |
| Resident surface at origin | 3,180.9736 m |
| Surface-height difference | 0.0075 m |

A positive vertical speed does not imply terrain clearance: the ridge rises faster than the aircraft's flight path. The captured impact is airborne with gear up. Its immutable pre-resolution velocity/normal, rather than the later clamped velocity or changed controls, establishes the strike. There is no evidence here of an invisible water surface, streaming-height jump or obstacle false positive. `contact.json` preserves the complete contact and forward ground samples. `source.json` records hooks, source hashes and the comparison to the original record.

## Existing pilot policy on the current snapshot

The existing default review pilot already uses eight-kilometre lookahead, a 650 m clearance target and a higher pitch limit, introduced for the other 10.930 retries. Its seed-73 run completes 653.7 simulation seconds / 674.1 wall seconds, airborne and without application/shader errors. Near the original strike, the closest five-second observation is 489 m away horizontally, at 618.45 seconds with 585.64 m AGL. This is a separate real-physics flight with the existing more conservative policy, not an identical pose replay or evidence of universally safe handling.

The current snapshot is frozen `24530be` plus the pre-priority 10.936 terrain presentation candidate. Source hashes distinguish it from the final bank-queue repair. FlightModel, collision and physical/contact arrays remain unchanged; the current generated contact regression also verifies the same dry ridge surface. Both runs reset airborne once before measurement, then modify only control axes/power/assist. They retain production weather, fuel, physics, collision, streaming and HUD. All 22 minute stills are visually reviewed.

## Verification, FPS sample and scope

Two new checks regenerate the actual seed-73 resident contact tile, compare it to the analytic surface, and classify the captured climbing impact as a slope crash from the authoritative normal/velocity. The seven focused generated contact, collision, normals, resident surfaces, water agreement, removed-system and release files pass 40 checks. The production build passes with the existing bundle-size advisory.

The isolated seed-1337 city corridor completes 120 simulation seconds / 81.6 km at maximum prescribed speed, Balanced quality, 1280 x 720 and fixed pixel ratio 1, with production external-camera rendering. Mean RAF rate is **41.90 FPS** across **5,029 intervals**. Median/p95/p99 intervals are **16.7/33.4/50.0 ms**, with a **50.1 ms maximum**, **19 intervals over 50 ms** and **0 over 100 ms**. The raw record and final still are in `fps/city-sample/`.

This is one unprofiled development-recorder sample at 5,000 m altitude, not a paired performance comparison or low-altitude handling acceptance. No other review browsers, focused tests, offline surveys, traces or allocation profilers run during it. The source manifest identifies committed 10.937 plus the pending 10.938 metadata. Physics still runs, while the existing recorder prescribes its maximum-speed trajectory. Transient fallback residency and delayed tile admission from 10.936 remain documented costs; this sample does not establish a performance improvement. The recorder's existing heap telemetry is retained in the raw record without an allocation investigation or memory-acceptance claim. No heap optimization, snapshots, allocation profiling or target reduction is part of this work. The active target remains approximately 200 MB.

Manual handling, arbitrary-route pilot safety and every possible streamed contact remain unverified. No flight-warning strip, terrain-warning probes/tones, G-load effects or vegetation are restored. Landscape revision 29, route revision 30, water and all resource budgets remain fixed. Part D is a tightly reproduced diagnosis, not a claimed production physics fix.

Reproduce with `scripts/review-endurance.mjs`, `FLIGHT_SEEDS=73`, `FLIGHT_SECONDS=640`, `FLIGHT_HOOK=docs/reviews/ridge-10.938/pilot.js`, the frozen historical server in `REVIEW_URL` and `FLIGHT_SOURCE_COMMIT=cb51f2f`. Use the preserved `current-pilot.js` and a matching snapshot for the separate 650-second safety-policy run. Supply the installed `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`. The historical capture is expected to exit nonzero after saving contact.

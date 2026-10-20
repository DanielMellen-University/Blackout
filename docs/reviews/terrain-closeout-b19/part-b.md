# b19r Part B, 10.955

Two fresh seed-1337 endurance flights complete the pinned 650-second route on frozen commit `ff0613e` (10.954). Both are excluded from clean-flight acceptance because unexplained frame intervals recur. No production terrain cause is established, so no speculative terrain or physics change is made. Step 1 remains open for the third clean ten-minute flight.

## Attempts

| Attempt | Simulation / wall seconds | RAF intervals over 100 ms | Maximum terrain update | Peak main JS heap | Decision |
| --- | ---: | --- | ---: | ---: | --- |
| b19r first full attempt | 650.233 / 650.259 | 100.1 ms at 171.883 s | 26.0 ms | 190.0 MB | Excluded |
| b19r one additional repeat | 650.450 / 650.824 | 300.0 ms at 3.700 s; 133.4 ms at 171.867 s | 27.4 ms | 186.7 MB | Excluded |

Both have zero crashes, application/browser errors, ground contacts or missing terrain queries. Both retain 22 chase/cockpit stills. All 44 stills were inspected, with no new visible terrain seam, gap or floating object found. Weather and lighting are automatic; night and cloud views limit visibility. These attempts supplement the daylight appearance evidence and do not replace it.

The first attempt is in `endurance-supplemental/1337-b19r-attempt-1/`; the additional repeat is in `endurance-supplemental/1337-b19r-attempt-2/`. The earlier stopped b19 attempt remains at the parent directory, and the usage-limit interruption remains separately archived under `endurance-partial/`. No seed-1337 file remains under the accepted `endurance/` directory.

## Recurrent timing event

The original excluded b19 attempt records 116.6 ms at 171.883 seconds. The first b19r attempt records 100.1 ms at exactly the same simulation time and nearly identical position, around x 56066, z 34982. The last repeat records 133.4 ms at 171.867 seconds, around x 56063, z 34982. The additional 300 ms event occurs before the first screenshot at 3.700 seconds. These events fall outside the declared screenshot exclusion windows; the early event is not removed after the fact.

Preceding terrain updates for the b19r events measure 0.1 ms, 2.3 ms and 0 ms respectively. They do not establish where the total frame interval was spent. Terrain, worker/deferred GPU work, review instrumentation and other application work are not ruled out. No profiling overlaps either flight, and no causal attribution is claimed. The repeat allowance is exhausted, so this batch does not start a third acceptance attempt.

## Frozen method and verification

The starts and heading come from `docs/reviews/stability-10.941/1337.json`: x 18000, z 35000, heading pi/2, with 650 m starting clearance. The archived hook remains `5e56e767f56ab99b1626e69b8b9686fef864e81bb63c9fbe661e803f8a9df6f6`. Both flights use the same source hashes, Chromium 153 hardware renderer, Balanced quality, 1280 x 720 viewport, pixel ratio 1, airborne reset and control-only pilot. Production physics, collision, streaming and automatic weather remain active. No tests, builds, profiles or other review flights overlap either capture.

`verification/part-b-records.json` records the exclusions and validated source/hook identity, route, runtime, flight states, durations, coverage and still existence. The accepted summary remains 20 complete records with `completeEvidence: false` and only seeds 42 and 73 counted as clean endurance flights. Heap remains an observation against about 200 MB; no optimization or performance improvement is claimed.

Focused tests and production build pass before this part is committed; outputs are retained in `verification/part-b.txt`. The production runtime is unchanged except release metadata. No new feature, mission polish, city/roads redesign, paused system or b20 work is added. The final report will collect the four bar decisions without marking terrain done.

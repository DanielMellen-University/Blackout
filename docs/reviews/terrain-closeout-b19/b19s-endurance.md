# Third clean endurance flight, b19s, 10.958

**The three-flight endurance item passes on seeds 42, 73 and 1.** Seed 1 completes 650.533 simulation seconds and 650.537 wall seconds with the original controls pilot, no frame interval over 100 ms, no terrain update over 50 ms, no aircraft contact and no browser/application errors. The formal roadmap close-out is Part C.

Exactly three full ten-minute attempts were made in b19s. No tests, builds, independent profiles or other browser flights overlapped any of them. All three use frozen source commit `d93f312` (10.957), the original hook hash `5e56e767f56ab99b1626e69b8b9686fef864e81bb63c9fbe661e803f8a9df6f6`, balanced quality, pixel ratio 1, the same Chrome/Vulkan runtime as the inherited evidence, automatic weather and time of day, and 650 m starting clearance. Physics, collision, scoring and route revisions remain unchanged.

| Attempt | Seed | Simulation / wall seconds | Frame exclusions | Decision |
| --- | ---: | ---: | --- | --- |
| 1 | 2026 | 650.600 / 650.629 | 116.6 ms at 497.667 s | Excluded, retained under `endurance-supplemental/2026-b19s-attempt-1/` |
| 2 | 9001 | 650.267 / 650.826 | 516.7 ms at 523.900 s | Excluded, retained under `endurance-supplemental/9001-b19s-attempt-2/` |
| 3 | 1 | 650.533 / 650.537 | None | Accepted under `endurance/1.json` |

No fourth full attempt was made. Neither failed alternate-seed interval was profiled, so neither is causally assigned. The seed-2026 event is near another far-look-ahead catchment boundary, but that is a lead, not proof. The seed-9001 interval remains unexplained. Neither event is waived or removed from its raw record. Original b19/b19r seed-1337 exclusions remain excluded as well.

## Acceptance and route identity

The alternate-seed option is authorized by the user after [seed 1337's recurring stall was attributed to the review pilot](hitch-1337.md). `endurance-selection.json` explicitly selects 42, 73 and 1 and records why. There are no historical endurance pins for 2026, 9001 or 1; the runner uses their existing, unchanged `routes.json` start and heading instead. Seed 1 starts at x -92800, z -13600, heading 1.1780972450961724. Historical endurance pins for 42, 73 and 1337 remain exact. No new route is generated.

Seed 1 retains 22 paired minute stills, covers approximately 143.193 horizontal km, has p95 frame time 33.4 ms, maximum frame interval 83.3 ms and maximum terrain update 27.2 ms. Peak sampled main JS heap is 209.4 MB; the approximate 200 MB reference is observed without optimization. Its single missing-coverage query is the first reset step at 0.0167 s, matching the earlier seed-1 appearance/LOD reset behavior. There are no misses at or after the existing five-second coverage warmup boundary; every picture pose has resident coverage. Frame timing still counts early intervals, excluding only the original 1.5-second window per screenshot. No timing grace period is added.

`node scripts/summarize-terrain-closeout.mjs docs/reviews/terrain-closeout-b19 --final` passes all **21 required records**, including all six-seed audit/final/LOD records and three accepted endurance records. It preserves source-file/hash checks against the frozen runtime excluding release metadata, hook hashes, still counts/existence, both cameras, duration, flight state, coverage, strict timing exclusions and unchanged route poses. It explicitly rejects diagnostic flights. Ten focused validator checks cover successful complete evidence and rejected diagnostics, short duration, frame gaps, terrain stalls, missing coverage, changed historical/alternate routes, changed runtime and unauthorized seeds. The existing release and README tests bring Part B to 16 passing checks.

The evidence selection is explicit rather than treating any supplemental run as accepted. `summary.json` has `completeEvidence: true`, accepted endurance seeds 42, 73 and 1, and the known open seed-1337 issue. This flag validates record completeness and runtime identity; it does not itself certify image appearance.

## Visual review and its limits

All 66 stills from the three new full flights were inspected, including the excluded attempts. Night, cloud and high-altitude views limit object-contact inspection. The earlier dedicated clear-daylight low-altitude passes and normal-altitude LOD sequences continue to supply the agreed appearance checks. No new low-altitude or normal-altitude appearance failure is established by this endurance review.

The seed-1 605-second chase/cockpit pair contains a small sky-colored rectangular patch on distant ground. The cockpit still is at 606.633 simulation seconds and 2566.98 m AGL, outside the previously accepted low-altitude and 565-909 m normal-altitude appearance envelope. A separate static scene check at its recorded camera position, after 25 seconds of terrain settling, shows continuous terrain there; a ray through the patch's approximate pixel position intersects `TerrainChunk` at x 33111.659, y 183.507, z 39881.270. This check uses a static camera and world updates only after a normal launch, not a fourth endurance flight or a physics test. Its raw script, settled image and ray data are retained in `diagnostics/seed1-high-altitude-patch/`.

That check does **not** explain the original patch or prove the absence of a transient streaming/rendering gap. It remains an unresolved high-altitude image finding, with no claim of a fix. The scoped decision is to retain it as a limitation outside the agreed appearance-route envelope, not add another acceptance requirement or reopen the already accepted bounded six-seed appearance passes. This is a good-enough close-out, not a claim that every frame or coordinate is defect-free.

## Verification and delivery

`verification/b19s-part-b.txt` retains the 16 focused checks, production build, complete evidence summary and separate validation of both excluded alternate-seed records. Raw runner logs are `verification/b19s-capture-{2026,9001,1}.txt`. The existing build bundle-size advisory remains. No production source beyond release metadata changes, and no b20 work begins. Seed 1337's harness issue, its historical early event, both excluded alternate-seed intervals and the high-altitude image finding remain documented limitations.

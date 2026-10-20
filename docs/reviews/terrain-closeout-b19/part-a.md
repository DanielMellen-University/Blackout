# b19r Part A, 10.954

The b19 leftovers pass validation against the current production runtime. The required pull reports origin/main already current at `5ec0cd5` (10.953). No production terrain repair is justified by this evidence. Terrain step 1 stays open pending one fresh complete seed-1337 endurance flight.

## Accepted evidence

- `final/`: six fresh 45-second low-altitude routes, seeds 42, 2026, 9001, 1, 73 and 1337, with six chase/cockpit stills each. All 36 stills were rechecked during b19r. No visible seam, gap, floating building or broken/floating road was found.
- `lod/`: all six normal-altitude passes exceed 25 seconds, sampled at 565-909 m AGL. Six continuous WebMs, 24 stills and twelve sequence sheets retain both production cameras. All 240 half-second sequence frames were rechecked in order. No obvious LOD silhouette jump, opening crack or abruptly appearing terrain patch was found. Deliberate camera switches and capture-related camera changes are visible and are not terrain events. See `visual-review.md` for timing and sampling limits.
- Five appearance groups are distinct in the retained views: alpine snow, tan desert/orange badlands, green rolling ground, charcoal volcanic cinder and sandy blue-water coast.
- `endurance/42.json`: 650.500 simulation seconds, 650.520 wall seconds, 22 chase/cockpit minute stills, no errors or gaps over 100 ms, no missing terrain queries, maximum terrain update 27.3 ms. Peak observed main JS heap 218.3 MB.
- `endurance/73.json`: 650.333 simulation seconds, 650.382 wall seconds, 22 chase/cockpit minute stills, no errors or gaps over 100 ms, no missing terrain queries, maximum terrain update 25.3 ms. Peak observed main JS heap 236.9 MB.
- All 44 endurance stills were inspected during b19r. Weather, lighting and terrain change along the flights without a reproduced visible terrain defect. Night and cloud views have limited visibility; the dedicated daylight six-seed review carries the appearance check.
- `mission-loads.json`: the five featured missions and Random world select and launch successfully with no recorded browser errors. This is only a loading check.

## Excluded evidence

`endurance-supplemental/1337.json` is the earlier deliberately stopped 372.333-second attempt, with one unexplained 116.6 ms frame interval. Its cause is unverified; a preceding 0 ms terrain update does not prove terrain or deferred GPU work was uninvolved. It does not count toward acceptance.

`endurance-partial/1337-usage-limit/` retains the interrupted repeat: 116.667 simulation seconds, 116.692 wall seconds and four stills. It is incomplete and excluded from `summary.json`. The fresh b19r flight will replace neither archive.

The one seed-1 missing-height query in both the final and LOD records occurs at 0.0167 seconds, during the airborne-reset streaming transition. There are no misses after the five-second warmup and every retained image pose has mesh coverage. This reset observation is not hidden or counted as a flight terrain gap.

## Validation and scope

`node scripts/summarize-terrain-closeout.mjs` validates 20 complete records. The validator now checks the entire source-file set against the current tree, source hashes excluding release metadata, archived hook hashes, still existence and counts, flight states, both cameras, post-reset coverage, pinned endurance starts/headings and clean endurance timing. All five archived hook filenames independently match their SHA-256 contents. No accepted seed-1337 endurance record exists in this part, so `completeEvidence` remains false.

The injected hook is review-only: one airborne reset and then control axes, with production physics, collision, weather, streaming and cameras. The original source is frozen at 10.953 for the new evidence, identical to the audit runtime except release metadata. No production code changes occur here except `src/core/Version.ts`. Frame metrics exclude 1.5-second screenshot windows per image; terrain timings include them. Heap is observed against the approximate 200 MB target, with no optimization or new performance claim.

Focused tests and the production build pass before this part is committed. The retained check outputs are in `verification/part-a.txt`. Production physics, landscape/route revisions and resource budgets remain unchanged. No feature, mission polish, city/roads redesign, warning strip, vegetation, blackout/redout system or b20 work is added.

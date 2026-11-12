# Operation replay follow-up verification (11.041)

Run in the isolated `feat/replay-followups-20261111` worktree on Node v22.23.2, based on PR #6 commit `fcd7c37a`. No network, push, merge, tag, rebase, browser, GUI or listening preview was used. No other checkout was modified. The public version remains v0.12.0; the repository's internal behavior-change convention advances the chunk to 11.041, with 11.040 as the previous chunk.

## Issues and regression checks

Each code fix was preceded by a failing reproduction. Existing correct behavior received additional passing boundary tests rather than an unnecessary code change.

| Issue | Reproduction before the fix |
| --- | --- |
| Decision/sample failures stopped at the containing object | 6 precise-path assertions failed |
| JSON nesting had no bound | Deep-input rejection assertion failed |
| Import and export had no file-size budget | 3 oversized-input/export assertions failed |
| Canonical export omitted inherited/hidden fields or reread accessors | 3 unstable-record assertions failed |
| Dots, brackets and control characters made error paths ambiguous | 7 path assertions failed |
| Missing/extra CLI arguments were labeled invalid replay content | 2 usage assertions failed |
| Read errors and invalid JSON lacked clear file context | 2 read/directory and 2 invalid-content assertions failed |
| CLI read the whole file before applying the parser's size limit | Oversized-reader assertion failed |
| Malformed progress/history containers threw during export | 4 fail-closed assertions failed |
| A new finish could retain an older/mismatched transcript | 4 pairing assertions failed |
| Git-denied terrain evidence tests failed for the environment | 9 checks reproduced `spawnSync git EPERM` |
| Cockpit pacing test assumed the runner completed a frame quickly | A forced 250 ms delay produced 8 valid steps and failed the old `< 4` assertion |
| Oversized history retained the oldest twelve results | Newest-history assertion failed |
| Stored replay arrays accepted malformed/empty traces | 6 stored-trace assertions failed |
| Model harness cleared the surrounding world pad | Pad restoration assertion failed |

Additional regression coverage pins fuel/nitro endpoints, zero time/speed, stage boundary ordering, safe integer score claims, empty stages, non-object roots, BOM and trailing-data rejection, malformed checksums, and equivalent integer/decimal/exponent/signed-zero canonical spellings. The checked-in seed-42 replay and 11.038 performance fixture remain unchanged.

## Targeted checks

Commands below use `./node_modules/.bin/vitest run` followed by the exact arguments in the table. Counts are the passing post-change runs at each checkpoint, not cumulative totals.

| Commit | Vitest arguments | Result |
| --- | --- | --- |
| `03e60254` | `tests/operationReplayFile.test.ts tests/version.test.ts tests/readme.test.ts` | 78 passed |
| `a2ee7586` | `tests/operationReplayFile.test.ts` | 73 passed |
| `9b5a7b74` | `tests/operationReplayFile.test.ts` | 76 passed |
| `4ee71862` | `tests/operationReplayFile.test.ts` | 103 passed |
| `3c361fd8` | `tests/operationReplayFile.test.ts tests/operationReplayExport.test.ts` | 112 passed |
| `a352cad6` | `tests/operationReplayFile.test.ts` | 112 passed |
| `c46f48ec` | `tests/operationReplayCli.test.ts` | 11 passed |
| `c5511537` | `tests/operationReplayCli.test.ts` | 12 passed |
| `0338d457` | `tests/operationReplayCli.test.ts` | 13 passed |
| `dc7cae98` | `tests/operationReplayExport.test.ts` | 10 passed |
| `e106fec1` | `tests/operationReplayExport.test.ts tests/operationSave.test.ts tests/operationSession.test.ts` | 39 passed |
| `957866ae` | `tests/terrainCloseoutEvidence.test.ts tests/gitCapability.test.ts` | 12 passed, 9 skipped |
| `fb85867d` | `tests/operationDeck.test.ts` | 2 passed |
| `906be27d` | `tests/version.test.ts tests/readme.test.ts` | 6 passed |
| `f94dcb35` | `tests/operationSave.test.ts tests/operationReplayExport.test.ts` | 28 passed |
| `4ecdd8fc` | `tests/operationSave.test.ts tests/operationSession.test.ts tests/operationReplayExport.test.ts tests/operationPlayback.test.ts` | 50 passed |
| `f9f6cb43` | `tests/operationHarness.test.ts tests/operationReplayFile.test.ts tests/operationPerformance.test.ts` | 123 passed |

`npm run version:check` passed. `./node_modules/.bin/vitest run tests/terrainCloseoutEvidence.test.ts --reporter=verbose` passed 1 and skipped 9, displaying the explicit reason: `Git archive reads unavailable (EPERM); frozen-runtime evidence checks require Git subprocess access.` Only Git-dependent checks skip. The unauthorized-seed check runs, and the helper's eleven tests distinguish missing/denied capability errors from unexpected failures. The Git-enabled archive checks cannot be exercised in this sandbox; their original validation assertions remain intact.

## Scope limits and proposals

No player-facing UI, camera, flight physics, nitro, gates, featured cards, scoring, landings or paused systems changed. Roadmap items 11, 12 and 13 were not started. No GUI/browser pass is claimed. Proposed follow-up only: a fuzz-generated JSON parser corpus, including bounded malformed Unicode and nesting cases. It was not implemented in this run.

## Default full-suite run

`npm test` exited 1. The Node script test passed 1/1. Vitest reported 3,279 passed, 5 failed and 9 skipped (3,293 total), across 262 test files, in 208.55 seconds. All five failures reported `Test timed out in 5000ms`; there were no assertion failures:

- `tests/legacyMissionGenerator.test.ts`: rotating objective terrain requirements.
- `tests/regionalWorld.test.ts`: nearby pond concentration.
- `tests/riverUnion.test.ts`: broad turning trunk coverage.
- `tests/smallPonds.test.ts`: small basin contour coverage.
- `tests/weatherIntegration.test.ts`: 900 simulated seconds of resource retention.

The nine skips are the separately identified sandbox Git capability restriction. The default timeout failures are recorded here rather than counted as passing checks.

## Serial full-suite run

At `f9f6cb43`, `npm test -- --maxWorkers=1 --testTimeout=20000` passed. The Node script test passed 1/1. Vitest reported 262 of 262 test files passed, 3,284 tests passed and 9 skipped (3,293 total), in 503.39 seconds. The five tests that timed out in the default run passed here with one worker and a 20 second timeout. The nine skips are the same Git capability restriction.

## Production build

At `f9f6cb43`, `npm run build` (`npm run version:check && tsc && vite build`) exited 0. The version check and type check passed and Vite finished the bundle, with its standard warning that some chunks are larger than the size limit. A successful build is not a browser or GUI check.

## Local commits

```text
03e60254 Report exact replay validation fields.
a2ee7586 Bound replay JSON nesting.
9b5a7b74 Limit replay files to a bounded byte budget.
4ee71862 Cover replay boundaries and canonical spellings.
3c361fd8 Reject unstable replay export records.
a352cad6 Escape replay error paths unambiguously.
c46f48ec Clarify replay verifier usage errors.
c5511537 Identify replay input failures clearly.
0338d457 Bound replay CLI file reads.
dc7cae98 Fail closed on malformed replay export progress.
e106fec1 Keep saved replays paired with their finishes.
957866ae Skip terrain evidence checks when Git reads are denied.
fb85867d Make cockpit pacing checks deterministic.
906be27d Document shipped replay hardening.
f94dcb35 Retain the newest saved operation finishes.
4ecdd8fc Validate stored operation replay samples.
f9f6cb43 Restore world pad state after operation harness flights.
```

Two documentation commits follow these: one brings README, ROADMAP and CHANGELOG up to date with the last three fixes, and one adds this record.

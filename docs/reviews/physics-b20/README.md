# b20 flight physics review

Scope: approved roadmap step 2, physics half only. Main was clean at e3fe1a2 (10.959) after pulling. There were no local leftovers to keep or discard. No terrain generation, mission design, boost behavior or paused systems change. The heap target remains about 200 MB; no heap work is included.

## Part 0: CI repair, 10.960

39e533a replaces `rg --files src` with Git source enumeration. The positive acceptance test runs with a PATH containing Git and no ripgrep. Hashes, source-set checks, durations, routes, timing, coverage and all other evidence rules remain intact. Actions checkout now fetches full history because the evidence validator compares with 897807f. README history is trimmed to retain its existing length limit.

Verification: 10 evidence tests pass; 166 files and 1,635 tests pass with `npm test -- --testTimeout=30000`; production build passes. The first unrestricted suite hit the existing hydrology test's five-second timeout during parallel load; the complete repeat passes. GitHub Actions for 39e533a is green.

## Part A: measurements and decisions, 10.961

Run `node scripts/measure-physics.mjs --baseline` and `node scripts/measure-physics.mjs` to reproduce [before.json](before.json) and [after.json](after.json). The baseline loads both physics files from 39e533a through Vite's module loader. The same scenario code calls production `Aircraft.step` in both cases. Source hashes identify the tuned working tree even though its report is generated before committing.

Calm air, gear up, dry full throttle unless stated, flat contact plane, 20,000 m initial altitude, fixed 1/120-second steps. The high altitude prevents contact from contaminating numerical probes; the game has no density-altitude model. Rates are measured after one second from 250 m/s. These are repeatable arcade handling measurements, not real F-35 performance claims.

| Probe | Before | After |
| --- | ---: | ---: |
| Full-stick roll | 143.08 deg/s | 184.71 deg/s |
| Full-stick pitch | 47.42 deg/s | 61.15 deg/s |
| Roll remaining 250 ms after release | 2.49 deg/s | 1.95 deg/s |
| Pitch remaining 250 ms after release | 2.88 deg/s | 1.76 deg/s |
| Ten-second sustained turn speed loss | 1.23 m/s | 44.75 m/s |
| Turn final speed, initial 340 m/s | 338.77 m/s | 295.25 m/s |
| Turn final load telemetry | 7.10 G | 8.00 G |
| Stall speed, idle deceleration to 2 m/s sink | 22.47 m/s (43.7 kt) | 43.74 m/s (85.0 kt) |
| Dry level top speed, 120 s | 340.00 m/s | 340.00 m/s |
| Thirty-second 30-degree climb, mean vertical speed | 160.93 m/s | 162.19 m/s |
| Climb altitude gain | 4,827.75 m | 4,865.74 m |
| Climb final speed | 319.71 m/s | 322.21 m/s |
| Thirty-second 30-degree dive final speed | 359.15 m/s | 356.91 m/s |

The turn probe starts at 90 degrees of bank, holds quarter pitch stick and full dry throttle for ten seconds. The bank keeps the pull nearly horizontal. The same input now turns faster, so final G also rises. It loses about 15 m of altitude. This is a sustained hard-turn probe, not a coordinated constant-G turn or a claim about every bank angle.

Decisions recorded without requesting clarification:

- Raise configured roll/pitch targets from 2.7/0.95 to 3.45/1.18 rad/s and response from 12/7 to 14/10 per second. Keep angular damping and delayed assist. Faster input response comes with prompt, smooth stopping.
- Replace stick-proportional drag with squared flight-path turn load, bounded at 10 G for drag calculation only. Pure roll does not pay a turn penalty. G telemetry and physics acceleration remain active and uncapped by this drag bound.
- Apply gravity once as a vector; lift acts across the nose. Remove the second scalar climb charge. Keep 340 m/s dry cruise, 520 m/s afterburner cruise and the 680 m/s dive cap. Afterburner activation, thrust, fuel, visuals and controls are unchanged.
- Blend lift and alignment continuously with speed and angle of attack. Low-speed reference is 48 m/s; full low-angle support is 68 m/s versus 92 before. Separation starts at 0.32 rad and blends through 0.68 rad. A gentle nose drop permits deliberate forward-stick recovery without random wing drops or alerts.
- Raise rotation reference from 26 to 40 m/s and reduce the initial rotation impulse from 11 to 8 m/s. Landing and contact limits remain unchanged. Normal approach around 62 m/s retains control authority. In the recovery probe, forward stick plus dry power followed by leveling reaches 221 m/s with about 56 m total altitude loss.
- Revision 31 namespaces all new course/session records. Existing unversioned revision 30 families stay byte-for-byte intact, including ghosts. Mission Records displays `PHYSICS R31` and a separate `PRE-B20` best/completion/ghost-saved line. Old ghosts cannot become the new-physics pace reference. Legacy rotating and custom families are excluded from pruning; the new custom retention manifest has its own revisioned key.
- Terrain close-out regression tests now request the explicitly pinned `--archive-runtime` (e3fe1a2). The validator still compares every archived source hash and file set and verifies the original 897807f runtime delta. Its default continues to reject changes to the current runtime. This preserves closed historical evidence while permitting approved subsequent physics work.

Focused checks cover rates and settling, turn loss and G, cruise/climb/dive energy, stall/recovery, pure-roll retention, fixed-step agreement, unchanged afterburner constants, record/ghost isolation, legacy retention and historical evidence rejection cases. The production build passes. The full suite passes: 168 files, 1,644 tests, using `npm test -- --testTimeout=30000`. The corrected powered-dive check pins the measured 7 to 10 m/s gain in 1.5 seconds at half dry thrust, with gravity applied once. Ops streak storage also has its own revision 31 key; pre-b20 streak bytes are retained.

## Part B: production browser flights, 10.962 and 10.963

All 77 existing library entries load and are flyable through the exercised completion path. The accepted corpus contains 78 flights: every one of the 76 non-Free entries, including Random world and the hidden Weekly/Monthly replays, plus two full Free flights on seeds 42 and 73. Every mission clears all five production gates and ends `landed` / `complete`. Every touchdown centre is inside the 18 by 120 m runway footprint. See [all mission results and still links](mission-results.md) and [machine-checked browser results](browser-summary.json).

The two Free flights take off normally, make an approximately 80-degree-bank hard turn, climb and dive, deliberately enter a stall, recover with forward stick and dry power, return, contact the runway and stop with wheel brakes. They remain `running`, unscored and open, with no results overlay. Contact is the ordinary safe `roll` classification; the jet does not need a scored-mission terminal state to have completed its landing.

| Free flight | Flight seconds | Stall-entry speed / sink | Recovery speed / vertical speed | Stopped speed |
| --- | ---: | ---: | ---: | ---: |
| [Seed 42](free-42/free-flight/run.json) | 205.4 | 29.52 / -5.08 m/s | 199.63 / 1.27 m/s | 0.015 m/s |
| [Seed 73](free-73/free-flight/run.json) | 205.6 | 28.80 / -5.16 m/s | 201.45 / 0.94 m/s | 0.000 m/s |

These deliberate entries go below the 43.74 m/s onset measured in Part A; their entry-event speeds are not a second definition of stall speed.

### Method and limits

- Use a normal minified production Vite build, with an external controls-only pilot and read-only observer injected before bundling. The ordinary `dist` build remains free of review hooks. Each accepted run carries the production source hashes and the SHA-256 of its archived hook in [hooks](hooks/). `sourceCommit` is the base checkout at build time; hashes identify any then-uncommitted compatibility fixes. The validator checks every runtime source file against the final code, except release metadata in Version.
- Launch from the real runway through the DOM. Production aircraft integration, contact/collision, weather, thermals, streaming, gates, scoring, records and fixed-step `Time` stay active. There are no aircraft resets, pose/velocity writes, gate completion writes or clock overrides after launch.
- All accepted flights use the native browser wall clock. The two Free flights and the initial four featured mission checks use full draw cadence at 1280 by 720, ratio 1, Balanced quality. Most catalog checks limit only WebGL draws to one per 100 ms; simulation and streaming retain their native cadence. Four isolated repeats use full draw cadence. This verifies playability and compatibility, not a frame-rate or heap target.
- Default authored seeds and weather are retained. Random world uses seed 42. Daily is the 2026-10-20 challenge; Weekly replays 2026-W43 and Monthly replays 2026-10. The actual seeds are in the results table. No universal claim about every generated seed or physical input device is made.
- Core completion means all five gates and the game's accepted landing/completion state. Optional contract bonuses and medal optimization are outside this check; current missions remain scheduled for their later overhaul. No mission type, route, terrain generation, city/roads design or scoring threshold was changed.
- The optional external `/models/f35.glb` is absent in the baseline. Runs retain that expected 404 under `knownFallback`, and use the bundled F-35. Accepted `errors` arrays are empty. Each browser uses fresh isolated storage; the user's browser storage is never opened.

### Compatibility fixes

Two real b20 regressions found in browser review were fixed and pushed as 10.962:

1. The static takeoff brief and live hint still said 60 kt after the rotation reference moved to 40 m/s. Both now derive a readable 80 kt from configuration. [The ordinary production UI](records-r31.jpg) also shows the separate revision 31 and pre-b20 record families.
2. `ChallengeRun.reset` recognized only the literal `free-flight` ID. Revision 31 accidentally enabled scoring, contracts and a terminal landing report. Both legacy and current IDs now retain the existing unscored, open-ended Free flight behavior, with no record writes. The complete existing Free flight contract test runs for both IDs. Both accepted browser Free flights remain open after full runway stops.

The 195 affected briefing, HUD, challenge, physics and record tests pass, as does the production build. GitHub Actions is green for the CI repair, physics retune and 10.962 compatibility fixes. The final evidence batch passes 216 focused checks across 12 test files, the production build and the independent 78-flight / 328-still source-and-result validator. Release metadata is checked again before each commit.

### Visual review and excluded attempts

The retained Free flight stills show the banked jet, climb/dive transitions, slow-flight recovery and both runway stops. Inspect [seed 42 stopped](free-42/free-flight/complete.jpg), [seed 73 stopped](free-73/free-flight/complete.jpg), [storm completion](catalog/storm-run/complete.jpg), [record separation and 80 kt briefing](records-r31.jpg), and the linked per-mission captures. Chase and cockpit images are retained. They agree with the contact, gate and completion records. No warning strip, stall alert, blackout/redout veil or vegetation was added; G telemetry and existing instruments remain active.

Early attempts remain outside acceptance in `browser-pilot-v1`, `browser-pilot-v2`, `free-pilot-v2`, `free-pilot-v3`, `catalog-pilot-v2`, `catalog-clock-diagnostic` and [pilot-failures](pilot-failures/):

- The initial maneuver pilot turned into rising terrain with insufficient clearance. Later maneuvers use a high-clearance departure.
- An early approach aimed short of the asphalt; another leveled early or failed to brake after safe rolling contact. The pilot now follows a terrain-clearing descent and stops after accepted contact.
- Immediate low-altitude turns after the last gate caused terrain strikes. The pilot climbs clear before the return turn, except for the already aligned Contour/Weather final gates. Its return capture was widened to avoid an artificial holding loop. Brake Check was verified from the opposite runway end. These are review controls and target changes, not game route or mission edits.
- A clock-accelerated diagnostic froze `performance.now()` inside terrain work budgets. It was excluded; no accepted record uses that clock. A local server outage produced no launched flights; its batch diagnostic is retained separately.
- Four concurrent runs landed but reported a WebAudio device/renderer error. They were excluded and repeated in isolation without any game/audio code change. The accepted repeats have empty error arrays.

### Reproduction

Run `node scripts/build-physics-review.mjs`, serve `/tmp/blackout-b20-production` on port 5175, then use `scripts/review-physics-b20.mjs` with the same `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` environment variables as the existing review scripts. `B20_COURSES` selects comma-separated entries; `B20_SEED` selects a Free flight seed; `B20_RENDER_INTERVAL=100` selects catalog draw cadence, and zero keeps full cadence. Brake Check uses `B20_REVERSE_APPROACH=1`. `B20_RESUME=1` retains completed records. Run `node scripts/summarize-physics-b20.mjs` to require all 78 accepted flights and regenerate the results table.

## Part C: roadmap close-out

Physics verification is complete. Roadmap/release close-out follows in 10.964. Nitro and boost remain open for b21. All paused-system exclusions and the closed terrain and city/roads decisions remain in force. No heap work is included.

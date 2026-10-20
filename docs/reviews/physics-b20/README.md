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

## Part B: production browser flights

Pending. Evidence will include free flights on two seeds, hard turns, stall/recovery, climbs/dives, full landings and existing mission completion checks. Current missions receive no polish; only a reproduced physics compatibility failure may justify a fix.

## Part C: roadmap close-out

Pending browser verification. Nitro and boost remain open for b21.

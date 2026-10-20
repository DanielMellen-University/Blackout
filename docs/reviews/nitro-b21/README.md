# b21 nitro and boost review

The initial b21 session pulled main clean at 92f251f6 (10.964), before Parts A through C shipped. Scope is approved roadmap step 2, boost half only. Dry b20 physics, terrain generation, current mission design, city/roads, G telemetry and all paused exclusions remain unchanged. No heap work.

## Part A: reserve and thrust, 10.965

| Full-throttle level-flight quantity | Before | After |
| --- | ---: | ---: |
| Effective boost thrust at 10,000 kg | 1,122,768 N | 1,754,325 N |
| Boost acceleration before drag | 112.28 m/s² | 175.43 m/s² |
| Initial net acceleration from dry cruise, 340 m/s | 64.28 m/s² | 127.43 m/s² |
| Boost level equilibrium / top speed | 520 m/s (1,011 kt) | 650 m/s (1,264 kt) |
| Shared dive cap | 680 m/s | 680 m/s |
| Time to drain full nitro | No reserve limit | 12 s |
| Passive empty-to-full refill | Not applicable | 45 s |
| Accepted gate refill, including final gate | None | 25% |

Numbers use production thrust `milAccel * boostThrustMul * mass`. The old `maxThrust` and `boostThrustMul` values were unused by the b20 integrator: old physical multiplier was `(520 / 340)^2`. The new configured multiplier `(650 / 340)^2` is shared by physics and engine telemetry. Nominal `maxThrust` remains untouched; it is not used to claim physical thrust. Equilibrium is a full-reserve sustained-power reference; focused real integrator checks also verify a normal burst exceeds 635 m/s from 340 m/s within ten seconds. Dry cruise, rates, lift, drag, brakes and the dive cap remain fixed.

Decisions: start each sortie full; drain only when fuel and throttle permit actual burning. Refill when not burning, including empty while the key stays held. At empty, cut the authoritative engine flag so thrust, fuel burn, HUD, sound and exhaust agree. Wait for 15% reserve (6.75 s from empty) before automatic restart, preventing empty-edge stutter. Gates add reserve immediately, capped at full; they also release empty lockout. Pausing uses the existing stopped simulation clock. All gameplay values live in flightConfig.ts.

Revision 32 stores new records, retention manifests, Ops streaks and ghosts separately. Revision 31 and unversioned pre-b20 families are retained byte-for-byte and excluded from current-family pruning. Mission Records can show both historical families. No save deletion or migration.

Focused checks cover drain, passive refill, gate refill and clamp, hysteresis while held, invalid time, resolved thrust/cutoff, burst speed, unchanged dry b20 probes and old/new record and ghost isolation. Verification: 137 affected physics/engine/course/retention/ghost checks and nine reserve/history checks pass; production build passes. The full suite also runs as a broader regression check.

## Part B: HUD meter, 10.966

A compact full-width reserve rail sits below the paired speed/engine instruments. Blue means reserve, pale orange marks actual boosting; the label reads BOOST with the percentage only during resolved burner activity. Accepted gate counters trigger a 650 ms border pulse, even if a full reserve clamps the refill. Reduced motion keeps the border confirmation without animation. Accessible meter values stay bounded; a sortie reset clears the prior pulse. Empty reserve remains a neutral percentage, without warning text.

The existing unobstructed first-person view hides the entire HUD. This established behavior is retained; no cockpit veil or frame is added. Chase/orbit retain the reserve meter.

Verification: 154 focused instrument, HUD, structure, paused-system, nitro and aircraft visual checks pass; production build passes. Browser stills and source hashes are in [hud/review.json](hud/review.json): [full](hud/full.jpg), [boosting](hud/boost-chase.jpg), [first person](hud/boost-cockpit.jpg), [gate pulse](hud/gate-refill.jpg), [settled](hud/refill-settled.jpg). The controls-only pilot burns reserve before crossing the first real gate. Images were inspected for placement, overlap and palette. A zero-time refresh regression discovered by the broader aircraft suite is fixed: resolving feedback with dt=0 preserves available boost without spending reserve. The initial unrestricted suite exposed two existing terrain test timeouts at five seconds under parallel load; a complete repeat uses the b20 30-second allowance.

## Part C: sound and exhaust, 10.967

Ignition combines a 320 ms rising rush, brown-noise body and low turbine rise. Sustained boost raises the existing engine bed by 45%, opens its filter to 670 Hz at full power and adds modest turbine presence. Release drops the bed smoothly and plays one 240 ms descending tail. Existing master/channel volumes, mute, cockpit mix, suspension, limiter and node reuse remain active. There is no repeated alarm or new audio system.

Resolved boost grows the existing layered blue/white exhaust to 3.4 longitudinal scale, 1.5 width and a stronger nozzle glow at full lever. Dry exhaust remains compact. Chase framing eases aft only during boost and reduces forward lead so the flame can be seen. First person retains its existing restrained audio and camera response; its view remains unobstructed. Reduced motion suppresses the existing exhaust pulse and camera sway. No screen veil is added.

Verification: 121 focused audio, camera, aircraft and nitro checks pass; production build passes. [Feedback stills and graph telemetry](feedback/review.json) cover dry, boosting chase, clean first person, release and refill. [Recorded production sound](feedback/boost-sound.webm) taps the post-limiter graph, with one ignition and one release. The browser reports a running audio context, a 0.609 boost engine gain externally and about 0.56 in first person. The prior complete suite passes 169 files / 1,653 tests with the documented 30-second allowance. Full mission and hard-boost Free flight validation follows.

## Part D: browser compatibility review, 10.968 (b21r)

The relaunch pulled main at 6a468fd5 (10.967). Parts A through C remain shipped. The interrupted controls pilot, build hooks and observer were reviewed and retained. One complete Training orbit run remains accepted after source/hash checks. Incomplete saved flights are rerun from launch; their partial telemetry does not count. Partial progress waits for the terminal screenshot before treating an unaccepted save as finished, avoiding a false rejection between touchdown and the final acceptance write.

Review method: minified production Vite mode, native browser wall time and the unchanged fixed-step Time implementation. A separate review build injects an external controls-only pilot and read-only observers before bundling. It does not write position, velocity, orientation, reserve, gates, clock or completion. The ordinary production bundle is built separately. Streaming, weather, collision, scoring, record identity and gate evaluation remain active. Most catalog rendering limits WebGL draws to one per 100 ms; Free flights retain full draw cadence. The validator requires the complete runtime source set and matching SHA-256 hashes; only Version.ts is exempt so release metadata can advance after the flights. The existing optional `/models/f35.glb` 404 is retained separately as `knownFallback`; the game uses its normal procedural aircraft model. Other browser errors reject a run. This checks playability and boost compatibility, not frame rate, heap targets or every possible seed.

The pilot burns nitro in aligned bursts near mission gates. Each run must observe actual boosting, all five refill calls with exactly +25% capped at full, at least one reserve increase, five accepted gates, a runway touchdown and the normal landed/complete results. Optional contract bonuses and medal optimization are outside acceptance. Free flights on seeds 42 and 73 must drain to cutoff, refill passively to at least 75%, boost again, perform the existing handling/stall/recovery sequence and stop on the runway while remaining unscored and open.

Two early mission runs completed and landed but were excluded because short bursts ended too far before the gates: passive recharge reached full before every crossing. The review pilot now starts its 0.8-second burst within 260 m. This is an evidence-harness correction, without any gameplay, route or physics change. Retained attempts: [Daily challenge](excluded/early-burst-daily-ops/run.json) and [Contour circuit](excluded/early-burst-contour-circuit/run.json).


Accepted full-cadence Free flight measurements (simulation seconds):

| Seed | Flight seconds | Peak boost speed | Full drain | Empty to 75% | Final speed |
| --- | ---: | ---: | ---: | ---: | ---: |
| [42](free-42/free-flight/run.json) | 356.1 s | 648.3 m/s | 12.0 s | 33.77 s | 0 m/s |
| [73](free-73/free-flight/run.json) | 322.8 s | 648.5 m/s | 12.0 s | 33.77 s | 0 m/s |

Both observe the empty engine cutoff, then renewed afterburner activity after passive refill. Both touch down inside the runway footprint using the production safe rolling-contact classification and remain running, unscored, with no results overlay after stopping. These are the exercised seeds and control sequences, without a claim that every route or maneuver is covered.

Reproduction: run `node scripts/build-nitro-review.mjs` and serve `/tmp/blackout-b21-production` on port 5176. Run `scripts/review-nitro-b21.mjs` with `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` pointing to the installed Playwright module and Chromium executable. `B21_COURSES` selects comma-separated library IDs; `B21_COURSE_FILE` reads the same list from a file. Catalog checks use `B21_RENDER_INTERVAL=100`; the default keeps full draw cadence. Run Free flight separately with `B21_COURSES=free-flight` and `B21_SEED=42` or `73`. Brake Check uses `B21_REVERSE_APPROACH=1` for the established opposite-end runway approach. `B21_RESUME=1` skips accepted flights; the final source/hash validator must still accept them. `node scripts/summarize-nitro-b21.mjs` requires all 78 accepted flights and writes the result table and summary. `--partial` reports progress without accepting an incomplete corpus.

Automated verification for b21r: 205 focused checks pass across nitro, dry b20 physics, engine state, record retention, ghosts, paused effects, HUD, aircraft model, camera and version identity. The complete suite passes 169 files / 1,656 tests with `npm test -- --testTimeout=30000 --maxWorkers=2 --reporter=dot`, retaining the prior review's 30-second allowance while browser flights run concurrently.

Final result: **78 accepted flights and 334 accepted stills**. Every one of the 76 non-Free library entries, including Random world and the hidden Weekly/Monthly replays, loads, exercises boost, accepts all five gate refills and reaches landed/complete with its ordinary results. Every touchdown centre is inside the runway footprint. The two Free flights satisfy the drain/refill/restart and full-stop checks above. See [all mission results and still links](mission-results.md) and [machine-checked browser results](browser-summary.json). Completion stills were inspected across the entire catalog; some capture the existing results entrance animation. Unreferenced partial images and transient batch summaries were discarded, while the two excluded early-burst attempts remain separate.

No production boost defect was reproduced, so no gameplay, mission, physics, terrain, city/roads or paused-system fix is included in Part D. The only runtime-source edit is release identity. Roadmap step 2 closure follows in Part E; step 3 has not started.

The ordinary production build and the synchronized 10.968 version checks pass. The built shipping JavaScript contains no `__training` review hook.

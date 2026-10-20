# b21 nitro and boost review

Main pulled clean at 92f251f6 (10.964); no leftovers or already shipped b21 work. Scope is approved roadmap step 2, boost half only. Dry b20 physics, terrain generation, current mission design, city/roads, G telemetry and all paused exclusions remain unchanged. No heap work.

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

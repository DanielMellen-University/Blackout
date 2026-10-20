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

# 10.947 recovery and handling review

This directory retains its original 10.948 working name from the stopped run. The shipped recovery release is 10.947. Only the new `verified-*` captures are current acceptance evidence. Earlier captures remain available under their original names and are catalogued in `archived-runs.json`. They include incomplete flights and failed review-pilot settings, so their `before` and `after` labels do not establish a shipped comparison. `baseline-current-choice` is explicitly rejected because it was not kept isolated from editing.

## Fixes

The global Enter shortcut intercepted native activation of focused debrief buttons, so Choose mission retried instead. Focused interactive debrief controls now receive native Enter activation; Enter outside those controls and during the crash cinematic retains the retry shortcut. The existing debrief actions also accept standard-controller A / Cross for retry and B / Circle for mission selection. Both buttons must be released after entry and between actions. This prevents a held flight button from dismissing a new debrief. The footer explains these controls.

Fuel exhaustion already removed thrust and disabled afterburner, but exhaust presentation still used the open throttle lever. Plume visibility, glow and nozzle presentation now respect fuel availability. The lever readout is preserved. Flight physics, landing and collision thresholds, route generation, score/record rules, terrain, water and resource budgets are unchanged. Paused systems remain excluded. No mission type is added.

## Verification method and limits

`review-recovery.mjs` launches Contour circuit seed 982451 through the actual page and completes the production flight loop. A review pilot sends keyboard events or a virtual standard Gamepad API device through the production InputManager. It does not write aircraft pose, velocity, gates, scores or challenge phases. Crash is deliberately flown with pitch input. Go-around is a review-pilot manoeuvre, with an actual climb and second approach. Engine-out uses one explicit fuel-empty fault injection on final, then mapped controls. This is automated handling evidence; physical-controller ergonomics and subjective manual handling are not claimed.

`review-handling.mjs` uses Free flight seed 45671 and one airborne setup 250 m before the generated airfield. After that setup, only mapped controls drive descent, flare, contact and braking to a stop. A 20 Hz trace distinguishes actual wheel contact at speed from a final stationary pose. Free flight permits continued rollout instead of opening a scored debrief at touchdown. This controlled short-final fixture is separate from full gate-flight acceptance.

`review-engine-out-visual.mjs` recreates a previously recorded flight pose and holds it with an empty tank. Its orbit still and engine state verify exhaust appearance separately from handling. It is a static reproduction, not a controls-only flight.

All current browser runs use 1280 x 720, Balanced quality and fixed pixel ratio 1. The run records include source hashes, errors, screenshots, input events and final state. `verification-runs.json` records process outcomes. No runtime source edits occur during this accepted queue.

## Current results

| Device | Check | Flight seconds | Result |
| --- | --- | ---: | --- |
| keyboard | retry | 14.42 | Same seed/record family; ready, full fuel, stationary on runway |
| keyboard | choice | 14.42 | Selection visible; Contour retained; Launch focused |
| keyboard | go-around | 137.55 | Five gates and landing after climb-away and second approach |
| keyboard | engine-out | 58.65 | Five gates and landing after fuel-empty injection on final |
| keyboard | handling | 8.85 | Wheel contact at 39.4 m/s; brakes to 0 m/s |
| gamepad | retry | 14.43 | Same seed/record family; ready, full fuel, stationary on runway |
| gamepad | choice | 14.43 | Selection visible; Contour retained; Launch focused |
| gamepad | go-around | 137.95 | Five gates and landing after climb-away and second approach |
| gamepad | engine-out | 59.80 | Five gates and landing after fuel-empty injection on final |
| gamepad | handling | 9.43 | Wheel contact at 37.7 m/s; brakes to 0 m/s |

All eleven review processes pass, with zero page errors in the accepted records. Both go-arounds clear all five gates and land after a climb-away and second approach. Both fuel-empty flights clear all gates and finish with fuel unavailable. Retry preserves the seed and record family, clears the crash/debrief, restores fuel and resets to a stationary ready flight. Both mission-selection actions retain Contour circuit and focus Launch.

The first rollout threshold allowed 1.5 m/s and ended the controller capture at 1.3 m/s. Those two pilot runs are retained under `pilot-*-handling-threshold`. The final harness requires less than 0.05 m/s; both final traces reach exactly zero. Keyboard contact occurs at 39.4 m/s and controller contact at 37.7 m/s, near the runway centreline. This is a verification-harness correction, not altered aircraft braking.

The inspected current stills include the crash report and same-course retry, mission selection with four featured cards, cockpit flare, runway rollout/stop, go-around return, and engine-out orbit view. The fuel-empty visual records a 45% lever, zero effective power, no afterburner and a hidden plume. The automated regression also verifies zero nozzle glow. The unmodified production-bundle smoke separately exercises launch and Pause Retry; its title and retry screenshots are retained under `production-smoke`.

The final focused set passes 180 tests in 13 files, including removed-system/HUD checks. The production build and synchronized version check pass. `source-sha256.json` records all runtime sources and the page markup for the final evidence.

Reproduce with a Vite server on port 5174, the installed Playwright module in `PLAYWRIGHT_MODULE`, and hardware Chromium in `CHROMIUM_PATH`. Run `RECOVERY_AFTER=1 RECOVERY_DEVICE=keyboard RECOVERY_SCENARIO=crash node scripts/review-recovery.mjs <output>`. Add `RECOVERY_CHOOSE=1` for mission selection. Repeat with `RECOVERY_DEVICE=gamepad` and scenarios `go-around` and `engine-out`. Run `review-handling.mjs` for each device and `review-engine-out-visual.mjs <output> after` separately. The unmodified build is served by Vite preview for the production smoke.


# Blackout

Browser-based arcade flight simulator. Pilot an F-35, take off, fly hard, and either land or crash in style.

Built with **TypeScript**, **Three.js**, and **Vite**. No install beyond a modern browser once the app is running.

The production compiler runs with strict nullability and unchecked-index checks so terrain, flight, and UI changes fail fast at build time.

Current release: **v0.11.0** (`Systems expansion`). Internal roadmap chunks such as `10.119` are tracked separately from the public semantic version, and builds reject stale roadmap pointers.

## Features

- Title screen: Play, Controls, Game info
- Pause menu in flight (**Esc**): resume, fullscreen, quit to title
- Paused flight is labeled explicitly in the menu and frozen HUD so the simulation hold is unmistakable
- Automatic pauses explain whether focus, fullscreen, or graphics recovery caused the hold
- Pause focus handoff includes the same recovery context for assistive technology users
- Settings, Controls, and Game info dialogs announce the heading for the panel that is actually visible
- Modal dialogs keep frozen HUD telemetry out of the accessibility tree while Pause or Results has focus
- Mouse exits from Pause now resync input and accessibility immediately, matching keyboard resume behavior
- Pause opened after a focus loss now returns to the playable canvas instead of the browser body, keeping keyboard and mouse flight handoff reliable
- Pause and settings panels stay bounded and scrollable on short browser windows, keeping every control reachable by mouse or keyboard.
- Checkpoint circuit (5 rings; HUD arrow, range, and a beacon on the live gate)
- Route variety: orbit, sweep, precision slalom, high-altitude ridge-run, low-weave canyon-run, and low coastal-run circuits
- Checkpoint routes now vary by world seed, lead with a runway-aligned first gate, and validate an adaptive terrain corridor between gates so the intended flight line stays clear.
- Route profiles include orbit, sweep, slalom, ridge-run, and canyon-run layouts, with the active profile called out in the takeoff briefing.
- Heading guidance stays stable through loops and near-vertical climbs, so the HUD, return cue, and chase camera do not flip when the nose loses a meaningful horizontal bearing.
- The external camera also shortens its sightline before loaded buildings and airfield structures, keeping the chase view readable around settlements without extra scene geometry.
- Settings persist a keyboard yaw choice between A right / D left and A left / D right; gamepad and touch yaw stay on their hardware conventions.
- Settings also persist keyboard roll direction between Q right / E left and Q left / E right; gamepad and touch roll stay on their hardware conventions.
- Settings also persist keyboard pitch direction between W up / S down and W down / S up; gamepad and touch pitch stay on their hardware conventions.
- The takeoff briefing also reports route difficulty and minimum sampled terrain clearance, so the challenge is readable before the first input.
- Route profiles carry challenge intent in flight: approach, range, or precision; precision slalom gates use a tighter acceptance window and smaller visual ring.
- Arcade flight: nose-follows-path, ENG% is a speed target (50% ~ 1500 kts)
- Inland spawn on naturally flat ground; short pad level for the strip; hangar and tower
- Runway edge lights dim into daylight and brighten through dusk and night using the shared atmosphere clock.
- Runway daylight updates use the shared edge-light material directly, avoiding per-frame runway tree traversals.
- Crash boom (arcing fireballs) or scored landing; **R** new world
- Best runs persist per course with gate split traces and a lightweight external ghost path, so retries call out pace while the previous best remains visible in the air.
- External retries show a cached GHOST pace row while the best-run marker is active, calling out whether the current run is ahead, behind, or even without adding simulation work.
- Completion results include a compact G1 to G5 split strip with signed deltas against the previous best trace.
- The title and pause menus offer a card world picker for Random world, Free flight, and the curated course seeds, with route profiles preserved on retry.
- Results persist a completion count and fastest finish per course, making progression visible without introducing a campaign layer.
- Course selectors reuse that history, showing curated-course run counts and fastest times without touching the flight loop.
- The last selected course is remembered across reloads when browser storage is available, with a safe Random world fallback.
- The title screen shows curated-course completion progress, refreshed only at startup and after a completed run.
- Course progress and selection recover from cross-tab storage changes without adding per-frame reads.
- Malformed course history is repaired into a canonical record the next time it is accessed.
- Gate split traces are bounded and reject oversized, negative, non-finite, or non-monotonic local records before they affect pace guidance.
- Routes can draw a deterministic steady, tempo, or altitude rhythm, with scoring emphasis matched to the route flavor.
- Completed runs explain which scoring focus shaped the final score.
- Clean completed runs can unlock local course mastery badges shown on the results card.
- Title and pause world pickers show compact run and rank meta on each card, with best time, score, streak, and badge progress on the selected world.
- Curated course cards also keep each course's saved best score on the selected-world line.
- Course records self-heal malformed score and badge data without blocking launch.
- Fuel now resets per sortie, burns harder on afterburner, and warns before the tank is empty.
- The fuel row now shows estimated endurance for the current throttle and afterburner request, making the power tradeoff readable before the reserve lockout.
- A TEMP meter now tracks bounded engine heat from throttle and afterburner use, cooling at idle without changing the arcade thrust model.
- Crossing a heat band now gives one concise `ENGINE HOT`, `ENGINE HEAT CRITICAL`, or `ENGINE COOLING` cue instead of repeated alarm spam.
- Heat transition banners stay quiet during reset, pause, and crash recovery, then resume on the next live flight.
- Sustained critical heat now locks afterburner while preserving dry thrust until the engine cools, adding a forgiving power-management decision.
- When heat protection clears, the game announces `AFTERBURNER READY / ENGINE COOL` once, unless the fuel reserve lockout is still active.
- The engine panel keeps afterburner availability visible as `AB ON`, `AB READY`, `AB HOT`, or `AB FUEL` after transient banners fade.
- Hold `B` to deploy the speed brake for predictable airborne deceleration, or wheel brakes during rollout. Wheel brakes hold the jet against throttle creep until released, with a live `BRK OPEN` cue and matching control-surface flare.
- Speed-brake deployment now lifts the existing wind bed and plays one quiet open or close cue, keeping the audio graph pooled.
- Crossing a gate plane outside the ring now gives a single `GATE MISSED / RE-ALIGN` cue, so the route tells you how to recover without advancing the checkpoint.
- Gate clears now grade the existing radial pass quality as `PERFECT`, `CLEAN`, or `EDGE`, making route precision visible without changing score math.
- Consecutive `PERFECT` or high-center gate passes now show a lightweight `STREAK Xn` banner, rewarding precision without changing score math or persistence.
- Streak milestones use a short three-note reward cue instead of the ordinary gate chime, with no persistent audio nodes.
- Completed-run results now retain the best precision streak from the sortie, so the cleanest gate chain remains visible after the banner fades.
- Course selectors also retain the all-time precision streak, making repeatable route mastery visible before takeoff.
- A three-gate precision chain unlocks the local `STREAK HUNTER` mastery badge, expanding course progression without network state.
- Completed-run score detail now reports peak speed and height above the home strip, turning each sortie into a compact flight log without adding scene work.
- Repeatable course selectors retain the fastest and highest recorded sortie, so route mastery includes how you fly, not only how quickly you finish.
- New course speed and altitude records are called out on the results card without interrupting the existing badge handoff.
- When `V` flight assist is enabled, the HUD keeps a quiet `TRIM ON` state visible after the toggle banner fades.
- Completed landings now receive a readable `BUTTER`, `SMOOTH`, `FIRM`, or `HARD` touchdown band beside the percentage score.
- `BUTTER` and `HARD` landings now get distinct restrained event cues, while normal landings keep the existing touchdown sound.
- Complete an airborne barrel roll for a bright one-shot cue and a capped score bonus; the results card records the stunt count.
- Curated course history now keeps the best barrel-roll count, so stunt mastery survives retries and appears in course selectors.
- `Free flight` is an optional no-checkpoint course for exploring streamed terrain, settlements, and weather before returning to land.
- Free-flight HUD and results copy identify scenic sorties clearly, while the same safe landing handoff and score detail remain intact.
- Airborne climb milestones at 500M, 1,500M, 3,000M, and 6,000M give free flight short-lived reward cues and retain the highest reached tier in results.
- Press `Y` during flight to copy a replay link. Opening it restores the same procedural world seed and route.
- The results screen also offers `Copy replay link`, so a completed sortie can be shared after landing.
- Chain clean gates and barrel rolls within 8 seconds to build combo rewards and a capped score bonus.
- Completed landings award a small capped fuel-efficiency bonus for preserving reserve through the sortie.
- Centered, runway-aligned touchdowns receive a small capped approach bonus while forgiving off-field landings still score normally.
- Clean touchdowns through rain, snow, and strong gusts earn a capped weather-handling bonus that scales with landing quality.
- Clean night and dusk touchdowns earn a capped Night Ops bonus that scales with darkness and landing quality.
- Hard positive G tunnels vision into a dark vignette with one `BLACKOUT` cue; strong negative G adds a restrained red wash and one `REDOUT` cue, both from the existing pilot load scalar.
- Curated courses remember the best approach bonus, turning clean returns into a replayable landing target.
- A safe centered return can earn the `APPROACH ACE` mastery badge alongside the existing course badges.
- Lock a city or village with `T` and fly into its arrival radius to add a capped destination bonus to the sortie.
- Curated courses remember the most settlements reached in one sortie, creating a replayable exploration target.
- Completed sorties now record the distinct natural biomes surveyed, awarding a capped exploration bonus and a per-course variety record.
- The live HUD keeps the survey count visible and gives one calm discovery cue when a new biome is entered, making exploration progress readable before landing.
- Crossing Mach 1 triggers one restrained sonic-boom cue with hysteresis, so high-speed flight has a clear event without repeated audio chatter.
- The live cockpit HUD now shows a cached Mach readout with subsonic, transonic, and supersonic bands, making the crossing cue readable without adding render work.
- Seeded sorties can now assign an `ENERGY BAND` contract: hold a forgiving 311 to 622 knot cruise window while airborne to build progress toward the full contract reward.
- Seeded sorties can also assign a `STORM RUN` contract: stay airborne in meaningful rain or snow to build a bounded weather-flight reward.
- Seeded sorties can also assign a `WATER RUN` contract: stay airborne over a rendered river, lake, or sea to build a bounded low-level exploration reward.
- Seeded sorties can also assign a `BRAKE CHECK` contract: deploy the speed brake above 428 knots while airborne to practice high-speed energy control.
- Seeded sorties can also assign a `THERMAL CONTROL` contract: hold a controlled engine temperature above 350 knots while airborne instead of living on afterburner.
- Repeatable course selectors and results retain each course's best combo chain.
- The live HUD keeps the current combo visible until a rough gate, miss, or reset breaks it.
- Random sorties reuse one bounded local record bucket, so repeated new worlds do not create one storage key per seed.
- A low-fuel caution protects a small reserve so afterburner cannot strand the aircraft.
- Fuel starvation now announces `ENGINE OUT / GLIDE TO BASE` once, keeping the recovery decision readable without adding a new simulation path.
- During an engine-out sortie, the navigation cue diverts to the home strip until fuel is restored or the sortie resets, while gate scoring rules stay unchanged.
- A landed jet can refill at the home strip while stationary, with a short hold-position cue that makes recovery sorties less punishing.
- Completed-run results show remaining and spent fuel for each sortie.
- A compact radar readout prioritizes the active gate and nearby generated settlements.
- Press `T` to cycle a radar settlement target. The existing navigation cue can guide to the selected city or village, while gates and base return retain priority.
- Reaching a selected city or village now announces the destination and releases the lock, so exploration has a clear finish state without changing mission scoring.
- Consecutive completed sorties now form a bounded per-course run streak that resets after a crash and appears in the selector and results card.
- Every seeded sortie now receives one deterministic bonus contract, such as a speed run, skyline climb, airshow, scouting sweep, fuel-saving landing, terrain-hugger low pass, biome tour, storm run, water run, brake check, thermal control, crosswind, G control, deadstick, front chaser, or precision approach.
- The live HUD now keeps the active contract objective and bounded completion percentage visible, then marks it DONE when the target is reached.
- Completed bonus contracts now accumulate as bounded per-course wins, so mastering a route has a persistent progression target beyond the score.
- A successful landing with an empty tank now earns a capped `DEADSTICK` bonus, making engine-out recovery a meaningful risk-reward choice.
- Course progress now resolves to Rookie, Pilot, Veteran, Ace, or Legend tiers from existing runs, scores, badges, and contract wins.
- A fifth `Canyon run` route adds a low-weave precision circuit through the terrain, using the same fixed gate pool and clearance planner.
- Press `G` to toggle the articulated landing gear at altitude. Ground and low-altitude safety still deploy it automatically.
- Retracted gear now raises a conservative `GEAR` approach caution only during a low descent, so manual gear control stays readable without takeoff alarm spam.
- A bounded `FLARE` cue appears in the final gear-down landing window, replacing low-altitude alarm noise with a clear prompt to ease the sink rate.
- An unstable low approach raises `GO AROUND` before touchdown when sink rate or energy leaves the forgiving landing envelope.
- Seeded sorties can assign `CROSSWIND`, rewarding controlled airborne time through meaningful runway-relative wind already applied by the flight model.
- Seeded sorties can assign `G CONTROL`, rewarding high-speed flight inside a safe smoothed load envelope without changing the flight model.
- Seeded sorties can assign `DEADSTICK`, requiring an airborne fuel-out before the final landing while reusing the existing glide-to-base guidance.
- The curated course picker now includes `River run`, a low meandering inland-water route validated by the same terrain corridor planner.
- Seeded sorties can assign `FRONT CHASER`, rewarding airborne time while the existing weather front blends between states.
- Radar keeps higher-tier and nearer settlement contacts even when streamed landmarks arrive in a noisy order, with a fixed scan budget.
- Radar trims contact density on Low and reduced-motion settings and ignores malformed landmarks, keeping its labels readable and trustworthy.
- Live radar contacts now carry a restrained sweep cue, while Low and reduced-motion settings keep the readout static.
- Entering a generated city or village's radar range announces its biome once per sortie, turning the streamed settlements into destinations without adding scene work.
- Crossing a loaded river, lake, or sea now gives one calm water cue per crossing, using the rendered water level so the message follows the world instead of a second terrain model.
- Airborne water contact now reports `DITCHING / WATER CONTACT` instead of the generic crash banner, while the same pooled crash effects and retry path remain in place.
- The F-35's cool night fill now scales more clearly through dusk and storm cover, keeping the stealth silhouette readable without extra lights, meshes, or draw calls.
- The altitude meter now turns amber or red for low terrain clearance and explains the cue to assistive tech while staying calm on the ground.
- Fast descents with only a few seconds of terrain clearance now raise a bounded `PULL UP` warning before impact, while normal approach sinks stay quiet.
- `PULL UP` has its own restrained double-pulse audio cue, edge-triggered through the existing warning path so it stays distinct without alarm spam.
- The mission row now uses restrained phase colors and polite announcements for takeoff, gate running, return, completion, and failure states.
- A compact gate progress bar tracks cleared checkpoints and exposes the same count semantically, making route progress readable without adding scene work.
- After the final gate, the navigation cue switches to `BASE` and guides the return to the home strip with the same distance and altitude readout.
- Navigation altitude deltas now carry bounded climb, descent, and level color cues with matching accessible wording, making the return approach easier to fly.
- The navigation cue now shows whether the target range is closing, opening, or holding, with a calm deadband to avoid turbulence flicker.
- While closing on a gate or base, the navigation cue also shows a bounded arrival estimate and falls back to `ETA --` when it cannot make a useful estimate.
- The bearing arrow now includes a cached `LEFT`, `RIGHT`, `AHEAD`, or `BEHIND` label so turn direction stays readable during fast turns and low-contrast weather.
- The navigation target now identifies the active checkpoint as `GATE n/total`, then switches back to `BASE` for the return leg.
- The mission HUD now retains the latest gate pace result after the clear banner fades, showing `AHEAD`, `BEHIND`, `ON PACE`, or `FIRST RUN`.
- During the return leg, the navigation cue compares the jet to the home runway and shows `ALIGN`, `TURN L`, or `TURN R` for a cleaner landing approach.
- The return navigation cue also shows `LINE L`, `LINE R`, or `LINE OK` from the runway centerline, making the final approach easier to place.
- Base return also carries `SPD SLOW`, `SPD OK`, or `SPD FAST`, keeping landing energy readable before touchdown.
- Base return also carries `GS HIGH`, `GS OK`, or `GS LOW`, turning the existing altitude and range data into a simple glide-slope cue.
- During the return leg, the wind row also reports runway-relative crosswind as `XW`, highlighting stronger crosswind conditions without changing flight physics.
- The return-leg crosswind cue identifies whether the wind pushes left or right across the runway, not just its magnitude.
- Rain and snow now reduce runway grip during rollout, keeping the arcade envelope forgiving while making wet-weather landings require more braking room.
- Pressing `N` to cycle weather now announces the incoming front immediately, keeping the existing weather control discoverable without adding simulation work.
- The weather block now reports wind speed and direction from the live front, with a calm fallback for malformed telemetry.
- The state row now distinguishes ground, airborne, and crashed aircraft with cached accessible labels.
- Navigation guidance now eases through hard turns, highlights reverse targets, and disables motion in Low or reduced-motion modes.
- A short takeoff hint surfaces the core pitch, yaw, roll, and camera controls, then disappears without persistent state.
- Weather labels now distinguish active and severe fronts with restrained color and accessible wording, without adding flash effects.
- Completed routes now include a clear retry or new-world handoff in the results dialog and its accessible description.
- Results now summarize total score and fuel left in one line, with used-fuel detail and reserve-aware color for faster scanning.
- Retry actions now say “same course,” while reset briefings identify NEW WORLD versus RETRY SAME COURSE before the next takeoff.
- Cameras: stable chase, wide orbit, and first-person cockpit views, toggled with **C**
- Cockpit view now has a restrained camera-attached canopy frame and coaming, while the external view keeps the same clean aircraft silhouette.
- Reduced-motion preferences now suppress crash, touchdown, and afterburner camera motion as well as the existing CSS pulses, and live preference changes apply immediately.
- Reduced-motion preferences also suppress storm lightning flashes and their thunder cue while keeping precipitation and cloud weather active.
- Graphics and audio preference listeners are released with the runtime, preventing stale controls from touching a disposed scene after a remount.
- Menu, results, and preference controls now share one teardown bag, so a remounted runtime cannot stack stale button callbacks.
- Settings and pause dialogs now announce their active heading and return focus to the control that opened them when closed.
- Tab and Shift+Tab are contained inside the active settings or pause panel, then released during runtime teardown.
- Losing browser-window focus now pauses active flight safely, with no automatic resume when focus returns.
- If the browser drops fullscreen during active flight, a short banner explains how to click the canvas and recover it.
- If fullscreen is lost unexpectedly during active flight, the game now pauses immediately so the aircraft cannot continue flying unattended.
- The title screen keeps the takeoff brief visible and announces when the airfield is ready for launch.
- The chase rig is seeded before the title frame, keeping the F-35 hero composition present before Play is pressed.
- The title overlay keeps the runway and F-35 silhouette visible behind the briefing so the first screen still feels like a flight game.
- First-person mode now renders its camera-attached canopy rails, brow, and coaming while removing them cleanly on teardown.
- Cockpit view now projects a restrained velocity-vector marker from the jet's real motion, making slips and climbs readable without adding scene geometry.
- Toggling `C` now announces the active chase, orbit, or cockpit view with a short in-flight cue.
- WebGL context loss now gates render submissions and shows a recovery cue, keeping simulation state safe through browser GPU resets.
- Expired crash particles are compacted out of the live update list, trimming the effect's CPU tail without changing its fixed visual pool.
- Expired landing dust and smoke are compacted in place, keeping repeated touchdown effects allocation-stable without per-frame array shifts.
- Loaded-tile collision sweeps reuse one height and land/water record, avoiding rich surface-object churn while preserving fallback sampling outside the stream.
- Settlement collision uses lazy coarse spatial buckets, so exact building and roof checks stay local instead of scanning every loaded city building each physics step.
- Graphics presets now scale pooled rain and snow simulation and draw ranges, giving Low a real weather-performance budget while High keeps the full field.
- Graphics presets now also scale the directional shadow-map resolution, keeping Low light while giving High sharper aircraft and airfield shadows without changing the scene draw path.
- Low graphics now also stop continuous cockpit, afterburner, speed-juice, and near-gate CSS motion loops while retaining their readable state styling.
- HUD effect envelopes now sanitize malformed speed and power telemetry before it reaches CSS, keeping edge juice and afterburner heat finite even during a bad frame.
- The procedural F-35 now freezes static panel transforms while leaving gear, control surfaces, nozzle petals, plume, and vapor trails live, trimming aircraft matrix work without changing its silhouette or animation.
- Low graphics now trim secondary aircraft exhaust shells, Mach diamonds, and wingtip vapor while retaining the core power cue; Balanced and High keep the full fighter presentation.
- Reduced-motion mode now also freezes the aircraft's exhaust pulse, Mach-diamond shimmer, and navigation-light breathing while retaining static engine and lighting cues.
- The cockpit velocity-vector marker now eases between screen positions for steadier hard-turn guidance, while Low quality and reduced-motion keep it immediate and transition-free.
- Cockpit rails, brow, and coaming now freeze their authored local transforms, reducing camera-attached matrix work while keeping the camera and aircraft pose fully live.
- Low graphics now trim secondary crash fireballs, smoke, and landing dust while preserving the pooled core impact cues; Balanced and High retain the full transient effects.
- Reduced-motion mode now freezes crash and landing particle movement and softens crash bloom while retaining readable fades and impact state.
- Low graphics now use a smaller bounded chase-camera ground-occlusion probe budget, preserving terrain clearance while reducing per-frame terrain queries; Balanced and High keep full coverage.
- Reduced-motion preference changes now reach crash and landing effects at runtime, keeping transient particle drift and flash growth synchronized with the rest of the presentation.
- Low graphics now cap live HUD DOM updates at 30 Hz while Balanced and High remain frame-responsive, reducing UI overhead without changing flight simulation timing.
- Hidden tabs now suspend the procedural engine, wind, and precipitation audio graph and resume it on return, reducing background CPU without changing the in-flight mix.
- Low graphics now skip the analytic sky cloud detail octave while retaining the same full cloud shader on Balanced and High, trimming per-pixel weather cost without removing the sky deck.
- WebGL context loss now pauses active flight immediately instead of simulating unseen motion, preserving the aircraft state for a safe resume after graphics recover.
- Startup failures now provide specific, safe recovery guidance for graphics capability problems versus world-generation failures.
- Pause, focus-loss, fullscreen-loss, visibility, and graphics-recovery paths now silence flight audio immediately instead of waiting for the next animation frame.
- Crash transitions now reuse their position and velocity snapshots instead of cloning vectors, keeping the failure path allocation-stable.
- Aircraft presentation now caches steady-state exhaust opacity, nozzle glow, and non-pulsing plume shape writes while retaining boost pulses and reduced-motion transitions.
- Reduced-motion mode now replaces the aircraft's anti-collision strobe with a steady low-intensity cue, keeping the silhouette readable without flashing.
- Graphics presets also scale the instanced cloud draw ranges and skip hidden cloud updates, so Low reduces atmospheric GPU and CPU cost without removing the weathered sky entirely.
- Graphics presets also scale near-field vegetation instance counts, giving Low a meaningful foliage CPU and GPU budget while keeping the same authored world and allowing live quality changes.
- Empty vegetation batches are hidden when a quality preset reduces them to zero, removing wasted draw submissions while keeping live preset changes reversible.
- Chase-camera ground occlusion uses a distance-aware probe budget, reducing close-rig terrain queries while retaining full coverage for long user-zoomed sightlines.
- The external camera far plane now tracks the streamed terrain and cloud envelope instead of an oversized 60 km range, preserving depth precision without clipping visible scenery.
- The external chase camera now carries a capped, reduced-motion-aware bank cue from the aircraft roll, adding turn drama while keeping the horizon readable.
- Toggling cockpit view now restores the last external framing, including chase or orbit yaw, pitch, and zoom, instead of resetting the pilot's view on every return.
- Camera resize handling now keeps zero-sized or malformed viewport reports out of projection math and skips redundant projection rebuilds during resize bursts.
- External and cockpit camera paths now fail closed on malformed vectors, quaternions, speed envelopes, and motion phases, preventing a bad frame from producing non-finite lens transforms.
- Tone-mapping exposure now follows the continuous daylight factor instead of jumping at phase labels, keeping dawn, dusk, and storm-bloom transitions visually smooth.
- The speed needle reuses whole-knot display precision, skipping redundant trigonometry during steady flight while retaining the same gauge resolution.
- The title hero stages streamed settlements out of view so the runway and F-35 stay readable; the cached city and village layer returns immediately when flight starts.
- The launch card now sits compactly above the hero with a lighter scene veil, keeping the runway and F-35 silhouette visible on the first frame without weakening menu contrast.
- The title hero uses a stable three-quarter aircraft showcase, then resets to the normal rear chase framing as soon as takeoff begins.
- Short-height viewports switch to a compact title layout so the launch card remains fully reachable instead of clipping around the showcase composition.
- Camera and cockpit teardown are idempotent, so duplicate unmounts cannot resurrect or double-release the camera-attached frame.
- The procedural F-35 now carries a cached gear-linked nose landing lamp, adding approach and takeoff readability without dynamic lights or shadow cost.
- Existing nose and main gear doors now articulate with the extension cycle, making takeoff and landing hardware read more like an F-35 without extra meshes.
- Fast airborne external flight now shares the cockpit's velocity-vector cue, helping read drift and turn direction without new scene geometry or draw calls.
- The live gate beacon now dims as the jet closes in, keeping the tall navigation shaft useful at distance without overwhelming the view during a pass.
- Mission gate teardown is now idempotent and ignores late calls, preventing released gate resources from being touched during reload or remount paths.
- Menu and results overlays now become inert after teardown, blocking late DOM mutations while keeping repeated disposal safe during runtime reloads.
- The optional `?debug=1` overlay now releases its DOM marker and ring resources on teardown, preventing debug sessions from leaking across reloads.
- Pooled crash and landing effects now ignore late triggers after teardown and release safely on repeated disposal, preventing stale VFX from surviving runtime reloads.
- The world façade now fails closed after disposal, so late reseed, weather, settlement-visibility, and collision calls cannot reach released subsystems.
- Atmosphere weather, quality, update, and teardown calls now fail closed after disposal, preventing stale runtime paths from touching released sky, cloud, or precipitation resources.
- Flight audio now recovers from a browser-closed context and ignores late resume, update, and cue calls after teardown.
- One-shot flight cues and volume writes also bail out cleanly when a browser closes the audio context mid-frame, preventing dead-context exceptions during tab recovery.
- Procedural audio now clamps malformed telemetry and rejects non-finite automation targets, keeping a bad frame silent instead of poisoning the Web Audio graph.
- The flight HUD reflows on narrow or short browser windows, keeping the heading tape, telemetry, warnings, and gauges readable without changing the desktop layout.
- HUD navigation, attitude, engine, and FPS paths now normalize malformed telemetry before it reaches DOM or CSS state, keeping one bad frame readable instead of showing `NaN`.
- The flight HUD now carries a bounded body-axis G-load readout, with high and negative loads called out through restrained color cues and accessible meter values.
- One-shot high-G and negative-G transition cues now complement the HUD load meter without repeating during sustained turns.
- The optional GLB aircraft loader is code-split from the initial bundle, so the procedural F-35 can boot with a smaller payload while the replacement model still loads and cleans up normally.
- The nose wheel visibly follows A/D runway steering, then recenters smoothly after takeoff and resets with each new flight.
- Heavy rain uses pooled per-streak drift instead of per-frame trigonometry, preserving wind variation while keeping storm CPU cost bounded.
- The vertical-speed readout uses cool climb and amber sink tones with a small deadband, making flare timing readable without adding scene work.
- Altitude, vertical speed, and airspeed expose live semantic meter values, while HUD banners and cautions announce themselves at the right urgency for assistive tech.
- Connected controllers poll at a bounded 30 Hz only during live flight, with stale axes and boost cleared immediately when focus is lost.
- Touch-capable browsers get an optional event-driven flight deck during live flight for pitch, yaw, roll, throttle, and afterburner control.
- Press **V** to toggle gentle pitch and bank trim assist. It only engages on released axes, so direct stick input always wins.
- Storm and blizzard gust values now feed a subtle bounded airborne turbulence torque, while clear air, takeoff roll, and ground handling stay steady.
- The live wind vector now adds a speed-aware crosswind drift on airborne approaches, while ground steering stays predictable and high-speed cruise barely notices it.
- Keyboard and gamepad input now reject malformed frame deltas, axes, triggers, dead zones, and throttle values so one bad device sample cannot poison flight controls.
- Engine resolution and flight integration also fail closed on malformed throttle, boost, and frame-delta values, keeping speed targets, afterburner state, and aircraft position finite.
- Static runway and airfield meshes freeze their local transforms after construction, while the weather-driven windsock stays animatable for lower render-loop CPU cost.
- The runway windsock now aims downwind and extends with the live weather wind, giving takeoff a readable local wind cue without extra draw calls.
- The runway PAPI now changes from red to white with the aircraft's real glide angle, while fly-bys hold a neutral two-white/two-red pattern.
- PAPI brightness follows the day/night atmosphere, staying restrained in daylight and readable during night approaches.
- Crash fireball updates resolve one shared impact-point ground sample per frame instead of querying terrain once per pooled particle, keeping the explosion cheap on steep streamed terrain.
- Fixed-step timing now ignores malformed or backwards animation timestamps, preventing a bad browser frame from poisoning simulation interpolation or the FPS readout.
- Timing resets also reject non-finite timestamps, keeping pause, focus, and resume transitions from poisoning the next fixed-step frame.
- Low graphics quality now skips multisample antialiasing at renderer startup, while Balanced and High retain the sharper edge path.
- High-altitude collision sweeps now use a conservative three-point terrain broad phase before running detailed body probes, trimming steady-flight height queries without changing near-ground contact.
- Directional shadows now refresh on a bounded 20 Hz cadence instead of rebuilding every rendered frame, with immediate refreshes after quality or WebGL context changes.
- Crash VFX now stops as soon as its pooled particles expire and the flash envelope is complete, avoiding an empty post-crash tail and its terrain query.
- Pooled crash and landing effects now return immediately on frozen or negative frame deltas, avoiding unchanged particle walks and paused crash terrain queries.
- Collision classification now avoids redundant rich surface sampling for clearly airborne flight and returns immediately after a crash, trimming the steady-state physics and crash tail.
- Paused, title, and results frames now preserve the camera pose without repeating external ground-occlusion probes when no visual time has elapsed.
- Runway wind updates cache the windsock and fabric nodes after the first lookup, preserving downwind animation without repeated scene-tree traversal.
- Runway wind and PAPI updates now coalesce unchanged poses and invalidate on runway rotation, preserving weather and approach feedback without repeated trigonometry.
- Snow drift uses a shared periodic sway table instead of two trigonometric calls per flake, keeping blizzards animated while reducing CPU cost.
- Optional aircraft model loading is now cancellation-safe, so slow or stale GLB responses cannot reattach geometry after runtime teardown or a newer request.
- External camera impact shake and afterburner sway now keep the final lens above the terrain floor during low-altitude flight.
- The F-35's existing night readability layer now uses a stronger cool panel fill at dusk and night while fading fully out in daylight.
- External chase framing now reuses one heading solve per frame, preserving the same camera feel with less repeated orientation math.
- The airspeed gauge now marks its amber redline and true overspeed range, with accessible telemetry text that calls out when the jet leaves the displayed envelope.
- Leaving the dry airspeed envelope now raises an `OVERSPEED` caution, keeping the visual redline aligned with the accessible warning and one-shot cue.
- Aircraft presentation effects now follow the shared frame timestamp, keeping beacon, nav-light, and exhaust motion deterministic while avoiding a wall-clock read every physics step.
- Chase-camera auto-return now advances from rendered delta time, so the rig remains deterministic and paused frames do not consult a wall clock.
- Mission gate pulses and pass flashes now follow the shared frame timestamp, keeping route feedback deterministic without per-frame wall-clock reads.
- Cockpit audio now tucks wind, rain, snow, and high-frequency whine behind the canopy while retaining engine presence; chase view keeps the open-air mix.
- Overspeed now has its own restrained descending cue, so speed-envelope pressure is distinguishable from stall and terrain warnings.
- Navigation arrows reuse the mission bearing in cockpit view and avoid a redundant camera matrix rebuild in external view, keeping guidance responsive with less HUD CPU work.
- The runway windsock mutates one cached weather state during smooth wind fronts, avoiding steady-flight object churn while preserving its downwind pose.
- Reseeding now forces weather effects onto the new terrain and settlement stream even when the next world chooses the same weather profile, preventing stale neutral materials.
- HUD gear-transition cues use the main animation timestamp, keeping timing stable through frame hitches without an extra per-frame clock read.
- The F-35 exhaust petals flex subtly with military power and afterburner, adding mechanical life without extra geometry or draw calls.
- Height-only ground queries now use visible mesh interpolation directly, so camera clearance, AGL, collision clearance, and landing effects skip redundant biome sampling in flight.
- Automatic gear now checks the cached grounded state before requesting AGL, avoiding a duplicate terrain sample on every grounded physics step.
- Flight banners now distinguish neutral info, successful landings/gates, and actual crash or recovery danger states instead of using one alarm color for every event.
- The HUD now includes a lightweight fighter-style heading tape with cardinal marks and a centered caret, making yaw readable at a glance without adding scene work.
- Dark airframe panels gain a restrained cool night fill that fades to zero in daylight, keeping the F-35 silhouette readable without extra lights or geometry.
- Swept high-speed collision checks now reuse their contact record, trimming physics garbage without changing landing or crash outcomes.
- The completion card is a proper keyboard-contained dialog and returns focus to the flight canvas when a run is restarted.
- Completion results now show the gate, time, and landing contributions behind the total score.
- Mission timing and scoring now fail safe on malformed telemetry, keeping one bad frame from producing `NaN` labels or invalid results.
- Mission gate placement, crossing, and navigation HUD now fail safe on malformed spawn and flight telemetry, keeping one bad frame from poisoning the route or surfacing non-finite guidance.
- Play, Retry, New World, and `R` now open with a short `SPOOL ENGINE / W TO ROTATE` briefing so takeoff has an immediate readable handoff.
- Crash camera impulse uses smooth bounded multi-frequency shake instead of harsh per-frame white-noise jitter.
- External speed framing respects the chase camera's configured maximum distance, keeping the jet readable even when zoomed out at top speed.
- Graphics quality is selectable from the pause menu. Low disables shadow-map work and caps adaptive pixel density, while Balanced and High retain progressively larger budgets. The choice is saved locally.
- Low quality also removes CSS backdrop-blur passes from glass UI surfaces, reducing compositor cost while keeping the same readable panel colors.
- Adaptive pixel density now refreshes its device cap when the viewport or fullscreen DPR changes, clamping immediately on a denser display without jumping quality upward during recovery.
- Audio volume is adjustable from the pause menu and saved locally. The slider changes the master mix smoothly, while **M** remains an immediate mute toggle.
- Middle-mouse look / pan, scroll zoom (not in cockpit)
- HUD: IAS to 3000 kts (50% ENG ~ 1500, 100% ~ 3000), ENG, ALT AGL, ADI, gear, weather/time. Acceleration and deceleration respond 5× faster.
- Rebuilt F-35-style airframe with canted tails, intake throats, gold canopy, articulated landing gear, and a soft single-engine afterburner
- High-speed and high-load turns now reveal two pooled wingtip vapor trails, adding a readable condensation cue without per-frame allocations or cockpit clutter.
- Red and green navigation lights use a restrained shared pulse, keeping the F-35 readable at dusk and night without point lights or extra shadow passes.
- Navigation-light brightness now follows the shared daylight envelope, staying subtle in full day and readable through dusk and night without extra lights or draw calls.
- The afterburner now gives its cached Mach diamonds a restrained throttle-scaled pulse, adding depth to the exhaust without extra draw calls.
- The gold canopy now uses a restrained clearcoat physical material, giving the F-35 cockpit a sharper glass highlight without adding geometry or a draw call.
- Canopy emissive response now follows shared daylight, staying restrained in sun and readable at night without adding geometry or draw calls.
- High-speed cockpit view gains a slight canopy fog/vignette linked to IAS, with reduced-motion support and no new scene draws.
- Cockpit weather now adds a subtle bounded rain and snow streak veil from the live atmosphere state, while external view stays clear.
- Cockpit streaks now drift slowly across the canopy like real rain on glass, with reduced-motion preferences keeping the layer static.
- Afterburner now adds a restrained edge heat veil that scales with speed, stays boost-only, and respects reduced-motion settings.
- Clean touchdowns and fast rollouts kick up pooled ground scrub dust and tire smoke without per-landing allocation churn.
- Approaching the live checkpoint softens a proximity pulse on the ring and HUD cue, separate from the brighter gate-pass flash.
- Airborne yaw and runway steering now honor the HUD control convention: A turns right and D turns left, with regression coverage for both nose directions.
- Aircraft model replacement disposes removed geometry and materials so visual asset reloads do not leak GPU resources.
- Deployed landing wheels now spin with rollout speed and reset cleanly between runs, using the existing gear meshes with no added draw calls.
- Aircraft animation caches gear, control-surface, afterburner, and nozzle nodes so each physics step avoids repeated scene-tree searches.
- Repeated ground-state reads now reuse a pose-keyed contact result, reducing terrain sampling across auto-gear, collision, warnings, and HUD without allowing stale state after movement or attitude changes.
- Flight surfaces are now visibly hinged: differential flaperons, stabilators, and canted tail panels move with pitch, roll, and yaw input while reusing the existing meshes.
- HUD readouts coalesce unchanged text and visibility updates, reducing avoidable DOM/layout churn during flight without lowering gauge responsiveness.
- High-frequency HUD transforms, SVG needle attributes, engine bars, and warning classes also coalesce unchanged style writes, reducing layout churn while preserving smooth visual precision.
- Engine rumble + wind hiss (Web Audio); short event cues for afterburner engage, gates, touchdown, and crash
- Engine audio now layers one restrained turbine whine above the low rumble, with throttle and afterburner-driven pitch and coalesced automation.
- Engine, weather, and event audio now share a conservative output limiter, preventing stacked cues from clipping at full power.
- Press **M** during flight to mute or restore audio without pausing; the HUD shows the live audio state.
- Caution and warning banners stop pulsing when the browser requests reduced motion, preserving readable alerts without visual flashing.
- Audio mutes while the tab is hidden and resumes when active flight returns, preventing suspended browser contexts from leaving the game unexpectedly silent.
- Touchdown dust and smoke are seeded from the landing state, making repeated landings visually repeatable while keeping the pooled effect budget.
- Audio mute takes effect immediately, including for event cues raised in the same simulation frame as the toggle.
- Hidden tabs skip camera, renderer, and debug submissions while keeping simulation timing and world streaming ready for the next visible frame.
- Static title, pause, and results frames skip world streaming work until flight resumes, reducing idle CPU without changing the live anchor or weather path.
- Flight keyboard-capture state is now coalesced, so steady frames do not rewrite the same input mode.
- The HUD freezes its last live telemetry under pause and results overlays, avoiding gauge and warning recomputation until flight resumes.
- The audio graph now returns immediately from repeated muted pause/hidden updates, while unmute transitions still schedule normally.
- The active-gate beacon now updates only when the route changes, avoiding a redundant per-frame position copy while preserving the same visible guidance.
- Flight audio coalesces unchanged Web Audio automation targets so steady cruise does not enqueue redundant gain and filter ramps.
- Weather uniforms and settlement lighting updates are coalesced at the world boundary, preserving visible transitions while reducing stable-flight writes.
- Frozen title and pause frames skip redundant atmosphere light, sky, cloud, and weather work while still refreshing when the camera anchor or weather state changes.
- Resize bursts are coalesced to one renderer and camera update per animation frame, and steady tone-mapping exposure avoids redundant renderer state writes.
- Runtime teardown closes Web Audio, renderer, camera, and input resources on page unload so reloads do not leave stale browser work behind.
- Runtime teardown also releases streamed terrain, settlement workers, weather pools, mission gates, crash effects, runway assets, and aircraft resources before renderer disposal.
- Aircraft reset, presentation, simulation, landing, readability, and ground-state calls now fail closed after disposal, preventing late remount callbacks from mutating released model state.
- Settlement streaming teardown is idempotent and ignores late updates, so reloads and remounts cannot double-release shared geometry or rebuild a disposed world.
- Runtime teardown now unregisters global key, fullscreen, resize, and visibility handlers so a remounted scene cannot drive disposed state.
- Browser-suppression handlers now have an idempotent teardown that restores the canvas focus and context-menu state on runtime disposal.
- Renderer startup uses Three.js's supported PCF shadow-map constant directly, avoiding the deprecated shadow-map fallback warning.
- The fixed-step clock reuses its render timing record between ticks, removing another steady-frame allocation without changing interpolation or catch-up behavior.
- HUD clock and weather labels now cache by displayed state, avoiding unchanged string reconstruction while keeping telemetry responsive.
- Rounded flight, attitude, navigation, and camera readouts also reuse their formatted strings, reducing live overlay churn without lowering display precision.
- The flight overlay now shows cached signed vertical speed, making climb, sink, and landing flare timing readable beside altitude without adding a per-frame allocation.
- The flight overlay now includes a cached wrapped heading readout, making absolute orientation and A/D yaw response readable without adding scene work.
- New STALL and LOW ALT cautions announce their first transition with a quiet two-tone cue while the HUD carries the persistent warning state.
- Flight warning evaluation reuses stable STALL, LOW ALT, and clear-state records to avoid per-frame telemetry garbage.
- Mission HUD telemetry reuses one navigation snapshot and cached gate label between frames, avoiding recurring object and string allocations while flying the circuit.
- Main-loop audio and HUD frame records, plus aircraft attitude telemetry, are reused between frames so steady flight does not create short-lived control objects.
- Weather propagation reuses its comparison record and only snapshots on meaningful transitions, avoiding a per-frame state object while preserving responsive rain, snow, wind, cloud, and daylight updates.
- Runtime weather blending now fills one atmosphere-owned snapshot in place; public weather snapshots remain independent while the render loop avoids duplicate profile and wind allocations.
- Atmosphere anchor tracking reuses one coordinate record between updates, eliminating another steady-flight allocation while keeping frozen-frame skip checks exact.
- The analytic sky cloud deck now fills an atmosphere-owned record in place, removing another per-update allocation without changing cloud coverage or wind shading.
- Settlement streaming now guards empty void sorts and compacts ready roads in place, reducing worker handoff churn during steady flight without changing landmark priority.
- External camera speed framing and crash-shake envelopes now reuse camera-owned records, removing per-frame temporary objects while preserving the existing framing and shake curves.
- Aircraft control-surface animation now writes through cached hinge nodes directly, avoiding a per-step helper closure and name dispatch while retaining smooth F-35 flap, stabilator, and tail motion.
- HUD text readouts now use the same cached-write strategy as styles and attributes, avoiding repeated DOM reads while preserving exact telemetry values.
- The engine percentage readout now caches its rounded string too, removing another steady-flight template allocation without changing gauge responsiveness.
- HUD gauge needles, arcs, and attitude transforms now reuse their quantized strings before the DOM write cache, trimming more steady-flight formatting churn.
- Phase 7 adds restrained high-speed edge streaks that scale with IAS and warm up under afterburner, with reduced-motion support and no new scene draw calls.
- Phase 7 external chase framing adds a tiny smooth afterburner sway, leaving cockpit mode untouched and keeping motion below the impact-shake envelope.
- Phase 7 engine audio now spools the procedural loop with throttle and afterburner through coalesced playback-rate automation, so power changes affect tone as well as loudness.
- Phase 7 adds restrained directional gear transition clicks, making the automatic landing-gear cycle readable without adding an audio asset or a persistent alert.
- Phase 7 adds a pooled checkpoint pass flash that expands and fades at the cleared gate, making high-speed gate crossings readable without spawning new geometry.
- Phase 7 gives automatic gear transitions a short HUD pulse with reduced-motion support, matching the directional audio cue without adding a persistent alert.
- Phase 7 adds a restrained procedural precipitation bed: rain and snow now alter one pooled, coalesced audio layer without sample assets or extra scene work.
- Phase 7 adds a small airborne-touchdown camera pulse, keeping clean landings physical while staying far below the crash-shake envelope.
- Phase 7 adds a rare procedural dorsal anti-collision strobe to the F-35 silhouette, hidden between flashes so it adds detail without a steady draw cost.
- Phase 7 results now expose the gate-score contribution alongside total, time, and landing quality so circuit performance is readable after touchdown.
- Results now tint the panel by medal tier and briefly call out a new best, with reduced-motion-safe presentation.
- Phase 7 adds edge-triggered procedural thunder for the existing rate-limited lightning flashes, keeping storms audible without repeated alarms.
- Phase 7 crash effects now reuse a fixed particle pool across retries, removing repeated mesh and material allocation without changing the explosion envelope.
- Crash bursts are seeded from their impact state, so retries are visually repeatable while retaining the same pooled effect budget.
- If Chrome exits fullscreen on Escape during flight, the next canvas click now safely re-enters it without affecting menu or title interactions.
- Phase 7 mission gates now reuse one fixed five-ring pool across retries, keeping circuit resets allocation-stable without changing the route.
- Phase 7 event audio now reuses fixed procedural white and brown noise buffers, keeping repeated cues from rebuilding PCM data.
- Phase 7 collision checks now reuse attitude and contact records at the fixed physics rate, removing another steady-flight allocation without changing landing rules.
- Infinite geographic provinces: broad alpine massifs, smooth green hills, dunes, weathered mesas with stepped shelves, basalt uplands, salt flats, tundra, savanna, forests and rainforest regions.
- Landforms have distinct regional families: long rounded ridge chains with carved alpine valleys, dry plateaus and terraces, dune fields, and rare smooth volcanic cones with calderas. Green lowlands remain rolling instead of needle-like.
- Dry foothills sometimes spread into broad alluvial-fan ramps with gentle lobes and mineral bands before transitioning into dunes or mesas.
- Water is an independent surface with variable basin counts, irregular coves, narrower inland seas, bent rivers with deterministic tributaries, teal shallows, deep blue channels, shoreline foam tint, and animated glints.
- Basin shorelines now combine directional headlands, broad shoulders, and a second cove scale so lakes and seas avoid radial silhouettes while staying analytic and cheap.
- Water shares precipitation uniforms with terrain: rain roughens ripple and foam motion while snow cools the surface without rebuilding clipped water meshes.
- Rain also gives flat lowlands a restrained cool wet-sheen while leaving hills and mountains readable, using the existing terrain height and normal path.
- Cities use landmark-only tower cores surrounded by slabs, industrial halls, blocks, stepped forms, and broader biome-specific color palettes.
- Terrain vertex colors now carry the landform signal too, giving ridges, alpine valleys, plateaus, and calderas distinct readable shading even on distant low-detail tiles.
- Snow and mountain palettes add stable exposed-rock bands and cool alpine-valley shading so high relief stays readable instead of becoming one white sheet.
- Mostly dry land with uncommon, compact inland seas, irregular lakes, and meandering rivers that vary in width and descend from lake outlets to sea level. Seas stay regional landmarks rather than swallowing whole flight routes. Water is separate geometry over a sediment bed, with calm reflections and fine ripples.
- Streaming terrain (33.6 km radius), adaptive detail tiles and smoothly blended biomes. Trees and rocks use bounded instanced streaming in the near field.
- Terrain and water geometry generate in a bounded background worker pool with transferable buffers. Near chunks load first, uploads have a frame budget, and new coverage fades in over 650 ms while previous detail stays underneath. Coarse outer tiles keep the doubled horizon affordable; rendering resolution adapts gradually under sustained load.
- World-cloud transforms use a fixed 30 Hz budget; lighting, rain, snow, and lightning remain frame-responsive so weather stays smooth without spending a full matrix rewrite every render frame.
- Weather fronts turn wind along the shortest arc while interpolating speed separately, avoiding an artificial calm pocket when a storm changes direction.
- Salt flats carry broad deterministic crust and damp-playa bands instead of a single pale sheet, using the existing terrain vertex-color path.
- Tundra carries broad frost and wind-scoured scree bands so cold lowlands do not collapse into one gray-green material.
- Low coasts blend through a restrained beach and silt band driven by the warped shoreline signal, keeping cliffs and high shelves on their normal biome material.
- City districts inherit biome architecture bias: dry skylines spread into broader hangars, wet cities stay tighter, and cold or highland cores favor stepped silhouettes.
- Villages inherit the same climate logic at a smaller scale: dry hamlets favor broad halls, wet settlements cluster compactly, and cold villages pick up stepped civic forms.
- Local road hierarchy follows the province too: dry settlements use broader spines, wet settlements tighter streets, and cold settlements heavier approaches while regional links keep their fixed budget.
- Desert and mesa vertex colors now reuse the generated dune and badland signals for broad wind bands and layered strata, with no added geometry or texture cost.
- Snow particles now drift with the same blended wind direction as clouds and rain, keeping blizzards coherent without increasing the pooled particle count.
- Water keeps one batched material but now differentiates river, pond, lake, and sea palettes by depth and body kind, making larger seas read deeper and inland water more varied.
- Regional road selection now favors cross-tier hub spokes on both sides: cities reach nearby villages before adding another city link, while the fixed link caps stay unchanged.
- Regional wet-span connectors now add capped instanced bridge piers beneath their existing deck meshes, grounding long village and city routes without per-span geometry.
- Regional route selection now prefers broad alpine valleys and avoids ridge spines when comparable terrain-following bends exist, keeping settlement highways grounded without extra road geometry.
- Vegetation now gives savanna, tundra, volcanic, and saltflat provinces distinct sparse prop mixes instead of falling through to generic grass, while reusing the existing instanced mesh budget.
- Instanced vegetation now shares the world weather response: rain darkens foliage and snow settles on upward-facing canopies, trunks, and rocks stay readable without extra draw calls.
- Foliage now sways independently with the same blended weather wind as clouds, snow, terrain cover, and water. Rock materials stay static and the animation remains inside the existing instanced vegetation batches.
- Terrain snow accumulation now shares wind direction too, lightly scouring windward slopes while retaining more cover on leeward faces without rebuilding streamed tiles.
- Water ripple and color drift now share the same weather wind direction, keeping lakes and seas visually coherent with moving rain and cloud fronts without extra water draws.
- Water now uses its existing moving normal field to vary roughness, adding restrained highlights to rivers, lakes, and seas without another material or draw.
- Weather fronts now move through plausible neighboring states with smooth fog, light, cloud-deck and wind transitions. Clear, fog, rain, thunderstorms, snow and blizzards each have distinct visibility and precipitation. Layered clouds render in three instanced batches. Press **N** to cycle weather manually.
- Terrain now receives a restrained moving cloud-shadow field from the same blended cloud cover and wind, keeping streamed tiles visually tied to the cloud decks without shadow-map cost.
- Terrain materials respond to the same blended precipitation values: rain darkens the ground and snow adds stronger altitude/slope-aware cool cover without rebuilding streamed chunks. Snowfall uses varied soft flakes in one pooled pass so it remains readable at flight scale.
- Settlement streets and bridge decks use the same blended precipitation values, so roads wet and cool with the terrain.
- Rain now breaks settlement streets, bridges, and highways into deterministic puddle patches through the shared road shader, keeping wet surfaces readable without extra meshes or materials.
- Those puddle patches also lower local roughness, giving wet roads and bridge decks a restrained highlight response without another material or draw.
- Settlement facades and roof materials share those precipitation uniforms, darkening in rain and collecting cool snow on horizontal surfaces.
- Building window grids also share the day/night factor, staying subdued by day and warming into low-cost city lights after sunset.
- Cities now add a capped instanced street-light rhythm along outer roads, framing civic districts at night while keeping villages and the terrain budget unchanged.
- Cities and villages that genuinely border a lake or sea now gain rare deterministic waterfront docks, reusing two capped instanced batches instead of per-building geometry.
- Biomes: plains, forest, rainforest, desert, mesa, swamp, hills, mountain/snow, water/ocean

## Tech stack

| Layer | Choice |
|-------|--------|
| Rendering | Three.js (WebGL) |
| Language | TypeScript |
| Build | Vite |
| Models | Procedural mesh + optional GLTF/GLB |
| Physics | Custom arcade flight model |

## Getting started

### Prerequisites

- Node.js 20+
- npm (or pnpm / yarn)
- A modern browser

### Install and run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview the production build |
| `npm test` | Run unit regressions |

## Controls

| Input | Action |
|-------|--------|
| **W / S** | Pitch up / down |
| **A / D** | Yaw right / left |
| **Q / E** | Roll (Q right, E left) |
| **Shift** | Engine power up (speed target) |
| **Ctrl** or **1** | Engine power down |
| **2** | Engine power up |
| **Space** | Afterburner |
| **B (hold)** | Speed brake / wheel brakes |
| **G** | Toggle landing gear |
| **V** | Toggle pitch and bank trim assist |

| **Hold MMB + drag** | Look / pan (not cockpit) |
| **Scroll** | Zoom (not cockpit) |
| **C** | Cycle chase / orbit / cockpit camera |
| **N** | Weather |
| **T** | Cycle radar settlement target |
| **M** | Mute / unmute audio |
| **Y** | Copy replay link with current world seed |
| **Gamepad** | Left stick pitch/roll, LT/RT throttle, A / Cross afterburner |
| **Touch** | Live-flight pitch, yaw, roll, throttle, and afterburner deck on touch-capable browsers |
| **R** | New world + runway |
| **Esc** | Pause menu |

**Takeoff:** Hold Shift to spool, build speed, then **W** to rotate. Press **G** for manual gear control; low altitude still deploys it automatically. Engine percent is the speed you want (50% ~ 1500 kts).

Landing is gentle with gear down. After the circuit, land to score. Hard impacts explode; press **R** for a new world. Retry the same course from pause or the results screen. Fullscreen is a click toggle in the pause menu.

## Optional aircraft model

The built-in aircraft is an original procedural mesh. For visual development, run
the dev server and open /dev/aircraft.html to inspect the model, gear animation,
and exhaust under neutral lighting. /dev/terrain.html provides a daylight world
review with orbit controls and reseeding. These pages are development tools and
are not included in the production build.

The terrain review uses fixed seeds and deterministic feature searches for
smooth green hills, alpine massifs, irregular lakes, river valleys, inland seas
and badlands, plus a
flight benchmark at either 400 m/s or the current maximum afterburner speed,
with draw counts and frame timings. Streaming prioritizes contact detail, then the nearest missing coverage, before distant
detail rebuilds. `/dev/streaming.html` isolates terrain loading and maximum-speed
streaming with fixed seeds, load times, frame percentiles, worker queues, and JSON export.
Near-field vegetation roots and meshes are cached per streamed tile, so the
per-frame fade path does not repeatedly search or traverse the scene tree.
Geography is deterministic for a seed and coordinate; this generator changes old landscapes.
Green provinces now use stronger rolling hills, so flat sheets are rarer
without bringing back sharp lowland spikes.
Selected humid lowlands now also carry a bounded karst signal: broad limestone
bowls and low ridges add another terrain family while staying smooth enough for
flight and blending into neighboring biome colors.
Foothill shoulders also receive a restrained olive/stone material band, making
the mountain-to-lowland transition readable without new geometry or noise calls.
Alpine ranges use narrower ridge spines, deeper winding valleys, and multi-scale
summit folds plus a bounded peak-and-saddle sculpt so high terrain breaks into
distinct flyable peaks instead of broad tables. Snow and mountain faces use
stronger deterministic rock bands, altitude exposure, and cool valley contrast
so the existing relief remains readable at flight distance without extra terrain
geometry or noise calls.
Cold highlands also get occasional broad glacial cirques, reusing existing
alpine signals to carve smooth bowls and cool blue ice-rock material bands
without sharp peaks or additional noise work.
Seas sit at zero elevation; each lake has its own level below the surrounding
rim. River reaches descend between those levels. Shallow water carries moving,
low-contrast foam breakup instead of a uniform shoreline, while river ribbons carry
direction-aware moving riffles, variable widths, tapered tributary ends, and
broken bank foam. Rivers receive a stronger depth/color response so they do not
read as pale uniform strips at flight scale. This is procedural drainage, not a
rainfall or fluid simulation.
Steeper reaches now carry a bounded grade signal into the same shader, adding
rapids foam and extra ripple energy without a second river mesh or draw family.
Non-mouth tributaries use long, three-stage, slightly submerged endpoint tapers
so streamed river pieces feather into their channel instead of ending as
flat-cut ribbons; confluences get a small shared rounded shoulder to hide
arrival seams.
Large fog-ring tiles decimate cached lake and sea shoreline fans, keeping distant
water bounded while nearby shorelines retain their full irregular outline.
Dry river shoulders receive a subtle biome-aware wet-meadow and silt tint so
channels read as ecological corridors instead of isolated blue strips.

Rare procedural cities and more frequent villages occupy suitable dry terrain.
Villages range from compact hamlets to several-kilometre ribbon, crossroads and
basin settlements; the rarest cities span roughly 17-20 km and contain 650-1,300
buildings with mixed towers, stepped cores, slabs, hangars and pitched rooflines. Organic branches,
dead ends and broken district connectors replace repeated grids. Building
footprints, heights, stepped/octagonal silhouettes, rooflines and biome palettes
vary by world seed, using deliberately exaggerated scale for readability from the jet.
Cities now seed a deterministic mixed-use downtown ring around the civic plaza
before filling their broad outer districts, so the skyline reads clearly from
the flight-scale review as well as from the city edge. Protected villages get
a modest density bonus so they read as destinations instead of tiny hamlets,
while organic villages keep their rarer size bands. Village roads also seed a
few deterministic frontage lots before the wider scatter pass, so long
approaches read as lived-in instead of empty ribbons. Dry villages tend toward
stretched ribbons, wet villages gather into basin profiles, and cold/highland
villages favor compact crossroads while seed variation remains intact. Larger
villages can also
receive a small instanced civic spire or dome, giving
their varied footprints a recognizable center without adding per-building
draws, and every village stays within a hard 70-building budget. Every settlement reserves a deterministic central plaza or village
green so road approaches have breathing room instead of filling the whole
footprint with blocks.
Facade windows use a wider, lower-contrast rhythm so villages and cities keep
readable building silhouettes instead of collapsing into dense dark grids.
Shared wall materials also add deterministic low-contrast panel seams and floor
bands, keeping large blocks from collapsing into featureless boxes at flight
scale without adding geometry or draw calls.
Each new airfield also reserves independent city and village anchor searches;
the runway heading biases those landmarks into the first takeoff corridor, and
deterministic fallback cells keep both tiers alive when a rough seed rejects
the first shelf or a streaming reset retries the cell, while ordinary
settlement rolls remain naturally sparse. Organic sites are centre-biased
inside their stream cells so valid villages and cities are more likely to be
seen before the aircraft crosses the fog boundary. The protected village uses
a larger crossroads, basin, or ribbon profile instead of silently collapsing
to the smallest hamlet. Cities rise from lower outer
districts into taller cores instead of forming one uniform wall. The two
protected landmarks also use
small shared beacon meshes above their tallest roofs, making the guaranteed
destinations readable through flight fog and low-light weather without adding
per-building geometry.
Settlement placement runs in a background worker; buildings and roofs are
instanced, with ground detail culled at distance. Trees and rocks use the same
bounded instanced streaming path, with detailed props limited to the near field.
The terrain review includes city/village destinations and a Flight scale view
using the game's actual chase camera and aircraft.
Selected nearby settlements are joined by sparse regional roads rather than a
uniform world grid. Villages prioritize a reachable city hub for their single
regional link, creating readable hub-and-spoke networks without a dense road web.
Routes choose a curved terrain path, follow a bounded grade,
and lift into bridge or viaduct approaches across water and deep folds. Wet
spans switch to a concrete-toned bridge deck, while a cool slate highway deck,
brighter shared centerlines and edge strips keep links readable at flight distance.
Local district roads also receive a single batched centerline pass for readable
street networks at flight distance.

Place a GLB at `public/models/f35.glb`. The app hydrates it in the background and falls back to the built-in procedural mesh if the file is missing or slow. See `public/models/ATTRIBUTION.md` for licensing notes.

## Project layout

```
Blackout/
├── public/
│   ├── favicon.svg
│   └── models/              # optional f35.glb
├── src/
│   ├── main.ts
│   ├── core/                # input, time, fullscreen lock
│   ├── aircraft/            # state, mesh, flight model
│   ├── camera/              # chase / orbit / cockpit
│   ├── world/               # terrain, sky, airfield
│   ├── ui/                  # HUD, menus
│   ├── systems/             # collision, mission, crash FX
│   └── audio/               # engine/wind loops + event cues
├── CHANGELOG.md
├── index.html
├── package.json
└── README.md
```

## Roadmap

Shipped: flight, circuit, crash boom, airfield, menus, streaming world, day/night, and terrain-safe seeded route planning.

The current ship has a varied, repeatable circuit with local records, mastery badges, fuel and afterburner tradeoffs, radar destinations, bonus contracts, and biome survey records. The next phase continues adding bounded arcade decisions before any combat layer.

## License

License TBD.

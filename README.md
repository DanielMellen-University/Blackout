# Blackout

Browser arcade flight game. Pilot an F-35, take off, fly a short gate run low enough to see the ground, and land or crash.

Built with TypeScript, Three.js, and Vite.

Current release: **v0.12.0** (`Systems expansion`). Roadmap chunk: **10.409**.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. `npm test` runs the suite. `npm run build` typechecks and builds. World replacement is transactional: a failed rebuild rolls back to a usable streamed world instead of leaving the runway over an empty scene. If the initial world search still exhausts its bounded attempts, the title screen exposes a Retry action instead of leaving Play dead.

## Aircraft and weather

The procedural F-35 has a shaped gold canopy, recessed intakes, separate rudders, animated landing gear and exhaust, and batched surface detail. Engine thrust, fuel burn, audio, plume, and HUD all share the same finite-safe afterburner gate. Fuel-out now reports an explicit burner lock instead of leaving the HUD on a misleading ready state. The first-person view remains unobstructed.

Weather transitions blend layered cloud cover, wind, precipitation, lighting, and visibility. Clouds fade at full size, shade toward the sun, and reduce visibility when you fly through them. The HUD calls out cloud edges, entry, and breaks, the cockpit veil adds a subtle cloud mist, and the existing audio bed responds to gusts while gently muffling wind and precipitation inside formations without adding nodes. Rain streaks drift through world space; precipitation and overhead cover clear above the cloud tops. Meaningful rain, snow, or strong gusts add a restrained camera and airframe buffet that stays quiet under reduced-motion preferences. Stormy nights receive a small bounded exposure lift so terrain silhouettes stay readable without brightening clear nights or daytime. Nearby traffic now gets a short audio double-pulse alongside its directional alert. Graphics presets retain bounded cloud and precipitation pools.

Protected villages now sit inside a nearer discovery band, while the guaranteed city remains a farther regional landmark. Protected settlement recovery is event-driven and cooldown-limited, so missing anchors can reappear without rebuilding plans or filtering queues every render frame. Settled terrain tiles reuse shared opaque ground and water materials, while only fading or retiring transitions carry private material state. Terrain tile generation, settlement planning, and settlement shoreline/bridge probes now reuse bounded caller-owned climate records, cutting nested per-sample garbage during streamed rebuilds and landmark attachment while preserving deterministic geography. Height-only fallback contact queries now use caller-owned scalar hydrology surface records, avoiding climate-object allocation while retaining exact land-versus-water classification, water levels, and airfield grading. Optional external aircraft models are normalized to the same origin contract and disposed if asynchronous hydration is superseded or fails during replacement, keeping the procedural fallback leak-free. Shared vegetation and settlement geometry remain owned by their systems during chunk teardown, so streaming cannot dispose foliage shaders or landmark meshes still used by neighboring tiles. Snow, traffic, and sonic-boom teardown are idempotent and detach their pooled scene roots before disposal, so world resets cannot leave stale weather particles, silhouettes, shockwaves, or late updates behind. Course and career modules are emitted as a cacheable application chunk so the main entry stays smaller without adding runtime work. Fast aircraft motion also sweeps loaded obstacle paths, preventing a high-speed pass from tunneling through a hangar or settlement edge. Leaving live flight clears keyboard, gamepad, and touch state before a pause, results screen, or new sortie can inherit it. Touch-capable browsers get a pointer-captured flight deck, so multi-touch steering, throttle, and boost release cleanly even when a finger leaves the button or the tab loses focus. Radar target cycles now have restrained lock and lock-loss chirps alongside the existing HUD banners. Water keeps rich close-range flow and foam detail but fades high-frequency shimmer before the fog edge, and its independent surface is depth-biased to avoid shoreline speckle. Terrain workers now follow the Low/Balanced/High quality budget and resize without interrupting in-flight jobs. Use `/dev/aircraft.html` for orbit views and `/dev/terrain.html` for weather presets, flight-scale inspection, and frame-time measurements.

Settlement collision probes use cached numeric spatial columns and precomputed building transforms, keeping high-speed sweeps cheap even when a city is loaded. Airfield obstacle probes reuse a caller-owned pad snapshot, avoiding a small allocation on every collision check, and swept aircraft paths expand only the flight query for the jet's wings, nose, and tail while leaving camera occlusion on the authored building edges.

The closest traffic contact now remains visible in a bounded HUD row after its alert banner fades, with side, vertical separation, and distance kept readable in minimal-motion-friendly text.

## Fly

Press Play when the airfield is ready.

- W / S pitch
- A / D yaw
- Q / E roll
- Shift raises the throttle, Ctrl lowers it
- Space is afterburner
- B is the speed brake, and the wheel brake on the ground
- C cycles chase, orbit, and cockpit
- MMB looks around; camera sensitivity, speed framing, auto-return, Minimal HUD, and separate audio mixes are adjustable in the pause menu
- Boost, speed-brake, and landing-gear keys are remappable in the pause menu and persisted locally
- Esc pauses

The nose is the flight path. Throttle is thrust: a climb spends speed, and closing the throttle slows you down. Afterburner is the burst that gets it back. Thermal lift now stays visible as a persistent LIFT cue when the aircraft is inside a rising pocket, so altitude routes are readable after the entry banner fades. Sustained positive or negative G now drives a bounded blackout/redout veil with hysteresis, so hard pulls read clearly without flickering at the threshold. Flight warnings also use a short release hold, so stall, terrain, gear, and overspeed cues stay readable through noisy approach samples and clear when the live HUD is paused or covered.

The live route-risk row retains the steepest route slope after the launch briefing fades, so the handling envelope stays visible throughout the sortie. Traffic Run adds a curated high-speed sweep whose catalog contract explicitly rewards passing distinct traffic contacts, turning the existing pooled traffic into a repeatable challenge.

Traffic contract progress now gets the same one-shot in-flight acknowledgement as settlement and waterway tours, while duplicate contacts and final completion remain quiet. Waterway Tour adds a curated rainy river route that deliberately exposes the existing multi-waterway contract. Thermal Surf adds a clear-sky lift route that deliberately exposes the existing sustained-thermal contract.

Runway returns now announce only worsening fuel pressure transitions, so tight and low reserve states are actionable without repeating warnings every frame.

Settlement-tour and waterway-tour contracts now acknowledge each distinct city, village, river, lake, or sea objective once, so partial progress is readable before the final completion banner.

Missed gate crossings also remain visible in the live HUD and its accessible route-progress label until the sortie resets.

During a return or engine-out glide, the HUD compares endurance to a conservative runway estimate and reports HOME OK, HOME TIGHT, or HOME LOW.

## A sortie

Un-authored sorties select a stable route family from the generated airfield biome, so snow, swamp, desert, volcanic, and water provinces receive matching navigation shapes while curated courses keep their authored profiles.

The cue at the top of the screen points at the next gate. Fly through the rings, then bring the jet back to the runway. A landing scores the run. A crash ends it. Results and crash debriefs show the human course name, authored conditions, and a finite failure label such as SINK RATE, SLOPE, GEAR UP, or OBSTACLE instead of a generic impact. From the results card, retry the same course or start a new world. The preflight route briefing includes minimum clearance, maximum turn, steepest route slope, and top climb so the intended handling envelope is explicit before the first gate, and a single lightweight route trace connects the planned gates for readable external-camera guidance. The trace automatically disappears in cockpit, pause, results, and crash states so the first-person view stays clean. Curated routes include orbit, sweep, slalom, ridge, canyon, coastal, fjord, river, volcanic, desert, alpine, storm, night, timberline, glacier, rainforest, mesa, badlands, saltflat, savanna, tundra, swamp, archipelago, thermal, and pattern approach runs. The course picker previews each seeded course's deterministic bonus task alongside authored conditions before launch: Storm Run pins a readable low-visibility thunderstorm, Fjord Run uses fog over steep coastal shoulders, Night Ops pins a foggy midnight sky, Timberline Run uses a fast rolling route through forested hills, Glacier Run pins snow over a high alpine pass, Rainforest Run pins heavy rain over a low winding jungle line, Mesa Run crosses broad tableland shelves, Saltflat Run opens a long high-speed line across reflective flats, Savanna Run sweeps across open grassland and acacia country, Tundra Run pins snow over frozen lakes and rolling ground, Swamp Run pins rain over wetlands and winding channels, Archipelago Run uses fog over a broken-water island hop, Thermal Run locks clear skies and threads its gates through the seeded lift corridor for a repeatable sunlit altitude climb, Pattern Approach keeps a short clear-weather base-to-final pattern focused on the landing, and Crosswind Approach locks that same pattern into a storm with a deterministic runway-relative wind side. Their weather and authored clock stay locked so each challenge remains repeatable instead of luck-based. On the return leg, the HUD also gives a cached CRAB L/R cue when the crosswind needs a deliberate correction.

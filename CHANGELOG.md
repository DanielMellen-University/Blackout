# Changelog

## Unreleased

- **10.826** Fast-path pooled cloud fade distances at full-opacity and out-of-range bounds, preserving transition-band rendering while reducing atmospheric square roots.
- **10.825** Reuse settlement footprint radii and rank street clearance with squared distances, preserving procedural placement while reducing city-generation square roots.
- **10.824** Remove duplicate wind magnitude roots from HUD direction formatting while preserving calm thresholds and compass output.
- **10.823** Gate mission beacon opacity with squared distance at the close/far envelope edges, preserving visual falloff while reducing per-tick square roots.
- **10.822** Fast-path full-strength thermal cores before square roots, preserving lift falloff while reducing centered fixed-step pocket math.
- **10.821** Rank thermal route pockets with squared separation, preserving nearest-pocket selection while removing fixed-neighborhood square roots.
- **10.820** Replace vegetation slope square roots with an equivalent squared threshold, preserving prop placement while reducing terrain-generation math.
- **10.819** Rank radar candidates with squared range and materialize exact distances only for the six retained contacts, preserving HUD ordering while reducing refresh square roots.
- **10.818** Reject out-of-envelope wake altitudes before horizontal speed square roots, preserving pooled wake behavior while reducing high-altitude effect work.
- **10.817** Defer grounded-flight speed square roots until the aircraft is actually on the runway, preserving surface authority while reducing airborne physics work.
- **10.816** Rank air-traffic alerts with squared 3D separation and defer exact distance math until the nearest candidate wins, preserving warning behavior while reducing HUD polling square roots.
- **10.815** Defer exact obstacle-sweep distance math beyond the fixed 32-probe cap, preserving collision coverage while reducing long-segment square roots.
- **10.814** Defer exact contact-sweep distance math until the broad phase needs detailed probes, preserving collision coverage while reducing airborne sweep square roots.
- **10.813** Gate pooled landing scrub speed math before square roots below its activation floor, preserving touchdown effects while reducing rollout work.
- **10.812** Gate ground and water wake speed math before square roots when the pooled effects cannot activate, preserving wake thresholds while reducing render-loop work.
- **10.811** Use a squared home-airfield refuel gate, preserving the inclusive 75 m envelope while removing a fixed-step distance square root.
- **10.810** Gate warning lookahead speed math with a squared threshold, preserving terrain and obstacle cues while removing slow-flight HUD square roots.
- **10.809** Gate collision attitude and horizontal-speed math to real contact frames, preserving landing outcomes while reducing fixed-step work during normal airborne flight.
- **10.808** Reject out-of-radius thermal pockets with squared distance during fixed-step lift sampling, preserving the lift envelope while removing most pocket square roots.
- **10.807** Skip distant terrain-prop fade square roots while preserving the smooth near-field fade and opaque chunk alpha.
- **10.806** Skip far-gate proximity square roots with a squared envelope check, preserving the existing near-ring emphasis curve.
- **10.805** Reject out-of-range radar candidates with squared distance before the required contact distance is computed, preserving the inclusive boundary.
- **10.804** Assemble the live mission HUD label without temporary arrays or filter/join work, preserving bounded copy and truncation.
- **10.803** Use squared settlement radar range gates, preserving nearby landmark selection while removing bounded sweep square roots.
- **10.802** Reuse bounded climate-grid containers during terrain generation, reducing short-lived streamed-tile arrays while preserving deterministic geometry output.
- **10.801** Reuse one typed deterministic cell order for hydrology priority routing and drainage grading, reducing bounded catchment-build allocations without changing river output.
- **10.800** Cache conservative warped-shoreline bounds on generated basins and reuse them for pond, terrain, and water tile culling while retaining legacy fallback behavior.
- **10.799** Evaluate shared water distance fade curves once per vertex and reuse them across fragment stages, preserving thresholds while reducing repeated per-fragment distance work.
- **10.798** Keep the current and immediately previous roadmap chunks in shared version metadata, preventing stale README release references.
- **10.797** Reuse one horizontal-speed calculation across terrain and obstacle warning lookahead, preserving cue precedence while removing duplicate HUD math.
- **10.796** Reuse caller-owned terrain planner output during stream reschedules, preserving deterministic coverage while reducing short-lived tile-array and record allocations.
- **10.795** Index desired terrain leaves by pooled aligned quadtree roots, preserving LOD replacement fade dependencies while avoiding full desired-horizon scans during stream reschedules.
- **10.794** Preserve the ghost replay sample clock across long frame gaps, keeping interpolation cadence stable without adding samples or per-frame allocations.
- **10.793** Probe aligned quadtree ownership keys for terrain contact sampling, preserving the finest overlapping LOD surface while removing resident-tile scans on cell misses.
- **10.792** Query only aligned quadtree neighbors when preparing terrain LOD skirts, preserving seam coverage while avoiding four whole-horizon map scans per tile request.
- **10.791** Retain fractional pooled-traffic cadence time, preventing uneven render frames from slowing deterministic traffic contacts and desynchronizing radar or contract timing.

- **10.790** Reuse bounded shoreline clipping buffers for analytic basins, preserving clipped lake and sea geometry while removing per-edge arrays and intersection allocations during water builds.
- **10.789** Use a squared settlement-radius gate for point obstacle probes, preserving collision candidates while removing one square root per loaded plan.
- **10.788** Use squared range gates for pooled traffic rendering and radar collection, preserving alert distances while removing unnecessary square roots from bounded slot scans.
- **10.787** Remove comparison-only square roots from terrain LOD rechecks and settlement collision broad-phases, preserving thresholds while trimming hot-loop math.
- **10.786** Use squared-distance visibility and regional-road comparisons, preserving settlement and curved-road thresholds while removing repeated square roots from render-frame checks.
- **10.785** Fast-path repeated ground-cache coordinates through the most recent slot, reducing collision, camera, and normal-probe scans without changing cache bounds or sampler invalidation.
- **10.784** Cache normalized radar landmark names in pooled contacts and reuse an empty traffic list, preserving label updates while trimming duplicate string work during 10 Hz sweeps.
- **10.783** Cache completed terrain result keys and distances before sorting, preserving nearest-first uploads while removing repeated key construction and map lookups from the comparator.
- **10.782** Reuse retained settlement stream jobs across cell hops, refreshing their priority in place instead of cloning every queued record during fast flight.
- **10.781** Add a caller-owned terrain color path and use it during tile generation, removing the remaining per-vertex result tuple allocation while preserving the public color helper and palette output.
- **10.780** Route solid terrain palettes through caller-owned tuples, removing the base and weighted-candidate RGB allocations from streamed vertex coloring while preserving deterministic biome blends.
- **10.779** Reuse terrain palette tuples in place, removing short-lived RGB arrays from streamed vertex coloring while preserving blended biome output and draw budgets.
- **10.778** Collapse terrain contact-cache hits to one bounded map lookup, preserving cached misses while trimming repeated work when physics revisits streamed cells.
- **10.777** Remove recursive array allocations from terrain quadtree planning, preserving deterministic coverage while reducing garbage during rapid stream reschedules.
- **10.776** Keep hidden low-quality traffic contacts advancing in the simulation while trimming only their meshes, so radar, alerts, and traffic contracts never freeze when visual budgets change.
- **10.775** Keep the full deterministic traffic contact pool on radar and contracts while Low quality trims only visual instances, so graphics presets cannot change gameplay fairness.
- **10.774** Cache settlement stream-cell priority and distance before sorting, preserving landmark-aware ordering while removing repeated anchor resolution and distance work from the comparator.
- **10.773** Measure mission clearance across the full runway-width route corridor, keeping route briefings and validation honest when terrain rises under a wing.
- **10.772** Add deterministic broad vegetation clustering so forest and lowland coverage forms readable patches without changing instance budgets or draw counts.
- **10.771** Replace regional settlement link filtering and sorting with a bounded deterministic best-candidate scan, preserving sparse graph selection while reducing streaming-planner allocations.
- **10.770** Remove temporary numeric arrays from settlement plan, building, road, and point validation, preserving malformed-worker fail-closed behavior while reducing large-city reply checks.
- **10.769** Make settlement worker payload validation allocation-free across plans, buildings, roads, and road points while preserving fail-closed malformed-reply handling.
- **10.768** Consolidate settlement building, roof, civic-accent, and crown classification into one pass and scan plaza anchors directly, reducing large-landmark install allocations while preserving instance order and silhouettes.
- **10.767** Make terrain worker geometry validation allocation-free by replacing temporary bounds and attribute arrays with scalar and direct-key checks, preserving fail-closed malformed-payload handling.
- **10.766** Pool terrain-skirt numeric staging buffers and verify previously built skirts remain stable across reuse, reducing coarse-tile generation garbage without changing LOD seams.
- **10.765** Emit terrain skirt vertices directly instead of constructing per-edge point and triangle arrays, preserving LOD seam coverage and wet-edge behavior while reducing tile-build garbage.
- **10.764** Reuse analytic basin and river-ribbon polygon inputs plus round-cap points, removing repeated container allocations while preserving clipped water geometry and flow attributes.
- **10.763** Remove per-triangle water emission arrays from clipped terrain, analytic basin, and river ribbon geometry, preserving vertex attributes while reducing streamed water generation garbage.
- **10.762** Reuse fixed water-triangle clipping workspaces, removing per-triangle vertex, polygon, and intersection allocations while preserving clipped shoreline geometry.
- **10.761** Reuse synchronous water-mesh staging arrays before typed-buffer creation, reducing per-tile generation garbage without changing water geometry or GPU attributes.
- **10.760** Reuse the bounded basin list during terrain water-mesh setup, removing a per-tile generation allocation while preserving shoreline and water geometry.
- **10.759** Build terrain worker transfer lists with direct unique-buffer appends, removing temporary Sets and attribute arrays while preserving zero-copy geometry delivery.
- **10.758** Remove released regional-road jobs in place during settlement unloads, preserving road queue order while avoiding replacement-array allocations.
- **10.757** Reuse caller-owned river reach buffers and stamped deduplication during terrain generation, removing per-catchment Sets and per-tile array spreads without changing water detail or geometry.
- **10.756** Key protected settlement anchor planning to the job's pad snapshot, removing an extra global OpsPad allocation and preventing stale cache context during overlapping reseeds.
- **10.755** Invalidate the cached airfield obstacle frame when the shared OpsPad revision changes, preventing stale runway collisions after external pad updates without restoring per-probe allocations or trigonometry.
- **10.754** Remove protected settlement retry jobs in place, avoiding queue-array allocations while preserving anchor priority and retry ordering.
- **10.753** Cache the airfield runway frame used by swept obstacle probes, removing repeated pad copies and yaw trigonometry while preserving the aircraft collision envelope.
- **10.752** Cache settlement building yaw sine and cosine in the occupancy index, removing repeated trig work from collision rejection without changing placement rules.
- **10.751** Inline procedural settlement collision-axis probes, removing per-candidate angle arrays and closures while preserving exact placement and overlap rules.
- **10.750** Avoid temporary empty-bucket arrays while populating procedural settlements, reducing generation garbage without changing placement, collision, or silhouette rules.
- **10.749** Remove transient iterator and slot-array allocations from terrain worker dispatch and reseed cancellation, preserving bounded streaming behavior under rapid travel and world resets.
- **10.748** Reject empty or non-finite optional aircraft models before replacement, keeping the procedural F-35 fallback intact and leak-free when an external asset is malformed.
- **10.747** Start brand-new pilots in Training Orbit when no course preference exists, preserving saved Random selections and replay/custom-seed launches.
- **10.746** Make Training Orbit a dependable onboarding route with locked clear midday conditions, while Random and advanced courses retain their full weather and time variety.
- **10.745** Add a restrained single-mesh canopy frame to cockpit view, keeping first-person flight grounded without restoring the oversized cockpit geometry or adding per-frame work.
- **10.744** Reuse the terrain scheduler's desired-key set across focus and LOD reschedules, reducing transient allocations during fast travel without changing queue priority, retirement, or coverage behavior.
- **10.743** Cache immutable river-reach segment metrics at generation time so repeated terrain samples avoid recomputing deltas and lengths across channel, shoulder, and delta checks, with geometry and water regression coverage.
- **10.742** Short-circuit boolean hydrology tile queries so terrain streaming can detect river intersections without materializing a reach-result array, while preserving detailed reach enumeration and adding cross-seed equivalence coverage.
- **10.741** Broaden Alpine valley shoulders and bound mountain uplift so tall ranges stay flyable instead of forming needle walls, with focused continuity coverage for alpine and green terrain.
- **10.740** Keep the first-sortie flight briefing hint aligned with the selected Arcade or Conventional keyboard control layout.
- **10.739** Keep keyboard direction banners and axis documentation aligned with the selected Arcade or Conventional control layout.
- **10.738** Add a persisted Arcade or Conventional keyboard control layout, keeping the default A/D yaw and Q/E roll scheme while allowing pilots to put roll on A/D and yaw on Q/E with live labels and focused input coverage.
- **10.737** Cache each catchment's unique river-reach list so repeated terrain and water generation queries avoid flattening spatial bins and allocating a temporary deduplication set.
- **10.736** Harden basin shoreline distance queries against malformed geometry and coordinates so invalid hydrology payloads fail closed outside water instead of poisoning terrain or water clipping.
- **10.735** Cache flight-log HUD aria text with its distance and G-load buckets, removing repeated live-update string and array work without changing visible telemetry.
- **10.734** Harden obstacle point and segment queries against malformed coordinates and padding so invalid collision telemetry fails closed before settlement or airfield broadphases.
- **10.733** Harden landing classification against malformed pitch, bank, up-vector, and pad-state values so corrupt contact payloads fail closed before safe outcomes are awarded.
- **10.732** Pool terrain weather snapshots across reads, removing avoidable diagnostic and HUD allocations while preserving normalized rain and snow values.
- **10.731** Harden landing classification against malformed impact scalars, surface kinds, gear flags, and terrain normals so corrupt contact telemetry fails closed without throwing through the flight loop.
- **10.730** Reuse a caller-owned collision outcome in fixed-step landing checks, removing one result-object allocation per physics tick while preserving the public classifier helpers and outcome semantics.
- **10.729** Make mission startup retry one malformed authored route with a canonical orbit fallback, exposing the fallback in the briefing and preserving a playable gate circuit without adding frame-time work.
- **10.728** Add a low-cost analytic water-body variation field so distant rivers, lakes, and seas keep broad visual breakup after fine texture detail fades, without adding a texture fetch or draw call.
- **10.727** Cache grounded terrain normals across short unchanged taxi poses, refreshing after 4 m of movement or a sampler revision so landing-slope checks stay accurate without four extra terrain probes every physics tick.
- **10.726** Add persistent Clear, Cloudy, Fog, Rain, Storm, Snow, and Night course-condition filters to the title and pause pickers, allowing night routes to overlap their weather condition without rebuilding worlds.
- **10.725** Carry the cached terrain normal into non-impact landing classification so over-limit grounded slopes fail as a slope crash without adding airborne contact sampling.
- **10.724** Add persistent Approach, Range, Precision, and Climb course-focus filters to the title and pause pickers, derived from authored route profiles without rebuilding worlds.
- **10.723** Add persistent Relaxed, Standard, and Technical course filters to the title and pause pickers, with bounded counts, explicit empty states, and focused regression coverage.
- **10.722** Remove avoidable settlement queue comparator closures during kilometre-cell crossings and add caller-owned terrain streaming telemetry for allocation-free debug profiling, with regression coverage for the stats contract.
- **10.721** Harden active terrain fade invalidation so a desired-tile removal between stream schedules reactivates its chunk for disposal and clears cached contact ownership without restoring the all-resident per-frame scan.
- **10.720** Keep settled distant terrain out of the per-frame fade scan, refreshing all targets only after stream or LOD focus changes while preserving near props, replacement fences, and fallback retirement coverage.
- **10.719** Align hidden debug flight telemetry with the authoritative engine state so nonlinear target speed, resolved lever, and afterburner lockout stay truthful, with regression coverage for invalid target values.
- **10.718** Remove the temporary resident-chunk array from terrain diagnostics and prefer the smallest desired tile during overlapping LOD replacements, with regression coverage for coarse-to-near ownership.
- **10.717** Route normal gate guidance through the active camera projection, fixing the mirrored cockpit left/right cue while preserving the existing bounded HUD and navigation paths.
- **10.716** Add a cached target-speed marker to the live IAS dial, clamped to the visible envelope so current airspeed and ENG% equilibrium are readable without new geometry, draw calls, or per-frame DOM churn.
- **10.715** Show the engine's level-flight target speed beside ENG%, with cached knots formatting and accessible text so the arcade speed model is readable without changing flight physics.
- **10.714** Move night-storm fog readability to the atmosphere boundary that owns the final fog colour, preserving the sky background and preventing lightning amplification while keeping the update allocation-free.
- **10.713** Couple the pooled terrain fog horizon to normalized daylight, cloud, rain, and snow state so weather transitions keep landforms readable without adding geometry, draws, or per-frame allocations.
- **10.712** Reuse stable settlement weather and lighting snapshot objects across reads, removing accessor allocations while keeping normalized values current for diagnostics and HUD integrations.
- **10.711** Pool settlement stream-cell staging containers and sort the live queue in place, removing temporary wanted sets, retained arrays, and mapped key lists during fast travel without changing settlement priority or eviction behavior.
- **10.710** Drain mixed terrain retirement batches completely after swap-pop removal, preventing a waiting LOD replacement from skipping neighboring disposable fallbacks until a later frame.
- **10.709** Reduce terrain streaming fade overhead by removing per-tile callback allocations and batching contact-cache invalidation across retiring and removed chunk batches.
- **10.708** Invalidate every cached terrain-cell ownership entry before unloading or disposing streamed geometry, preventing collision and radio-altitude probes from resurrecting dead LOD surfaces.
- **10.707** Synchronize runtime, README, changelog, and release-check metadata so the advertised roadmap chunk matches the latest shipped changes.
- **10.706** Cache deterministic city and village anchor-cell selection per world and airfield context, avoiding repeated climate scoring during settlement streaming.
- **10.705** Normalize malformed flight axes and boolean controls before fuel, engine, physics, and visual systems consume them, keeping stale input payloads finite and fail-closed.
- **10.704** Bound stale fuel capacity values to the normalized 0–100 tank range so malformed saves cannot distort fuel fractions or refuel behavior.
- **10.703** Reject malformed afterburner, heat, and daylight values in DRY RUN, THERMAL CONTROL, NIGHT FLIGHT, and night-landing rewards so impossible scalar telemetry cannot farm bonuses.
- **10.702** Reject negative fuel fractions in the DEADSTICK contract so impossible telemetry cannot complete the empty-tank objective or diverge from its landing payout.
- **10.701** Require an explicit boolean airborne state across stunt and altitude milestones, thermal lift, and water-contact classification, preventing malformed truthy payloads from changing scored progress or ditching outcomes.
- **10.700** Require an explicit boolean airborne state across every event-driven contract recorder, preventing malformed truthy payloads from farming water, weather, terrain, distance, and high-speed objectives.
- **10.699** Normalize bounded radar landmark identities during RADAR RUN arrival checks so long generated IDs can complete the lock-then-arrive contract consistently.
- **10.698** Route fixed-step contract dispatch through the explicit airborne state, preventing fast runway rolls from earning low-level, speed-band, or storm progress and failing closed on malformed airborne values.
- **10.697** Make settlement destination rewards distinct per streamed landmark ID within a sortie, preventing repeated arrivals from farming score or inflating SCOUT progress while preserving RADAR RUN's lock-then-arrive flow.
- **10.696** Harden touch, ghost replay, and streamed-settlement visibility boundaries so malformed truthy values cannot leak visual layers across title, cockpit, menu, or flight states.
- **10.695** Normalize RadarSystem reduced-motion input to an explicit boolean, preserving the full contact budget when malformed runtime values reach the visual boundary.
- **10.694** Bound the radar discovery ledger with a FIFO eviction window, preserving one-shot landmark cues while preventing infinite-world exploration from retaining every discovered ID forever.
- **10.693** Normalize reduced-motion setters to strict booleans across visual systems and make CameraSystem ignore late calls after disposal, preventing malformed preference values from enabling effects or reviving torn-down state.
- **10.692** Cache Atmosphere's pooled weather snapshot between weather mutations and simulation updates, removing duplicate same-frame profile and wind blending work without changing live transition behavior.
- **10.691** Keep same-target weather requests idempotent during an active front transition, preventing repeated route/UI reconciliation from restarting weather shifts while preserving explicit instant snaps.
- **10.690** Harden pooled water-wake teardown and reduced-motion transitions so late lifecycle calls are no-ops after disposal and active ditch splashes clear immediately when motion is reduced.
- **10.689** Reuse the aircraft's fixed-step ground-height cache during collision classification, removing a duplicate terrain sampler query from every airborne near-ground check.
- **10.688** Make the version checker validate the README recent-changes marker, preventing stale roadmap metadata from shipping after a commit lands.
- **10.687** Stabilize tied radar contacts with deterministic landmark identity and position ordering, preventing crowded city and village labels or target cycling from reshuffling when streamed source order changes.
- **10.686** Replace capped settlement point probes with a bounded segment-vs-building sweep, preventing long physics steps from tunneling through loaded city or village buildings while retaining the cheap airfield fallback path.
- **10.685** Preserve insertion order when removing a streamed settlement from the bounded collision-plan view, keeping equal-distance radar landmarks stable after eviction.
- **10.684** Reuse the bounded settlement collision-plan view for building-budget totals and radar landmark snapshots, removing more streamed-map iterator churn without changing placement, eviction, or landmark order.
- **10.683** Keep a bounded collision-plan array alongside streamed settlements so swept obstacle checks avoid allocating a `Map` iterator on every physics step while retaining the existing settlement lookup map for streaming and UI work.
- **10.682** Add a conservative segment-level settlement broadphase to swept obstacle checks, skipping repeated building-bucket probes when a high-speed flight path misses every loaded landmark while preserving exact nearby collision results.
- **10.681** Remove the per-update obstacle-probe closure from flight warnings, preserving near/mid/far early exit and coordinates while keeping the HUD lookahead allocation-free.
- **10.680** Reuse one caller-owned control-surface target record across aircraft fixed steps, removing steady-state target-object allocations while preserving the public helper and all articulation values.
- **10.679** Reuse caller-owned climate records and static probe layouts during procedural airfield searches, removing transient allocations from slope, coastal, departure, footprint, wet-neighbor, and pad validation without changing deterministic candidate rules.
- **10.678** Cache successful natural airfield pads per world seed inside a bounded 24-entry window, avoiding repeated deterministic spawn searches on retries while leaving active-pad and non-default searches uncached.
- **10.677** Add a bounded emergency airfield for first-boot world generation, so pathological terrain seeds still produce a playable recovery pad while committed worlds retain transactional reseed rollback.
- **10.676** Refresh the pooled rain line buffer on world reseed so active storms cannot flash stale streaks while keeping the steady-state update allocation-free.
- **10.675** Seed pooled rain placement and speeds from the active world so storms vary per world while keeping the existing draw budget and allocation-free frame updates.
- **10.674** Remove unseeded startup and audio randomness so pre-reseed atmosphere state and procedural noise remain repeatable without adding per-frame work.
- **10.673** Make the existing runway asphalt respond to rain and snow with bounded roughness and tint changes, improving wet and frost approach readability without adding geometry or draw calls.
- **10.672** Add a bounded cached fill to airfield structure materials so hangars, towers, and apron shells remain readable in cloud and night contrast without adding lights, meshes, or draw calls.
- **10.671** Seed pooled snow motion and placement from the active world so retries and replay/debug captures keep the same precipitation without adding draw calls or per-frame allocations.
- **10.670** Keep pooled snow above the aircraft anchor, lower its peak transparent overdraw, soften snow-tinted vegetation, and replace terrain/water fade dithering with smooth blends so runway-level storms and streamed transitions stop veiling the ground with white static.
- **10.669** Add a bounded cloud-driven airframe fill so overcast daylight keeps the stealth silhouette readable without brightening clear daytime scenes or adding lights, meshes, or draw calls.
- **10.668** Gate distant and Low-quality water roughness sampling behind the shared detail and distance budget, removing invisible normal-texture fetches without changing the water look up close.
- **10.667** Give river ribbons a bounded local flow signal derived from channel width and grade, so streams, main channels, and steep reaches no longer share one uniform shader response without adding geometry or draw calls.
- **10.666** Preserve authored descending approach profiles while solving terrain clearance, so base-to-final routes no longer get flattened into monotonic climbs.
- **10.665** Make live navigation guidance fully screen-reader complete by exposing target range, altitude, trend, ETA, and approach cues, and clear hidden navigation semantics instead of leaving stale output behind.
- **10.664** Add cue-specific warning descriptions to the HUD accessibility label so screen readers distinguish terrain, flare, go-around, gear, fuel, and speed warnings.
- **10.663** Carry bounded warning identity into the HUD so `LOW ALT`, `FLARE`, and `GO AROUND` receive distinct visual treatment without extra render-loop work.
- **10.662** Give `LOW ALT` a distinct restrained descending cue so terrain proximity does not collapse into the generic warning tone.
- **10.661** Give `GO AROUND` and `FLARE` landing guidance distinct restrained edge cues instead of collapsing both into the generic warning tone.
- **10.660** Give low and empty fuel warnings a distinct restrained edge cue instead of collapsing them into the generic warning tone, without changing hysteresis or audio cadence.
- **10.659** Map standard gamepad D-pad left to edge-triggered sortie reset, completing controller recovery parity without changing the 30 Hz poll budget.
- **10.658** Add an edge-triggered `P` pause shortcut for keyboard pilots, routing through the existing pause queue without changing Escape modal behavior or adding frame work.
- **10.657** Reflow the touch utility deck into a compact phone layout, preserving large-screen controls while keeping the HUD visible on narrow and very small screens.
- **10.656** Add debounced controller link cues so pilots see when a gamepad connects or disappears, while failed polls still clear flight input immediately.
- **10.655** Fail closed on malformed or partially disconnected gamepad payloads, clearing stale axes and utility edges instead of throwing through the animation loop.
- **10.654** Map the standard gamepad Start edge to the existing pause queue so controller pilots can freeze flight without keyboard input, preserving the 30 Hz poll budget and edge-safe disconnect cleanup.
- **10.653** Add an edge-triggered PAUSE action to the touch flight deck, routing through the existing pause menu and clearing held controls before freezing simulation.
- **10.652** Add an edge-triggered RESET action to the touch flight deck so mobile pilots can restart a sortie after a crash or bad approach, reusing the existing reset queue without per-frame polling work.
- **10.651** Lift coarse/fine terrain skirt normals toward a soft upward blend so LOD crack covers stop reading as dark hairline seams, without adding geometry, draws, or runtime work.
- **10.650** Complete touch replay parity with edge-triggered GHOST visibility and COPY seed/replay-link actions, reusing existing bounded queues without per-frame work.
- **10.649** Complete the touch utility deck with edge-triggered WX weather-cycle and AUDIO mute controls, reusing the existing queues without adding simulation-loop polling or allocations.
- **10.648** Add an edge-triggered RADAR target-cycle button to the touch deck, reusing the existing radar queue so mobile pilots can lock nearby settlements and traffic without per-frame polling work.
- **10.647** Lower and narrow the procedural F-35 canopy crown so the chase silhouette reads as a sleek stealth jet instead of a tall bubble cockpit, with no new geometry or draw calls.
- **10.646** Add a touch stability-assist toggle, reusing the existing one-shot input queue so touch pilots can enable gentle trim without adding per-frame work or changing keyboard/gamepad behavior.
- **10.645** Add standard-gamepad utility actions for trim assist, mute, weather, ghost, and radar target cycling, with edge-safe disconnect/error cleanup so stale button presses cannot leak across polls or pauses.
- **10.644** Complete standard gamepad flight parity with held left-bumper speed brake plus edge-triggered X gear and Y camera actions, reusing the existing input queues without adding simulation-loop allocations.
- **10.643** Add a held speed-brake action to the touch flight deck, merging it with the existing keyboard brake path so touch approaches can shed speed without adding per-frame work or changing desktop controls.
- **10.642** Add camera-view and landing-gear edge actions to the touch flight deck, reusing the existing one-shot input queues so touch pilots can complete the full flight loop without changing desktop controls or per-frame allocations.
- **10.641** Drive existing airfield windows, hangar bay, flood heads, tower beacon, and apron lamps from cached daylight/weather contrast so night operations stay readable without new lights, meshes, or draw calls.
- **10.640** Add a weather-aware cool airframe fill at low daylight so storm clouds, rain, and snow preserve the F-35 silhouette without brightening clear nights or adding dynamic lights.
- **10.639** Raise only the far terrain grid from six to eight samples so rounded mountain landforms keep a smooth horizon silhouette without promoting distant tiles to mid-range detail.
- **10.638** Soften peak rain and snow presentation with lower-contrast pooled materials, shorter rain streaks, and smaller feathered snow sprites without changing precipitation budgets or draw calls.
- **10.637** Fade settlement facade windows and panel rhythm with view distance so close buildings stay readable while distant skylines stop shimmering, without adding instances or draw calls.
- **10.636** Break up river shading with darker low-saturation water, broad surface variation, and restrained flow highlights so channels stop reading as uniform cyan ribbons without adding geometry or draw calls.
- **10.635** Increase only the stormy-night readability lift so rain and cloud cover preserve terrain and aircraft silhouettes without brightening clear nights or lightning flashes.
- **10.634** Replace sharp lowland grass cones with rounded instanced ground-cover clumps so snow and weather shading cannot turn smooth green terrain into white spike fields.
- **10.633** Cache resolved land/water contact surfaces alongside frame-scoped heights so repeated aircraft probes reuse rendered surface kind without stale values across terrain revisions.

## v0.12.0 - 2026-09-22

### Ship

- **10.630** Remove transient `Set` allocations from padded multi-bucket settlement collision probes by using stamped collision candidates, reducing hot-path garbage without changing obstacle results.

- **10.629** Fail closed on malformed terrain and settlement worker replies, returning active jobs through synchronous fallback instead of throwing or leaving streaming slots blocked.

- **10.628** Reuse the fixed-step aircraft ground sample for terrain warning lookahead, removing a duplicate current-point climate query at the HUD cadence while preserving analytic fallback behavior.

- **10.627** Prevent a synchronous terrain-worker post failure from duplicating the tile that the worker pool already requeued for synchronous fallback.

- **10.626** Make terrain sampler registration owner-aware so stale world teardown cannot clear the newer world's contact, height, or surface callbacks during overlapping rebuilds.

- **10.625** Make settlement worker construction fail closed so CSP or browser worker startup errors preserve synchronous settlement generation instead of aborting world creation.

- **10.624** Harden settlement worker dispatch so synchronous structured-clone or worker-post failures terminate the broken worker, requeue the active job, and fall back without throwing through the frame loop.

- **10.623** Make the input manager terminal after disposal, preventing late keyboard, gamepad, or touch state from re-entering a torn-down flight runtime.

- **10.622** Make the terrain worker pool terminal after disposal, preventing post-shutdown quality changes from recreating workers or accepting new jobs.

- **10.621** Make terrain streaming teardown idempotent, preventing repeated shutdown paths from disposing shared GPU materials more than once or touching an already-detached scene.

- **10.620** Expand deterministic thermal sampling to a fixed 3x3 cell neighborhood, keeping diagonal lift pockets reachable at streamed-cell corners without allocating in the flight step.

- **10.619** Normalize render-quality requests across aircraft, radar, and pooled flight effects, keeping malformed runtime values inside the shared visual-budget contract.

- **10.618** Normalize direct camera and settlement render-quality requests, keeping malformed runtime values from changing occlusion budgets or bypassing the shared detail envelope.

- **10.617** Normalize direct air-traffic render-quality requests before sizing pooled silhouettes, contrails, and beacons, so malformed runtime values cannot silently select the High traffic budget.

- **10.616** Normalize malformed World render-quality requests before applying the shared terrain, settlement, traffic, and atmosphere envelope, keeping invalid runtime values from selecting an unintended quality budget.

- **10.615** Normalize the shared weather propagation candidate before change detection, so malformed precipitation, daylight, cloud, and wind values fail closed without freezing stale terrain or reapplying shader uniforms every frame.

- **10.614** Fail closed on malformed settlement weather inputs so non-finite precipitation and daylight cannot poison city, village, or road shader uniforms.

- **10.613** Fail closed on malformed terrain weather inputs so non-finite rain, snow, cloud, and wind values cannot poison streamed terrain or water shader uniforms.

- **10.612** Tie terrain horizon fades to the active render-quality radius so Low mode eases its shorter stream edge instead of popping fully opaque tiles at the cutoff.

- **10.611** Deduplicate malformed seeded-world retention manifests by seed identity, preserving the newest touch instead of wasting bounded record slots.

- **10.610** Clear stale explicit-seed identity when course selection changes through another tab or a storage reset, keeping the next random launch on the shared bounded record key.

- **10.609** Keep the live HUD BUFFET cue on the ungated weather drive so gear damp restrains camera and airframe motion without stealing the weather read on approach.
- **10.608** Prefer BUFFET over SHIFT in the compact weather row when both would show, keeping the live handling cue readable.
- **10.607** Hold the HUD BUFFET cue through a hysteretic exit floor so gear damp and weather noise cannot flash the compact weather label.
- **10.606** Quiet storm buffet camera drive when the aircraft is crashed, matching the airframe path that already settles on impact.
- **10.605** Bound explicit seeded Infinite World score and ghost families to the newest twelve worlds, pruning linked local records without touching authored or ordinary-random history.
- **10.604** Isolate explicitly seeded Infinite World score and ghost records by seed while preserving the bounded shared bucket for ordinary random flights.
- **10.603** Include bounded bonus-contract status, instruction, and progress in copied sortie recaps so shared results retain the optional objective.
- **10.602** Mark unfinished bonus contracts as failed in crash debriefs, keeping interrupted objectives from appearing open after a crash.
- **10.601** Preserve the active bonus contract in crash debriefs, including its bounded progress and instruction, so failed sorties still explain the optional objective.
- **10.600** Validate generated mission routes before pooled gate placement, failing cleanly on malformed points, degenerate legs, over-capacity routes, or lost terrain clearance.
- **10.599** Defer the renderer and flight runtime behind a tiny boot entry so the title screen can paint before Three.js and terrain code download.
- **10.598** Harden ghost visibility and stability-assist fallbacks so malformed runtime values cannot bypass boolean preference contracts.
- **10.597** Harden render-quality fallback resolution so malformed graphics presets cannot leak into renderer setup.
- **10.596** Normalize course IDs before persisting selection state so forged runtime values cannot poison the launch catalog.
- **10.595** Feed the authoritative aircraft engine output into flight audio so rumble, playback rate, and turbine whine cannot drift from afterburner physics or plume power.
- **10.594** Derive the public course ID type from the authored runtime catalog and regression-test catalog uniqueness so new roadmap entries cannot drift out of storage and picker validation.
- **10.593** Fail closed on malformed mission route profiles and modifiers before route generation, keeping replayed mission state inside the authored catalog.
- **10.592** Keep Atmosphere's public weather state synchronized with the normalized director profile when malformed runtime IDs arrive.
- **10.591** Fail closed on malformed replay or course weather IDs so the director always resolves a valid authored profile instead of indexing undefined data.
- **10.590** Derive the weather identifier type from the cycle catalog so front order and keyed weather tables cannot drift as new conditions are added.
- **10.589** Derive the course-picker category type from its runtime catalog so filter normalization, labels, and rendering cannot drift.
- **10.588** Derive the course-picker sort type from its runtime whitelist so new sort options cannot drift between compile-time and persisted-value validation.
- **10.587** Consolidate course-picker sort validation into one typed whitelist so normalization, rendering, and sorting cannot drift.
- **10.586** Add bounded Best precision streak sorting to the course picker, using cached precision records without changing authored order for ties.
- **10.585** Add bounded Hardest negative G sorting to the course picker, using persisted negative-load records without changing authored order for ties.
- **10.584** Add bounded Highest G sorting to the course picker, using persisted peak-load records without changing authored order for ties.
- **10.583** Add bounded Most destinations sorting to the course picker, using persisted landmark-discovery records without changing authored order for ties.
- **10.582** Add bounded Most waterways sorting to the course picker, using persisted river, lake, and sea records without changing authored order for ties.
- **10.581** Add bounded Most biomes sorting to the course picker, using persisted biome-discovery records without changing authored order for ties.
- **10.580** Add bounded Best contract streak sorting to the course picker, using persisted contract-streak records without changing authored order for ties.
- **10.579** Add bounded Best run streak sorting to the course picker, using persisted streak records without changing authored order for ties.
- **10.578** Add bounded Most contract wins sorting to the course picker, using persisted contract records without changing authored order for ties.
- **10.577** Add bounded Most discoveries sorting to the course picker, combining persisted destination, biome, and waterway records without changing authored order for ties.
- **10.576** Add bounded Most stunts sorting to the course picker, using persisted stunt-roll records without changing authored order for ties.
- **10.575** Add bounded Best approach sorting to the course picker, using persisted runway-approach records without changing authored order for ties.
- **10.574** Add bounded Best combo sorting to the course picker, using persisted clean-flight combo records without changing authored order for ties.
- **10.573** Add bounded Highest altitude sorting to the course picker, using persisted peak-altitude records without changing authored order for ties.
- **10.572** Add bounded Best landing sorting to the course picker, using persisted landing-quality records without changing authored order for ties.
- **10.571** Add bounded Fuel reserve sorting to the course picker, using persisted fuel records without changing authored order for ties.
- **10.570** Add bounded Top speed sorting to the course picker, using persisted peak-speed records without changing authored order for ties.
- **10.569** Add bounded Longest flight sorting to the course picker, using persisted distance records without changing authored order for ties.
- **10.568** Add a bounded distance, top-speed, altitude, and fuel flight-log line to course cards for quick repeat-run comparison.
- **10.567** Show each course's persisted best sortie style on picker cards so repeat runs have a visible flying identity.
- **10.566** Lazy-load HUD, results, menu, and course-picker surfaces in parallel during boot, cutting the initial entry while preserving startup failure handling.
- **10.565** Move the title and pause course-picker UI into its own cacheable chunk, trimming the initial entry without changing boot behavior.
- **10.564** Add a bounded Mastered course-picker filter for Legend-tier routes so completed progression stays easy to revisit.
- **10.563** Surface bounded contract-win and contract-streak records on course cards so repeat task progression is visible before launch.
- **10.562** Surface each course's persisted mastery tier on picker cards and add a bounded mastery sort so long-term progression is visible before launch.
- **10.561** Show compact Relaxed, Standard, or Technical difficulty tags on course cards so picker sorting has visible context.
- **10.560** Add stable difficulty sorting to the course picker, using authored route profiles without rebuilding terrain or changing catalog order for ties.
- **10.559** Raise the bounded fixed-step catch-up budget so normal 10 FPS frames preserve flight timing without allowing long hitches to spiral.
- **10.558** Add an Unplayed course filter so the expanding catalog can surface untouched routes without changing history or storage limits.
- **10.557** Add bounded Most runs sorting to the course picker, keeping repeat practice routes easy to find while leaving unflown courses at the end.
- **10.556** Add bounded best-time sorting to the course picker, keeping fastest completed runs easy to find without changing authored order or storage limits.
- **10.555** Add Tundra Ops, a frozen-lake snow route with a dedicated cold-weather contract and replay identity.
- **10.554** Add Frostline Ops, a snowbound glacier climb that combines weather, contract, replay, and scoring systems.
- **10.553** Add Rift Ops, a fog-bound canyon strike that combines authored route clearance with the bounded contract, replay, and scoring systems.
- **10.552** Add Volcanic Ops, a storm-locked volcanic climb with the existing bounded contract system.
- **10.551** Throttle static title, pause, and results rendering to 30 Hz while keeping live flight and state transitions immediate.
- **10.550** Cache streamed terrain cell ownership for repeated contact probes with bounded invalidation on LOD replacement.
- **10.549** Keep the title and pause course-picker search synchronized during a session with a bounded, non-persistent query.
- **10.548** Persist and synchronize the course-picker category and sort without expanding flight or storage budgets.
- **10.547** Suspend hidden air-traffic simulation between sorties and refresh its pooled presentation immediately when flight resumes.
- **10.546** Show the next medal threshold in completed-run debriefs for an immediate repeat target.
- **10.545** Add bounded Catalog, Best score, and A–Z sorting to the course picker.
- **10.544** Add bounded personal-best gains and score gaps to completed-run debriefs.
- **10.543** Show the next finite medal target on scored course cards so repeat runs have an explicit progression goal.
- **10.542** Preserve player-defined newest-first ordering in Recent and Favorites course filters.
- **10.541** Show the bounded best score directly on launch and pause course cards so repeat attempts have a clear target.
- **10.540** Show route, weather, and contract context inline on course picker cards.
- **10.539** Surface best-run course stats directly on launch and pause picker cards.
- **10.538** Add a bounded Copy sortie summary action to results for shareable performance recaps.
- **10.537** Surface existing course medals, mastery badges, and precision streak records in the launch picker.
- **10.536** Replace the static launch hint with bounded contextual takeoff, gate, and landing guidance.
- **10.535** Add a safe Reset settings action that restores flight preferences without touching progression or course records.
- **10.534** Add bounded Daily, Weekly, and Monthly Ops streaks that advance once per period and surface in the catalog.
- **10.533** Show finite course counts in every launch-picker category, including Recent and Favorites.
- **10.532** Bound local storage for rotating Ops records while preserving authored-course history and ghosts.
- **10.531** Lazy-load the opt-in debug overlay so normal players do not pay its inspector code in the initial entry bundle.
- **10.530** Harden Monthly Ops against malformed finite timestamps so replay keys and period identities stay valid.
- **10.529** Add deterministic Monthly Ops with UTC-month replay links and isolated period records.
- **10.528** Mark pinned courses directly in the catalog cards so Favorites remain visible in every filter.
- **10.527** Make Favorites keyboard-discoverable with an `F` shortcut and explicit empty-filter states.
- **10.526** Add bounded Favorites storage and a selected-course pin action to both launch pickers.
- **10.525** Persist a bounded Recent course filter across launch sessions so repeat sorties stay one click away.
- **10.524** Add stable Ops, Routes, Contracts, and Explore filters to the course picker as the catalog grows.
- **10.523** Add deterministic Weekly Ops with ISO-week replay links and isolated score, history, contract, and ghost identities.
- **10.522** Keep filtered course-picker keyboard navigation bounded to the visible catalog, so Home/End and grid movement remain usable as the challenge library grows.
- **10.521** Preserve the exact Daily Ops UTC day in the sortie debrief, so results, crash reports, and accessibility labels identify the replayable challenge that was actually flown.
- **10.520** Preserve the Daily Ops UTC day in replay links so copied challenges retain their route family and weather after midnight.
- **10.519** Add a deterministic Daily Ops challenge that rotates route family, seed, and weather at UTC midnight while keeping replay and score records isolated per day.
- **10.518** Cancel stale terrain worker jobs during world clears so reseeds restore near-field streaming immediately instead of waiting behind discarded geometry.
- **10.517** Make replay and custom-seed launch feedback explicit when a requested world falls back and needs another rebuild attempt.
- **10.516** Add Shoreline Run, a deterministic fog-lined coastal challenge using the existing bounded route, scoring, replay, and contract systems.
- **10.515** Reconcile terrain worker retirements across rapid quality changes so recovered graphics settings cannot strand the streaming pool below its target concurrency.
- **10.514** Surface transactional world-reseed fallbacks in the launch banner and keep replay seed input available for another rebuild attempt.
- **10.513** Correct the return-leg glide-slope sign so aircraft above the runway receive a high-glide cue and aircraft below it receive a low-glide cue.
- **10.512** Freeze HUD banner deadlines through pause and results, preserving the intended remaining feedback time without adding render-loop work.
- **10.511** Freeze mission beacon and gate-flash presentation while paused or in results, preventing wall-clock feedback from skipping ahead off-screen.
- **10.510** Rank traffic proximity alerts by bounded 3D separation, preventing high-above contacts from masking closer level traffic while keeping horizontal HUD distances readable.
- **10.509** Surface the existing above/below/level traffic cue in compact radar text and accessibility labels while keeping settlement and gate copy unchanged.
- **10.508** Keep close traffic contacts on radar during the visual silhouette fade, so proximity warnings always have a corresponding navigational cue.
- **10.507** Add a pooled ditching splash and distinct water-impact audio, reusing the existing wake batch so water failures read differently without adding a particle system.
- **10.506** Keep rising-ridge warnings active during shallow climbs, suppressing them only when the projected flight path actually clears the terrain margin.
- **10.505** Add bounded obstacle lookahead to the flight warning path, giving hangars, towers, cities, and villages a distinct early HUD/audio cue before the padded aircraft envelope reaches them.
- **10.504** Add bounded terrain lookahead to the PULL UP warning, catching rising ridges along the flight path before current AGL becomes critical.
- **10.503** Reject deeply penetrated aircraft poses as grounded, keeping streamed-terrain contact recovery from hiding intersections.
- **10.502** Make aircraft grounded-state caches observe streamed terrain and sampler replacement revisions, preventing stale contact decisions after reseeds or LOD surface swaps.
- **10.501** Route radio-altitude reads through the aircraft's fixed-step contact cache, removing duplicate terrain sampling from clearance HUD and landing-state updates.
- **10.500** Reuse the fixed-step contact cache for airborne automatic-gear decisions, removing a duplicate terrain height query without changing the safety envelope.
- **10.499** Expand settlement collision sweeps with the same padded aircraft body envelope used by airfield probes, including rotated buildings, roofs, and vertical clearance.
- **10.498** Reuse the fixed-step ground cache for post-step grounded-state checks, removing a duplicate terrain height query and hardening empty-slot sentinels so the world origin can never read as an uninitialized zero.
- **10.497** Reuse frame-scoped ground probes in the fixed-step flight contact sweep, reducing duplicate terrain height and normal sampling without retaining values across streamed terrain changes.
- **10.496** Reuse one climate record across each regional settlement-road candidate pass, reducing worker-side planning garbage while preserving deterministic terrain-following road selection.
- **10.495** Avoid temporary surface records in vegetation water rejection, keeping near-field prop streaming deterministic while trimming another bounded allocation burst per chunk.
- **10.494** Reuse a caller-owned climate record while building near-field vegetation, removing per-sample climate garbage from streamed LOD promotions without changing deterministic placement or quality budgets.
- **10.493** Route corridor and summary probes now use the scalar resolved surface sampler, retaining water-level correctness while avoiding climate-object work during launch and retry setup.
- **10.492** Reuse exact external-camera ground probes within a frame through a bounded caller-owned cache, reducing duplicate terrain work without allowing streamed sampler changes to leak stale heights.
- **10.491** Validate a bounded wing-width corridor between route gates so generated courses clear terrain across the flight path, not only at the centreline.
- **10.490** Add a persisted reduced-motion setting that quiets camera, weather, radar, sky, and impact animation without changing flight behavior.
- **10.489** Persist the best river, lake, and sea survey per course so exploration progress carries into the picker and debrief.
- **10.488** Track distinct river, lake, and sea discoveries in the live HUD and sortie debrief with one-time discovery cues.
- **10.487** Keep the audio runtime in its own cacheable build chunk, trimming the initial app entry without changing gameplay behavior.
- **10.486** Give stall and unsafe-gear warnings distinct restrained edge cues while preserving the existing warning hysteresis and bounded audio path.
- **10.485** Surface pilot rank, legend mastery, commendations, and the next career goal on the title screen, reusing existing progression records without adding runtime or render-loop work.
- **10.484** Keep the current biome or water body visible as a bounded live HUD region label, reusing the existing terrain survey cadence without extra terrain sampling or scene work.
- **10.483** Give streamed cities and villages deterministic biome-aware names, carrying them through radar locks and discovery banners without adding scene or render-loop work.
- **10.482** Freeze analytic sky drift, twinkle, and aurora motion under reduced-motion preferences, keeping accessibility behavior consistent without extra render work.
- **10.481** Add Aurora Run, a clear midnight course that showcases the low-cost deterministic aurora layer without changing streaming or route budgets.
- **10.480** Add a restrained deterministic aurora layer to clear night skies, reusing the existing dome draw so exploration gains regional atmosphere without extra geometry or render passes.
- **10.479** Fail closed for malformed hydrology catchment and bounds queries, preventing invalid coordinates from creating unbounded region scans.
- **10.478** Keep malformed hydrology coordinates and ground samples finite, preventing invalid catchment keys from poisoning terrain water and shoreline queries.
- **10.477** Give Monsoon Run a dedicated wetland route profile and let swamp provinces select between standard channels and wider monsoon floodways without adding scene budget.
- **10.476** Add Monsoon Run, a deterministic heavy-rain wetland route that reuses the bounded contract catalog for another replayable terrain challenge.
- **10.475** Add a catalog-wide course identity regression so future authored routes cannot share score, history, or ghost records by accident.
- **10.474** Remove avoidable render-loop garbage from settlement cell tracking and terrain worker pressure sampling, preserving streaming behavior while reducing frame-time noise.
- **10.473** Isolate Clean Circuit's score, history, and ghost identity from the Desert Dash key it previously shared.
- **10.472** Ease external camera occlusion recovery after ridges and buildings clear, preventing sampled sightlines from visibly snapping in and out.
- **10.471** Keep analytic sky cloud inputs and dome transforms finite when weather or camera anchors are malformed.
- **10.470** Keep pooled rain and snow particles finite when weather timing, wind, or follow anchors are malformed.
- **10.469** Keep malformed landing and crash impact vectors from writing non-finite scene transforms or pooled particle motion.
- **10.468** Keep malformed landing and crash-effect timing from poisoning pooled particle lifetimes or motion.
- **10.467** Keep malformed world-frame timing and aircraft coordinates from leaking into terrain, settlements, traffic, atmosphere, or runway presentation.
- **10.466** Keep malformed atmosphere deltas and anchor coordinates from poisoning time-of-day, cloud motion, or weather rendering state.
- **10.465** Ignore malformed weather update deltas so `NaN` or infinite frame timing cannot poison seeded front transitions.
- **10.464** Gate distant and Low-quality water detail texture samples behind the existing adaptive detail budget, reducing GPU work without changing water geometry or levels.
- **10.463** Make regional seas more compact, preserving real water levels while reducing ocean-sized interruptions between land provinces.
- **10.462** Give Fjord Run its own deterministic steep-shoulder route profile instead of aliasing the generic coastal line.
- **10.461** Correct the default keyboard yaw mapping to conventional A-left / D-right while preserving the explicit remappable reverse option.
- **10.460** Add a deterministic 30-seed startup regression corpus, protecting the playable-pad fallback search from future terrain changes.
- **10.459** Keep the results-to-title seed loader on the canonical fractional seed instead of truncating random worlds back to a different terrain hash.
- **10.458** Preserve the six decimal places used by the terrain hash in HUD, replay links, clipboard actions, and custom seed input so random worlds can actually be revisited exactly.
- **10.457** Add a one-click results action that sends the active world seed back to the title screen for immediate exact-world exploration.
- **10.456** Fix custom and replay seed launches so the first Play action rebuilds the random world from the pending seed instead of reusing the previous terrain.
- **10.455** Add a dedicated results action for copying the raw world seed, making procedural discoveries easy to load again without parsing a replay URL.
- **10.454** Keep the active procedural seed visible in the results debrief, so completed and crashed random worlds remain identifiable after the live HUD closes.
- **10.453** Keep fractional procedural seeds visible in the HUD by matching the existing finite truncation used by replay links.
- **10.452** Surface the active procedural world seed in the secondary HUD, keeping custom and replay worlds identifiable during flight without adding per-frame allocation.
- **10.451** Clear consumed custom seeds from the launch controls, keeping the visible pending-seed state aligned with the world that the next Play action will actually create.
- **10.450** Add safe custom-seed launch input, letting pilots revisit exact procedural worlds from the title screen while preserving authored course selection and replay-link behavior.
- **10.449** Keep graphics preset changes synchronized with the live adaptive detail budget, preventing a temporary full-cost shader burst when switching quality under load.
- **10.448** Couple adaptive resolution to cloud and precipitation budgets, reducing atmospheric draw and particle pressure alongside terrain, water, and vegetation detail under sustained GPU load.
- **10.447** Couple adaptive resolution to near-field vegetation instance density, shedding draw pressure under sustained GPU load while restoring authored detail without terrain rebuilds.
- **10.446** Add an accessible course-catalog filter to the title and pause pickers, keeping the growing route library searchable and the visible card list bounded.
- **10.445** Couple adaptive pixel resolution to terrain-weather and water shader detail, shedding GPU work under sustained load while preserving geometry, visibility, and flight behavior.
- Dampen storm buffet while landing gear is down, and cue BUFFET on the live weather HUD when the gated drive is meaningful.
- **10.444** Keep Front Chaser weather transitions automatic while locking manual cycling, preserving deterministic contract replay without extra render-loop state.
- **10.443** Add Front Chaser Run with a deterministic rain-to-storm weather transition, exposing the weather-front contract without adding render-loop or scene state.
- **10.442** Add Thermal Control Run, a deterministic clear alpine route that exposes the cool-engine cruise contract without adding scene or render-loop work.
- **10.441** Add Brake Check Run, a deterministic clear sweep that exposes the speed-brake contract without adding scene or render-loop work.
- **10.440** Add Water Run, a deterministic rainy river route that exposes the sustained water-flight contract without adding scene or render-loop work.
- **10.439** Add Level Flight Run, a deterministic clear sweep that exposes the stable-altitude contract without adding scene or render-loop work.
- **10.438** Add Clean Circuit Run, a deterministic clear desert sweep that exposes the no-miss gate contract without adding scene or render-loop work.
- **10.437** Add Deadstick Run, a deterministic clear desert sweep that exposes the fuel-out glide contract without adding scene or render-loop work.
- **10.436** Add G-control Run, a deterministic clear slalom that exposes the bounded high-G handling contract without adding scene or render-loop work.
- **10.435** Add Burn Run, a deterministic clear sweep that exposes the sustained afterburner contract without adding scene or render-loop work.
- **10.434** Add Mach Run, a deterministic clear sweep that exposes the sustained supersonic contract without adding scene or render-loop work.
- **10.433** Add Crosswind Run, a deterministic storm-locked approach that exposes the runway-relative crosswind contract without adding scene or render-loop work.
- **10.432** Add Storm Contract, a deterministic storm route that exposes the bounded precipitation contract without adding scene or render-loop work.
- **10.431** Add Energy Run, a deterministic clear sweep that exposes the bounded efficient-cruise contract without adding scene or render-loop work.
- **10.430** Add Fuel Saver, a deterministic clear sweep that exposes the bounded reserve-fuel landing contract without adding scene or render-loop work.
- **10.429** Add Terrain Hugger, a deterministic clear canyon route that exposes the bounded radio-altitude contract without adding scene or render-loop work.
- **10.428** Add Speed Run, a deterministic clear high-speed sweep that exposes the bounded fast-landing contract without adding scene or render-loop work.
- **10.427** Add Skyline Run, a deterministic clear alpine climb that exposes the bounded high-altitude contract without adding scene or render-loop work.
- **10.426** Add Scout Run, a deterministic clear sweep that exposes the bounded multi-settlement discovery contract without adding scene or render-loop work.
- **10.425** Add Biome Tour, a deterministic clear sweep that exposes the bounded four-biome exploration contract without adding scene or render-loop work.
- **10.424** Add Airshow Run, a deterministic clear slalom that exposes the bounded barrel-roll stunt contract without adding scene or render-loop work.
- **10.423** Add Settlement Tour, a deterministic clear route that exposes the bounded city-and-village tour contract without adding scene or render-loop work.
- **10.422** Add Range Run, a deterministic clear long sweep that exposes the bounded sustained-distance contract without adding scene or render-loop work.
- **10.421** Add Gust Rider, a deterministic storm route that exposes the bounded strong-wind contract without adding scene or render-loop work.
- **10.420** Add Dry Run, a deterministic clear high-speed sweep that exposes the bounded no-afterburner energy contract without adding scene or render-loop work.
- **10.419** Add Butter Landing, a deterministic clear pattern course that exposes the bounded smooth-touchdown contract without adding scene or render-loop work.
- **10.418** Add Precision Chain, a deterministic clear slalom course that exposes the bounded three-gate quality contract without adding scene or render-loop work.
- **10.417** Add Radar Run, a deterministic clear open route that exposes the bounded locked-settlement radar contract without adding scene or render-loop work.
- **10.416** Add Night Flight, a deterministic foggy midnight route that exposes the bounded after-dark contract without adding scene or render-loop work.
- **10.415** Add Combo Run, a deterministic clear slalom course that exposes the bounded gate-and-stunt combo contract without adding scene or render-loop work.
- **10.414** Add Precision Landing, a deterministic clear base-to-final pattern that exposes the centered-touchdown contract without adding scene or render-loop work.
- **10.413** Add Traffic Dodge, a deterministic clear open sweep that exposes the bounded vertical-separation traffic contract without expanding the fixed traffic pool.
- **10.412** Add Ridge Trial, a deterministic clear high-relief low pass that exposes the bounded ridge-altitude contract without adding scene or render-loop work.
- **10.411** Add Water Skim, a deterministic clear coastal low-pass course that exposes the bounded water-skimming contract and existing wake feedback.
- **10.410** Add High Dive, a deterministic clear alpine course that exposes the high-altitude climb-and-recovery contract as a replayable commitment challenge.
- **10.409** Add Thermal Surf, a deterministic clear-sky lift course that exposes the existing sustained-thermal contract as a replayable altitude skill challenge.
- **10.408** Add Waterway Tour, a deterministic rainy river course that exposes the existing multi-waterway contract and makes river, lake, and sea exploration replayable.
- **10.407** Add one-shot partial progress cues for Traffic Watch and Traffic Dodge, making the curated traffic objective readable without repeating duplicate-contact or completion banners.
- **10.406** Add Traffic Run, a deterministic high-speed sweep that opts into the expanded contract catalog and turns pooled traffic contacts into a repeatable objective.
- **10.405** Keep the closest traffic alert visible in a cached HUD row after the transient warning fades, reusing the pooled traffic query with bounded text and no new scene work.
- **10.404** Add one-shot partial progress cues for settlement and waterway tour contracts, suppressing duplicate discoveries and final-completion noise.
- **10.403** Add one-shot worsening return-fuel warnings for tight and low runway-return reserves, reusing the bounded HUD estimate without adding simulation or render-loop allocations.
- **10.402** Add conservative HOME OK/TIGHT/LOW fuel-return guidance for runway returns and engine-out glides, with bounded estimates and no simulation or worker overhead.
- **10.401** Keep a bounded missed-gate counter visible in the live HUD and route-progress accessibility text until reset, so a transient miss banner does not erase route feedback.
- **10.400** Cache persistent route-risk copy across frames and remove array churn from its formatter, keeping slope guidance free of avoidable render-loop allocations.
- **10.399** Keep each route's steepest slope visible in the persistent live risk row after the launch briefing fades, with finite clamping and no render-loop allocations.
- **10.398** Surface the generated route briefing on launch and retry, with bounded wrapping so clearance, turn, slope, and climb guidance is actually readable before takeoff.
- **10.397** Add a cached steepest route-slope callout and include it in difficulty classification so preflight guidance exposes climb/descent pressure without per-frame work.
- **10.396** Preserve bounded gate-miss counts through the run result so route debriefs explain missed crossings without changing clean-flight presentation.
- **10.395** Carry collision failure reasons into the crash results card so actionable diagnoses survive after the live impact banner fades.
- **10.394** Surface finite collision failure labels such as SINK RATE, SLOPE, GEAR UP, and OBSTACLE in crash feedback while reusing the existing contact query and impact snapshot.
- **10.393** Preview authored crosswind side and CRAB correction in the course picker and post-run condition summary, keeping the landing challenge readable before and after flight.
- **10.392** Make bounded world-generation startup failures recoverable from the title screen with a Retry action, while keeping renderer/GPU failures correctly disabled.
- **10.391** Add a cached CRAB L/R return cue derived from runway-relative crosswind, making the landing correction explicit without adding scene or render-loop work.
- **10.390** Add Crosswind Approach, a storm-locked pattern course with a deterministic runway-relative wind side so the landing pressure is repeatable instead of seed luck.
- **10.389** Add Pattern Approach, a clear-weather base-to-final course that turns the existing landing scorer into a short repeatable challenge with a final gate aligned back toward the runway.
- **10.388** Align Thermal Run gates with the same deterministic lift pockets sampled by the flight model, extending the bounded thermal envelope above tall relief so the authored altitude route remains playable without scene or worker growth.
- **10.387** Add a cached accessible LIFT HUD row for active thermal pockets, keeping altitude-route feedback readable after the transient entry banner without adding scene work.
- **10.386** Lock Thermal Run to clear skies so its altitude route consistently exercises the existing lift system instead of inheriting random storm or night conditions.
- **10.385** Add a deterministic Thermal Run course with a repeatable spiral climb that gives the existing lift and altitude systems a dedicated replay route.
- **10.384** Surface the real afterburner lock reason, so fuel-out state is shared by engine warnings, HUD, and the live engine contract instead of being hard-coded as ready.
- **10.383** Gate route-trace visibility by live external flight, keeping cockpit, pause, results, and crash presentation uncluttered.
- **10.382** Add one bounded route-trace draw connecting authored gates, improving external-camera guidance without expanding the scene footprint per route.
- **10.381** Expand the preflight route briefing with minimum clearance, maximum turn, and planned climb envelope callouts.
- **10.380** Make un-authored sorties choose deterministic route families from the generated airfield biome while preserving explicit curated-course profiles.
- **10.379** Add a deterministic Badlands Run course with shelf-to-shelf red-rock navigation and a new replayable route profile.
- **10.378** Stabilize flight-warning transitions with immediate escalation and bounded release hysteresis, and clear the G-load veil whenever pause or results hides live telemetry.
- **10.377** Enable the existing high-G feedback path with hysteretic blackout/redout bands, smooth bounded veil ramps, and one-shot transition callouts while keeping malformed load values safe.
- **10.376** Reuse caller-owned climate and pad snapshots for rendered-surface probes and terrain/settlement worker dispatches, reducing streamed-flight garbage without changing contact or generation results.
- **10.375** Give Low quality a shorter regional-road draw radius, reducing distant connector, bridge, and marking work while preserving settlement silhouettes and destinations.
- **10.374** Make terrain and settlement streaming reuse the last valid focus when malformed coordinates arrive, preventing `NaN` or infinity from poisoning fade, visibility, and queue math.
- **10.373** Make world render-quality application idempotent, avoiding redundant terrain, atmosphere, traffic, and settlement budget writes when a preset is unchanged.
- **10.372** Recheck terrain LOD after a half-cell of movement, promoting and demoting existing tiles before a full stream-cell crossing while preserving bounded streaming work.
- **10.371** Tie settlement secondary-detail visibility to render quality, trimming Low draw distance while preserving landmark silhouettes, buildings, and radar destinations.
- **10.370** Prefer the finest overlapping terrain tile during LOD transitions, keeping contact queries on the new surface while old coarse coverage fades out.
- **10.369** Make rendered/contact sampling span-aware for coarse terrain tiles, so far LOD surfaces resolve the correct cell and height instead of falling back or compressing a multi-cell tile into one cell.
- **10.368** Give terrain attachment a quality-aware main-thread budget, reducing Low upload bursts while preserving bounded worker streaming and allowing High to catch up faster.
- **10.367** Route render-quality changes through one world-owned update path, removing duplicate traffic, atmosphere, vegetation, and shader-budget writes during preset switches.
- **10.366** Align the external camera far plane with the active terrain quality envelope, reducing Low frustum and depth work while preserving the full High-quality horizon.
- **10.365** Make `World` apply the complete Low/Balanced/High quality envelope during construction as well as live switches, keeping terrain, atmosphere, vegetation, traffic, and shader budgets consistent for direct runtime use.
- **10.364** Add quality-aware terrain weather shading so Low skips moving cloud-shadow and wind-exposure detail while preserving biome color, elevation shading, and streamed geometry.
- **10.363** Add quality-aware water shading so Low reduces high-frequency foam, flow, and ripple work through a shared live uniform while preserving water levels and broad surface color.
- **10.362** Add the deterministic Archipelago Run course, a foggy island-hop route that expands water-focused replay content without changing bounded terrain or traffic budgets.
- **10.361** Make Low render quality trim secondary settlement lights, waterfront props, and road markings while preserving buildings, roads, and landmarks; apply the budget live when quality changes.
- **10.360** Add a read-only GitHub Actions gate for release metadata, TypeScript, the full test suite, and the production build on pushes and pull requests.
- **10.359** Harden version validation so the internal roadmap chunk stays synchronized across runtime metadata, the README, and the changelog.
- Keep terrain quality changes under the device's hardware worker cap, so switching to High on a small-core machine cannot create an unsafe six-worker burst.
- Add the curated Swamp Run course, a deterministic rainy low-level weave through wetlands and winding channels while reusing terrain-aware clearance, scoring, and retry systems.
- Make terrain worker concurrency follow the active Low/Balanced/High preset, retiring busy workers only after their current job completes so quality changes reduce CPU pressure without dropping streamed terrain results.
- Add the curated Tundra Run course, a deterministic low-level snow route over frozen lakes and rolling ground while reusing terrain-aware clearance, scoring, and retry systems.
- Add the curated Savanna Run course, a deterministic low-level sweep across open grassland and acacia terrain while reusing terrain-aware clearance, scoring, and retry systems.
- Expand swept airfield collision queries by a bounded aircraft envelope so wings, nose, and tail cannot clip hangars, towers, or shacks, while camera occlusion continues to use the authored building edges.
- Add the curated Saltflat Run course, a deterministic long high-speed route that gives the salt-flat biome a distinct replayable challenge without expanding runtime budgets.
- Add the curated Mesa Run course, a deterministic wide tableland route that showcases red-rock shelves while reusing terrain-aware clearance, scoring, and retry systems.
- Reuse a caller-owned airfield pad snapshot during collision probes, removing a per-check allocation from endpoint and swept obstacle tests without changing the collision envelope.
- Add persisted boost, speed-brake, and landing-gear keyboard bindings with duplicate-safe repair, browser-key suppression, and live controls labels while leaving axis preferences and gamepad/touch input unchanged.
- Replace per-probe settlement obstacle bucket strings, callbacks, and yaw trig with cached numeric spatial columns and indexed building extents, keeping high-speed collision sweeps allocation-light without changing collision envelopes.
- Reuse a caller-owned climate record for settlement waterfront and bridge-pier probes, removing repeated biome-weight allocations during landmark attachment without changing dock or road geometry.
- Reuse a tiny bounded set of caller-owned climate records across settlement candidate, survey, road, and lot probes, removing repeated biome-weight allocations from landmark planning without changing deterministic placement.
- Add the deterministic Rainforest Run course, a low winding route with forced rain that gives humid lowland terrain its own repeatable challenge while reusing the bounded route, clearance, scoring, and retry systems.
- Route fallback collision sampling through caller-owned scalar land/water records, avoiding climate-object allocation while preserving resolved water levels and airfield grading.
- Make optional GLB hydration dispose a still-owned loaded subtree when normalization or replacement fails, preventing rejected external aircraft assets from leaking GPU resources.
- Add the deterministic Glacier Run course, a snowbound alpine pass with an altitude challenge and forced snow conditions that reuse the bounded route, clearance, scoring, and retry systems.
- Add a scalar hydrology-aware terrain surface probe for fallback contact and AGL queries, preserving water levels and airfield grading while avoiding per-query climate-object allocations.
- Add the deterministic Timberline Run course, a fast rolling forest-and-hills route that reuses the validated terrain-clearance and scored retry path without expanding runtime budgets.
- Reuse bounded caller-owned climate buffers while building terrain tiles, removing nested per-vertex geography allocations and reducing garbage-collection pressure during streamed terrain rebuilds without changing deterministic height, biome, or water output.
- Harden the pooled sonic-boom effect against late quality, reduced-motion, and reset callbacks, and detach its root during disposal.
- Make snow-field teardown idempotent and detach the pooled particle root, so late weather updates cannot write into disposed precipitation buffers.
- Make traffic teardown idempotent and detach its pooled scene root, so world resets and late stream callbacks cannot update or reuse disposed traffic resources.
- Split the large course/career modules into a cacheable application chunk, reducing the initial entry bundle without changing runtime behavior or adding per-frame work.
- Keep shared settlement geometry alive during streamed unloads, preventing an anchor beacon or instanced prop family from invalidating landmarks that remain visible after settlement churn.
- Preserve shared vegetation materials during streamed chunk teardown, preventing one retiring tile from disposing foliage shaders still used by visible neighboring tiles.
- Reuse shared opaque terrain and water materials after streamed tiles finish fading, rehydrating private fade materials only for transitions and retirement to reduce resident GPU state without changing terrain geometry or stream budgets.
- Clear keyboard, gamepad, and touch state whenever the runtime leaves live flight, preventing held controls from leaking through pause, results, focus loss, or title transitions into the next sortie.
- Harden touch flight controls with per-button pointer capture and lost-capture cleanup, keeping multi-touch steering, throttle, and boost responsive without adding render-loop work.
- Add the curated Fjord Run course, a deterministic foggy coastal route that reuses the validated coast profile and existing weather/contract preview path without adding unbounded scene work.
- Sweep bounded aircraft motion segments against loaded obstacles, preventing high-speed passes from tunneling through airfield buildings or streamed settlements while keeping endpoint checks and the existing obstacle budget intact.
- Throttle protected settlement-anchor retries behind stream, budget, and movement changes, avoiding repeated plan rebuilds and queue filtering every render frame while keeping guaranteed city and village recovery responsive.
- Preview each seeded sortie contract and its bounded instruction in the course picker, making the repeat objective clear before launch without adding render-loop work.
- Add the curated Alpine Pass course, a deterministic high-altitude mountain route that also joins random profile rotation without adding scene systems or unbounded route work.
- Carry authored weather and night conditions into the results and crash debrief, keeping Storm Run and Night Ops context readable after the route ends without adding runtime or storage work.
- Show the human course name on results and crash debriefs instead of the internal seed/profile storage key, keeping authored retries readable without changing saved-score identity.
- Freeze authored Storm Run fronts and Night Ops midnight timing for the whole attempt, preventing long flights from drifting into a different challenge while random worlds retain their normal day/night and weather progression.
- Keep authored Storm Run and Night Ops weather deterministic by blocking manual weather cycling for those courses while leaving random worlds dynamic.
- Surface authored course conditions in the launch picker, including forced weather and night timing, and include that context in accessible course names.
- Add the curated Night Ops course: a deterministic low-level fog route with an authored midnight sky, replay-safe weather/time overrides, and precision gates.
- Add the curated Storm Run course: a deterministic low-visibility thunderstorm route with forced weather, crosswind zigzags, and replay-safe seed/profile identity.
- Release held touch flight actions immediately when the window blurs or the tab becomes hidden, preventing latched throttle, boost, or steering after focus changes.
- Add a persisted Minimal HUD toggle that keeps the compact cockpit default while allowing pilots to reveal or hide optional telemetry without changing flight-critical cues.
- Add the curated Desert Dash course: a deterministic, long low-level route across dry basins, included in random profile rotation with terrain-aware clearance checks.
- Add persisted Engine, Environment, and Effects audio mix sliders beside the master volume, reusing the existing Web Audio branches without adding nodes or per-frame graph work.
- Add persisted Subtle/Standard/Wide speed-framing levels for external chase and orbit cameras, scaling only high-speed pullback, FOV, and look lead.
- Add a persisted Camera Effects toggle that disables shake, boost sway, storm buffet, and external banking while retaining normal zoom, FOV, and camera controls.
- Add a persisted external-camera auto-return toggle so pilots can keep a hand-positioned chase or orbit view instead of easing back after idle.
- Add a persisted Low/Normal/High external camera look setting for middle-mouse panning, with finite-safe bounds and no cockpit or render-loop overhead.
- Include the volcanic route in random profile selection so ordinary sorties can discover its high-altitude spiral without selecting the curated course.
- Add the curated Volcanic Run course: a deterministic terrain-aware spiral climb with a distinct altitude challenge and a reusable seed for repeatable practice.
- Make the Low graphics preset stream a smaller terrain envelope and move its fog edge with the stream, reducing worker and geometry pressure while Balanced and High retain the full horizon.
- Add opt-in debug performance telemetry for render CPU time, draw calls, triangles, and terrain stream pressure so future optimization work is evidence-led without adding release-frame overhead.
- Replace legacy self-mutating ship workflows with read-only GitHub Actions CI that runs the regression suite and production build on pushes and pull requests.
- Normalize optional aircraft GLBs to the documented +Z/+Y metre contract and preserve the 1.4 m gear-contact anchor instead of lifting imported meshes to local Y=0.
- Route the analytic sky through Three's tone-mapping and output-color chunks so the dome matches world exposure and color management.
- Add a bounded night-weather exposure assist for rain, snow, and cloud cover so storm terrain remains readable without washing out clear nights or daytime.
- Add restrained one-shot radar lock and lock-loss chirps beside the existing target banners, reusing the pooled event path without adding audio nodes or per-frame work.
- Fade high-frequency water foam, riffle, and flow detail before the fog edge, and bias the independent surface forward to suppress distant shimmer and shoreline speckle without changing water levels or adding geometry.
- Pull the protected village and city anchor bands closer to the airfield so settlements are discoverable through the existing radar before crossing a full stream cell, without changing organic rarity or the city clearance budget.
- Add a restrained two-pulse traffic proximity cue to the existing rate-limited HUD alert, improving cockpit awareness without changing the pooled audio graph.
- Feed the existing bounded gust telemetry into the pooled wind bed, keeping storm ambience responsive without adding audio nodes or render work.
- Add a subtle first-person cloud mist to the existing canopy veil, reusing one DOM layer with bounded opacity and no new scene or render work.
- Make world reseeding recover the previous streamed terrain, settlements, weather, and mission when replacement fails after the live scene has been cleared.
- Centralize the afterburner throttle gate so fuel burn and resolved engine output cannot disagree at malformed or boundary throttle values.
- Gently muffle the existing wind, precipitation, and high-frequency engine bed inside clouds using bounded AudioParam targets, with no new audio nodes or render work.
- Add smoothed cloud-edge, entry, and break cues so visibility changes are readable without per-frame HUD churn or extra scene work.
- Buffet the camera and airframe through meaningful rain, snow, or strong gusts using existing weather telemetry, with no new meshes, particles, or draws.
- Quiet that storm buffet under reduced-motion preferences and on pause, title, and results; keep Low graphics cheaper, and let cockpit read it a touch harder than chase.
- Lock precip and gust thresholds with focused unit tests so the gating math stays honest.

- Open the stick throws and dump the boards so chase cam reads mil-turn authority and B-held brake.
- Retune wingtip vapor for mil-cruise turns: quiet in straight flight, readable when the jet is pulling.
- Bleed mil cruise faster with the speed brake while keeping final approach flyable.
- Light the VSI during the FLARE cue so the last sink window is obvious on the HUD.
- Overhaul the procedural F-35 with a refined continuous fuselage, teardrop gold canopy, external cockpit detail, deep intakes, separate rudders, and restrained skin seams; batch static trim while preserving animated gear, nozzle, lights, and control surfaces.
- Give instanced clouds soft optical edges, shaded undersides, sunlit rims, full-size opacity fades, and gradual visibility loss inside formations. Graphics budgets now reduce puff counts without cutting sphere geometry.
- Replace aircraft-locked rain sprites with pooled wind-driven world-space streaks. Fade rain, snow, haze, and overhead cloud cover above their source decks, and darken the distant cloud layer at night.

- Raise military cruise and throttle response, and leave the cockpit as a clear view with no canopy frame or instruments.
- Remove blackout, redout, engine heat, and the afterburner lock, and stop the center-screen callouts.
- Keep a guaranteed city off the airfield so its footprint does not cover the runway.

## v0.11.0 - 2026-09-20

### Ship

- Establish a single v0.11.0 release identity across package metadata, runtime title UI, and build validation while keeping roadmap chunks internal.
- Add a deterministic STORM RUN contract that rewards bounded airborne time in meaningful rain or snow without adding scene work.
- Add a compact six-marker radar scope with bounded contact projection and distinct gate, settlement, and traffic colors while preserving the accessible text readout.
- Add signed traffic altitude separation to the pooled radar path, giving proximity alerts and markers bounded `ABOVE`, `BELOW`, and `LEVEL` cues without collision simulation.
- Add a pooled reduced-motion-safe supersonic shockwave ring to the existing Mach-crossing cue without per-crossing scene allocations.
- Add a deterministic `TRAFFIC WATCH` contract for three distinct nearby traffic passes, reusing pooled proximity identities without collision simulation or fixed-step growth.
- Add one pooled instanced contrail batch behind distant traffic, disabled on Low and capped by the existing quality preset.
- Add one pooled three-strip water wake for airborne low passes over rendered water, reusing existing telemetry without particle growth.
- Upload the pooled water-wake instance transforms during setup so the first visible skim frame is reliable.
- Add a fixed pooled external airflow-streak batch that scales with airspeed and afterburner, with Low, cockpit, and reduced-motion gates that avoid scene growth.
- Add fixed pooled anti-collision beacons to distant traffic, with deterministic blinking and Low-quality suppression inside the existing six-jet budget.
- Add one pooled external Mach-cone silhouette above the supersonic threshold, with Low, cockpit, ground, and reduced-motion gates that avoid scene growth.
- Add one pooled three-strip ground wake for fast airborne land passes, reusing cached clearance and water classification without particle growth.
- Add a deterministic `TRAFFIC DODGE` contract for three distinct traffic passes with at least 120 m of vertical separation, reusing fixed alert identity storage without scene growth.
- Make the pooled ground wake weather-aware, shifting its shared material between clear, rain, and snow tints without rebuilding geometry or adding particles.
- Make the pooled water wake weather-aware, shifting its shared foam material across clear, rain, and snow fronts without rebuilding geometry or adding particles.
- Add sparse deterministic thermal pockets with a capped airborne updraft impulse, daylight and precipitation damping, and one-shot entry feedback without scene growth.
- Add a deterministic `THERMAL SURF` contract that rewards ten seconds inside bounded updraft pockets through the existing fixed-step task path without adding scene or storage state.
- Validate generated mission corridors with adaptive terrain probes so straight legs stay above the route clearance target between gates without adding runtime scene work.
- Add a deterministic PRECISION APPROACH contract that rewards a centered, aligned touchdown through existing finite-safe landing telemetry.
- Share one finite-safe heading fallback across the HUD, return guidance, and chase camera so near-vertical aerobatics do not flip navigation by 180 degrees.
- Stop external camera framing before loaded settlement and airfield colliders, using the existing bounded occlusion probes without adding render-loop allocations.
- Add a persisted keyboard yaw direction preference with safe storage repair while leaving gamepad and touch controls unchanged.
- Add a bounded best-run ghost path for repeatable courses, using fixed buffers and one local-storage write only when a sortie sets a new best.
- Enable strict nullability and unchecked-index checking in the production TypeScript build, fixing the hydrology flow accumulation boundary.
- Add the repeatable Coastal Run course, a lower sweeping route that reuses the validated terrain corridor planner.
- Add a cached GHOST pace row that compares live external runs with the saved best trace without adding simulation or storage work.
- Add a persisted keyboard roll direction preference while leaving gamepad and touch roll conventions unchanged.
- Add a persisted keyboard pitch direction preference while leaving gamepad and touch pitch conventions unchanged.
- Harden release validation across package metadata, the lockfile, runtime title fallback, README, and the first changelog heading so version drift fails the build.
- Add a deterministic WATER RUN contract that rewards bounded airborne time over the rendered river, lake, or sea surface without adding terrain queries or scene work.
- Add a wide, horizon-stable ORBIT camera mode to the existing C cycle, preserving the last external framing when returning from cockpit view.
- Add a deterministic BRAKE CHECK contract that rewards bounded high-speed speed-brake use without adding scene work or unbounded state.
- Add a deterministic THERMAL CONTROL contract that rewards bounded cool-engine cruise time without changing the flight model or adding scene work.
- Harden persisted gate split traces with a small size cap and monotonic finite validation so malformed local records cannot distort pace guidance or grow memory use.
- Synchronize the runtime roadmap pointer with the internal playbook so stale or malformed chunk IDs fail the version check before release.
- Keep workerless terrain streaming responsive by reducing only far fog-hidden fallback meshes while preserving full near-field and worker-backed detail.
- Add a bounded gear-down FLARE cue for the final landing window, making sink-rate timing readable without scene growth or new audio nodes.
- Add a bounded GO AROUND cue for unstable low approaches, preserving predictive terrain-closure priority and the existing audio budget.
- Add a deterministic CROSSWIND contract that rewards bounded airborne time through meaningful runway-relative wind without adding scene work.
- Add a deterministic G CONTROL contract that rewards bounded high-speed flight inside the existing smoothed load envelope without changing physics.
- Add a deterministic DEADSTICK contract that requires airborne fuel exhaustion before the scored landing, reusing existing glide guidance.
- Add the curated RIVER RUN course with a low meandering route through inland water country while preserving fixed gates and adaptive clearance checks.
- Add a deterministic FRONT CHASER contract that rewards bounded airborne time during an existing weather transition without adding scene work.
- Keep radar focused on the best bounded contact set by tier and distance, preventing streamed settlement order from hiding nearby targets.
- Reuse caller-owned scalar hydrology storage during geography sampling, removing one temporary object per terrain vertex without changing water or biome output.
- Add a deterministic BURN RUN contract that rewards bounded high-speed airborne afterburner time through existing engine-state telemetry without adding scene work.
- Reuse caller-owned scalar landform storage during geography sampling, removing another temporary object per terrain vertex without changing terrain output.
- Reuse the volcanic landmark scratch record during landform sampling, removing another terrain hot-path allocation while preserving deterministic cone and caldera relief.
- Share the identical summit FBM evaluation between uplift signals, reducing terrain CPU work without changing generated heights or biome transitions.
- Keep the active contract instruction visible in a bounded TASK detail line with matching accessible text, so objectives remain readable after launch feedback fades.
- Add a deterministic MACH RUN contract that rewards bounded airborne time above Mach 1 through existing speed telemetry without adding scene work.
- Add a deterministic CLEAN CIRCUIT contract with explicit permanent miss failure in the live HUD and results while leaving the sortie recoverable.
- Guard zero-gate sorties from receiving the gate-only CLEAN CIRCUIT contract, preventing impossible Free flight tasks without changing contract rotation elsewhere.
- Arm the existing contract-completion cue when a CLEAN CIRCUIT clears its final gate, while keeping missed circuits permanently failed and silent on success.
- Add a deterministic LEVEL FLIGHT contract that rewards a bounded, stable altitude hold through scalar telemetry only, with no scene growth.
- Add a one-shot CLEAN CIRCUIT failure cue through the existing warning and banner path, keeping missed sorties recoverable without adding scene resources.
- Add a deterministic SETTLEMENT TOUR contract that requires one city and one village arrival through existing radar destinations, with two bounded flags and no scene growth.
- Make TERRAIN HUGGER use the already-cached rendered radio altitude, so low-pass progress follows ridges and valleys without adding terrain queries or allocations.
- Keep SETTLEMENT TOUR's two destination tiers visible as cached OPEN or OK status in the TASK row and results without per-frame string work.
- Add a deterministic COMBO RUN contract that rewards building a three-link gate-and-stunt chain through existing combo telemetry without adding scene state.
- Keep COMBO RUN's current chain milestone in the cached TASK detail, updating only on combo events instead of allocating strings every frame.
- Add a deterministic PRECISION CHAIN contract that turns the existing high-quality gate streak into a three-clear objective with recoverable resets and no scene growth.
- Add a deterministic NIGHT FLIGHT contract that rewards a bounded airborne stretch through the existing dusk and night envelope without adding scene work.
- Persist a bounded per-course contract streak so consecutive bonus-contract clears create a replay target without adding render-loop or scene state.
- Keep the current contract chain visible in a cached HUD row, with a bounded accessible label and no render-loop storage work.
- Add a capped contract-chain score payout on top of the normal contract reward, keeping the first clear unchanged and making repeat mastery matter.
- Mark active weather-front blending as SHIFT in the cached weather readout, with an accessible front-shifting label and no scene or audio work.
- Include the existing terrain-validated COASTAL and RIVER route profiles in random sortie rotation, adding variety without new scene geometry or draw calls.
- Keep the active route profile name in the bounded live mission row, making newly randomized coastal and river lines readable after briefing banners fade.
- Double terrain streaming radius from 16.8 km to 33.6 km with larger outer tiles and bounded far-water detail.
- Generate terrain and water geometry in background workers, transfer mesh buffers without copying, and prioritize nearby chunks with bounded render-thread uploads.
- Fade new chunks in over 650 ms and retain old terrain through detail transitions.
- Add a fixed-seed terrain loading and maximum-speed flight benchmark, plus worker lifecycle and streaming regressions.

## 2026-09-18

### Ship

- Add arcade high-G vision feedback from the existing pilot load scalar: a dark tunnel vignette on hard positive G, a restrained red wash on strong negative G, hysteretic BLACKOUT / REDOUT banners, and no new scene work.

## 2026-09-16

### Ship

- Replace the stuffed native world dropdown with a two-column card picker, keeping course names short and moving mastery stats onto the selected world.
- Invert A/D yaw so A yaws right and D yaws left, matching the live flight stick instead of the previous left/right convention.
- Add a capped Night Ops landing bonus that rewards clean dusk and night touchdowns from the shared atmosphere daylight envelope, shown as NIGHT on the results card.

## 2026-09-12

### Ship

- Make optional aircraft GLB hydration cancellation-safe with request tokens and an owned dispose path, preventing late assets from mutating a torn-down runtime.
- Keep final external camera effects above terrain clearance so touchdown shake and afterburner sway cannot clip the lens through ridges.
- Strengthen the existing cool F-35 panel fill at dusk and night so the aircraft remains readable without extra lights, meshes, or draw calls.
- Coalesce external chase heading extraction and yaw-quaternion setup so camera framing avoids duplicate orientation math each frame.
- Add a cached amber/red airspeed redline cue with accessible overspeed text, keeping the HUD honest when the jet passes its displayed 3000-knot envelope.
- Add an `OVERSPEED` caution once the jet leaves the dry airspeed envelope, sharing the HUD's accessible warning and one-shot cue.
- Drive aircraft beacon, nav-light, and exhaust animation from the shared RAF timestamp with a deterministic fallback, removing per-step wall-clock work.
- Advance chase-camera auto-return from rendered delta time, removing its per-frame wall-clock read while keeping paused framing frozen.
- Drive mission gate pulses and pass flashes from the shared RAF timestamp, removing their per-frame wall-clock reads while preserving route feedback.
- Add a view-aware flight mix that muffles wind, precipitation, and turbine whine in cockpit view while retaining engine presence without new audio nodes.
- Give the existing overspeed caution a distinct soft descending cue so it does not sound like stall or terrain warnings.
- Add a restrained afterburner release cue so boost input has clear on and off feedback without adding persistent audio nodes.
- Coalesce mission navigation bearings by reusing aircraft-relative data in cockpit view and avoiding an external camera matrix refresh.
- Mutate the cached windsock weather state in place so smooth wind fronts do not clone a replacement record every frame.
- Reset world weather-effect caching during reseed so a matching profile still reapplies wet, snow, wind, and settlement lighting to fresh streamed content.
- Share the main RAF timestamp with HUD gear-transition cues so timing remains deterministic without a redundant wall-clock read.
- Replace per-flake snow sine and cosine evaluation with a shared periodic sway table, preserving storm motion while lowering CPU work at the full precipitation budget.
- Coalesce unchanged runway windsock and PAPI poses while invalidating on runway rotation, keeping weather and approach cues responsive without repeated transform math.
- Cache runway windsock nodes after their first weather update, preserving downwind animation while removing repeated scene-tree searches from the world tick.
- Preserve the last camera pose on frozen title, pause, and results frames so external ground-occlusion probes are not repeated while no visual time elapses.
- Avoid redundant rich terrain surface queries during clearly airborne collision checks and stop collision plus aircraft visual work once a crash is latched.
- Skip pooled crash and landing-particle simulation when the frame delta is frozen or invalid, preventing paused effects from consuming CPU or sampling terrain.
- End the pooled crash effect as soon as its particles expire and the readable flash envelope is complete, avoiding empty-tail terrain queries.
- Throttle the directional shadow map to a bounded 20 Hz cadence, forcing immediate refreshes after quality or WebGL context changes while keeping Low shadow-free.
- Gate detailed aircraft contact sweeps behind conservative previous, midpoint, and current terrain clearances so high-altitude flight avoids unnecessary height queries while near-ground contact remains unchanged.
- Make multisample antialiasing quality-aware at renderer creation so Low avoids the extra GPU cost while Balanced and High retain the sharper path.
- Harden fixed-step timing against malformed or backwards animation timestamps so one bad browser frame cannot poison simulation interpolation or the FPS estimate.
- Reduce pooled crash VFX terrain queries to one shared impact-point sample per update, preserving the fixed particle burst while trimming crash-time CPU work.
- Couple PAPI emissive intensity to the shared daylight envelope so approach cues stay restrained by day and readable at night without extra lights or geometry.
- Make the procedural F-35's existing nozzle petals flex with engine power and afterburner through a bounded, cached response without adding geometry or draw calls.
- Freeze static runway and airfield mesh matrices after construction while preserving parent reseed transforms and animated windsock fabric, trimming render-loop CPU work without new draws.
- Limit gamepad polling to a responsive 30 Hz live-flight budget, skip it on title and pause screens, and clear stale controller state on blur or teardown.
- Add semantic altitude, vertical-speed, and airspeed meters plus cached polite/urgent HUD announcements so live telemetry remains accessible without extra per-frame DOM churn.
- Drive the runway PAPI from the aircraft's runway-local glide angle, with cached four-lens material updates and a neutral pattern outside the approach corridor.
- Drive the runway windsock from resolved weather wind direction and strength in runway-local space, with cached updates and no new draw calls.
- Add deadbanded climb and sink colors to the signed vertical-speed HUD readout, improving landing readability without extra scene work or DOM churn.
- Let the optional GLB aircraft replacement hydrate after the playable runtime is ready, so a missing or slow model request cannot block the title screen or first flight.
- Replace per-streak rain sine evaluation with pooled sway values, preserving wind and storm drift while reducing heavy-weather CPU work.
- Drive the existing F-35 nose gear from runway yaw input, smoothly recenter it in the air, and reset it between flights for clearer takeoff and rollout feedback.
- Code-split the optional GLB aircraft loader from the initial bundle, preserving the procedural F-35 fallback while reducing startup payload and keeping replacement teardown intact.
- Add a responsive flight HUD frame for narrow and short browser windows, separating compact instrument groups and wrapping banners while preserving the desktop presentation.
- Stage streamed settlements out of the title hero, preserving their generated cache while keeping the runway and aircraft readable and restoring the layer on flight start.
- Compact expired landing dust and smoke with swap-pop removal, eliminating per-frame array shifts while preserving the fixed pooled touchdown effect.
- Route loaded-tile contact checks through one caller-owned height and land/water record, removing rich surface allocations from collision sweeps while retaining the metadata fallback.
- Make chase-camera ground occlusion distance-aware, trimming redundant close-rig terrain probes while preserving full sampling on long sightlines.
- Hide zero-count vegetation batches under reduced graphics presets, preserving authored matrices for instant restoration and removing empty renderer submissions.
- Split visible mesh height queries from richer contact metadata so camera, AGL, collision-clearance, and landing-effect hot paths avoid redundant climate sampling.
- Scale near-field instanced vegetation with the graphics presets, preserving authored batch counts so quality changes remain reversible without rebuilding terrain.
- Reuse swept-contact results in the flight model so high-speed collision probes avoid per-sample object allocation while preserving the existing crash and landing envelope.
- Keep dark airframe panels readable at night with a bounded cool emissive fill that fades out in daylight without adding lights, meshes, or draw calls.
- Scale instanced cloud draw ranges with graphics quality and skip hidden cloud simulation work on reduced budgets, keeping Low atmospheric performance predictable while High stays unchanged.
- Add a pooled fighter-style heading tape with cardinal marks and a centered caret, driven by cached heading telemetry without new scene geometry or draw calls.
- Give existing flight banners distinct info, success, and danger treatments so normal feedback no longer reads like a crash alert.
- Tie pooled rain and snow simulation plus draw ranges to the Low, Balanced, and High graphics presets so weather costs match the selected budget.
- Compact expired pooled crash particles during the effect tail, reducing needless simulation checks while preserving deterministic visuals.
- Gate render submissions during WebGL context loss and announce recovery so browser GPU resets do not hammer a dead renderer.
- Announce `COCKPIT VIEW` or `EXTERNAL VIEW` when `C` toggles the camera, making view changes readable at speed.
- Add a cockpit velocity-vector marker projected from the aircraft's real motion, keeping slips and climbs readable without changing physics or render budgets.
- Restore the cockpit canopy rails, brow, and coaming in first-person rendering by placing the camera in the scene graph and removing it safely during teardown.
- Keep the takeoff brief on the title screen and announce `AIRFIELD READY · PRESS PLAY OR ENTER` when world setup finishes.
- Show a short click-to-reenter cue when fullscreen drops unexpectedly during active flight, while keeping intentional menu exits quiet.
- Show gate, time, and landing score contributions on the completion card so every run explains its total without changing scoring rules.
- Harden the completion results dialog with semantic labeling, a contained Tab loop, focus restoration on retry, and teardown-safe listener cleanup.
- Add a short takeoff briefing banner on Play, Retry, New World, and `R`, making the first action readable without changing the flight model.
- Pause active flight on window blur as well as tab hide, using the same guarded path and requiring an explicit resume after focus returns.
- Contain Tab navigation inside the active pause or settings panel and release the focus trap during runtime teardown.
- Improve menu keyboard flow with modal semantics, heading focus on subpages, and focus restoration after closing pause or settings.
- Route menu, results, and preference controls through one idempotent listener bag so runtime teardown removes every UI callback before a remount.
- Release graphics and audio preference listeners during runtime teardown so remounted scenes cannot mutate disposed renderer or audio state.
- Honor the browser's reduced-motion preference in camera shake, touchdown impulse, and afterburner sway, including live preference changes.
- Add a restrained cockpit canopy frame and dashboard coaming to first-person view, with no external-camera draw cost and explicit teardown.
- Add Low, Balanced, and High graphics presets to the pause menu. Low disables shadow-map work and caps adaptive pixel density, while higher presets retain progressively larger budgets. The selected preset persists locally and can be changed without restarting the flight.
- Add a persistent audio-volume slider with smooth master automation, keeping the existing mute toggle and event cues intact.

## 2026-09-11

### Juice

- Add pooled landing scrub dust and tire smoke on touchdown and high-speed rollout, reusing fixed meshes so retries do not allocate new GPU resources.
- Add a cockpit-only high-speed canopy fog/vignette that scales with IAS and stays quiet under reduced-motion preferences.
- Soften the live gate and HUD nav cue when the jet is near the active checkpoint, keeping the stronger pass flash for the actual crossing.

## 2026-09-07

### Settlements

- Add rare 17-21 km procedural cities with 650-1,600 buildings and irregular villages in varied sizes.
- Make city and village terrain-review destinations search outward from their anchor cell so generator tuning cannot leave the review page blank.
- Make the regional-road review search for a valid connectable settlement pair and frame the route at a useful flight-scale height.
- Replace repeated grids with asymmetric districts, bent approaches, branches, dead ends and terrain-following roads.
- Mix blocks, slabs, pitched hangars, octagonal towers and stepped skyscrapers.
- Rebalance city silhouettes so towers no longer dominate: stepped cores are rarer, hangars and slabs fill districts, and non-tower buildings regain pitched roof variation.
- Render flat-roof hangars with shared gabled canopies so industrial halls have a distinct silhouette without extra per-building meshes.
- Fit dry, gentle lots to existing terrain, with biome-specific architecture and oversized buildings for flight-camera readability.
- Stream instanced buildings and roofs, precompute terrain suitability in a worker, and include building collision.
- Connect selected nearby settlements with off-thread regional routes, gentle approaches and readable center markings.
- Add batched pale edge strips to regional connectors so long links retain a readable road silhouette through haze.
- Mark wet route spans as bridge decks and render them with a separate concrete-toned material, keeping river crossings visually distinct.
- Feed blended rain and snow intensity into settlement streets and bridge decks so the road network shares the same weather response as terrain.
- Feed the same values into settlement facades and roofs, with wet walls and snow-catching horizontal roof surfaces.
- Share the atmosphere daylight factor with instanced facade windows so settlements gain subdued daytime glazing and warm night lights without extra meshes.
- Add batched local street centerlines so district roads remain legible from the chase camera without per-segment draw calls.
- Add settlement destinations and a chase-camera scale check to the terrain review.
- Rework settlement morphology so villages use rare hamlet, ribbon, crossroads and basin profiles with varied radii, loops and oversized landmark buildings; cities remain rare, broad and dense.
- Rebalance city districts so towers and stepped forms stay rare landmarks while slabs, halls, blocks, and biome-specific facade palettes carry the wider skyline.

### Terrain

- Add broad ridge chains, foothill belts, long alpine valley cuts, dry plateau shelves, and rare deterministic volcanic calderas.
- Keep green and wet provinces smoothly rolling while reserving harder erosion profiles for dry and alpine regions.
- Retune mountain and snow palettes so high relief keeps readable rock and cool shadow detail instead of clipping to white.
- Expand settlement site search to preserve rare giant cities as terrain relief becomes more expressive, and allow villages in wider hill provinces.

### Water

- Replace the repeated three-spoke lake layout with one to three independently placed basins per catchment.
- Make seas occasional, smaller landmarks with broader irregular shore distortion rather than default oversized oceans.
- Improve water shading with clear teal shallows, deep blue centers, foam-tinted edges, and moving specular glints.
- Preserve fixed water levels and independent terrain/water meshes while keeping river width and route continuity deterministic.
- Add higher-elevation tributaries that join trunks from dry ground, creating connected branching drainage instead of isolated strips.
- Add moving low-contrast shoreline foam breakup and explicit water bounds for faster streamed-tile culling.
- Couple rain and snow to the shared water shader so precipitation changes ripple, foam, glint, and cool surface tint without rebuilding water geometry.

### Terrain readability

- Feed continuous ridge, valley, plateau, and caldera signals into terrain vertex colors so distant terrain keeps geological structure without extra draw calls.
- Add deterministic exposed-rock bands and cool valley shading to snow and mountain materials so alpine relief remains legible at flight distance.

### Weather

- Replace abrupt random preset jumps with seeded fronts that move through believable neighboring conditions.
- Blend fog, daylight, three cloud decks, wind, gusts and precipitation continuously over each transition.
- Feed blended rain and snow intensity into streamed terrain materials so wet fronts darken the ground and snow cools high relief without rebuilding chunks.
- Add wind-driven rain streaks, storm-darkened skies and lightning flashes.
- Batch every cloud puff into three instanced deck draws instead of hundreds of individual meshes.
- Add instant weather selection to the terrain review for visual and performance QA.

### Audio

- Afterburner engage cue: short rising whoosh (edge-triggered, not every frame).
- Touchdown and crash cues use brief noise bursts plus tones for clearer impact feel.
- Gate and circuit-complete cues unchanged; effects still respect mute (crash fires on the crash frame before mute).


## 2026-09-04

### Audit follow-up

- Spawn search no longer throws. Failed searches retry inland pads (never the origin ocean disk) and reseed keeps the live world if a replacement cannot be validated dry.
- Rendered water and collision now share one surface (ocean at sea level, inland water at 0.35 m).
- Near the jet, contact/AGL sample the visible chunk triangles so physics cannot miss the mesh. Far tiles promote and demote LOD (with hysteresis) instead of staying at their spawn resolution.
- Contact is swept along the motion path. Cliffs and ridges crash instead of elevating the jet. Water ditching and inverted/obstacle hits crash.
- Gate passes require a forward plane crossing. The HUD arrow is projected through the active camera.
- Simulation uses a fixed 60 Hz step with bounded catch-up. The jet and camera interpolate between physics poses so high refresh rates do not jitter. Pause, results, and a hidden tab freeze weather and daylight.
- Snow is a world-space wrapping field with round flakes, updated every rendered frame so it no longer stutters with the 60 Hz sim.
- Menu keys no longer leak into flight. Tab/Enter work on title and pause. **R** rolls a new world; pause/results Retry keeps the same course.
- Afterburner, plume, audio, and HUD share one engine state. Afterburner will not light with the throttle closed; ENG% stays the lever.
- Circuit is a scored run (time, gate accuracy, landing) with a results screen and locally saved bests. Event cues play on gates, landing, and crash.
- Stall / low-alt warnings are retuned and enabled.

### Audio

- Engine rumble and wind hiss via Web Audio (procedural noise, no sample files).
- Rumble follows throttle and afterburner; wind follows airspeed.
- AudioContext resumes on Play; muted on title, pause, and crash.
- Short procedural cues for gate, circuit complete, landing, and crash.

## 2026-08-13

Session wrap. Arcade flight is playable: take off, fly the circuit, crash or land, reset.

### Play

- Cockpit camera locks to the jet. Q/E still roll.
- Engine percent is a speed target (50% holds about 500 kts, 100% about 1000). Afterburner goes a bit past that.
- Shift / Ctrl spool the lever slowly so you can set a precise percent.
- Afterburner no longer shows an AB badge. The ENG bar still fills.
- Crash is a fireball with arcing burning globes, camera punch, and no freeze. Press R for a new world.
- Next-gate cue: HUD arrow, range, altitude, and a beacon on the live ring.
- Airfield dress: hangar, tower, apron, PAPI, windsock, floods, fence.
- Title: Play, Controls, Game info.
- In flight, Esc opens pause (resume, fullscreen click toggle, quit to title). F is not fullscreen.
- Esc in fullscreen opens pause instead of leaving fullscreen (Chromium Keyboard Lock). Hold Esc is still the browser escape hatch.

### World / spawn

- No more fake flatten of the whole departure corridor.
- Spawn only on naturally flat inland ground (not ocean or coast).
- A short disk around the strip is leveled to that pad height so the runway sits flush.

### Fixes

- Crash and landing use impact speed before the ground clamp.
- Flying into a cliff no longer elevators you onto the slope.
- After a landing you can take off and crash again.
- Title C / N / R no longer leak into the first Play frame.
- Held keys survive Play / R (except Space/Enter used to start).

### Docs / tools

- README and this changelog match current controls and features.
- Hidden map-gen overlay for agents: `?debug=1` (not shown in normal play).

## Earlier

Arcade core, streaming terrain, day/night, weather, HUD/ADI, mission rings, procedural F-35, title screen, fullscreen keyboard lock.

# Local weather audio and broader acceptance, 10.918

The Free flight loop now mixes local steady wind and a restrained continuous
storm bed alongside the existing local rain/snow ambience. Wind strength follows
the actual cell at every altitude, including maximum airspeed. Convective rumble
and gust emphasis fade above the cloud top. Storm loudness uses continuous
convection/snow fields, never a discrete weather-label switch. Existing gain
smoothing fades the beds across moving cell boundaries.

The storm branch adds one fixed source, gain and low-pass filter. It shares the
existing brown-noise buffer with the engine and allocates no extra PCM or nodes
per frame. Environment volume, master volume, cockpit muffling, mute, pause,
impact-only playback and teardown apply to it. Existing distance-delayed thunder
is unchanged. No warning or G-load tone category is added.

## Results

All seven final cases pass the same-source, hardware-renderer, camera, audio,
particle and fixed-pool checks. They cover 1,101.6 km in total, including the
612 km sustained run. Low flights collectively sample clear, cloudy, overcast,
fog, rain, storm, snow and blizzard conditions. Every high-flight sample has
zero rain/snow presentation, precipitation/storm gain and convective buffet
above the deck. Steady wind inputs continue to match the local wind.

The 900-second corridor has **78.5 to 77.7 MB lower-decile JS heap** in the
matched post-warmup windows, a change of -0.8 MB. Its peak is **195.9 MB** and
final sample is **91.9 MB**. Weather pool/audio node identities remain stable.
GPU geometry ranges are 586-728 versus 581-691, with five textures throughout
both windows. The bounded warmed-corridor memory check passes within 5 MB;
it does not establish stable memory while constantly entering new regions.

Short-flight peak heaps range from 139.9 to **239.2 MB**. These are retained
without trimming and do not establish an overall memory win or close the
10.917 northeast peak-heap failure. See every run in [the table](measurements.md)
and [machine-readable summary](summary.json), and exact view/telemetry pairs
in [the still index](views.md).

Low/high front, storm and snow stills are inspected with the production cameras.
`extremes/` supplements the brief fog and blizzard phases with condition-triggered
stills using the same production source. Browser page/shader error logs are
empty. The new storm bed reaches about 0.064 gain in the storm corridor and
returns to zero outside its local conditions; the shared brown-noise buffer
and source/gain identities are verified in the running graph.

## Vertical synchronization

Previously, buffet used unattenuated regional rain/snow/gust fields above their
visible layer. Fog also treated the precipitation source base as the top of the
cloud deck. These are distinct heights.

Rain and snow presentation/audio retain their existing source-base fade. Fog,
convective buffet and storm rumble continue through the cloud deck, fading from
150 m below its top to 350 m above it. The same exposure drives their callers.
Steady wind still follows the physical local wind above the deck. Raw regional
weather remains independent of observer height except for existing valley fog;
climate, fronts, transport, manual profiles, authored locks and flight physics
are preserved.

## Review method

`scripts/review-regional-weather.mjs` drives the actual Free flight loop with
production chase/cockpit cameras, audio, collision, physics updates, streaming
and rendering. Only the trajectory is prescribed. Each case uses seed 1,
Balanced, fixed pixel ratio 1 at 1280 x 720, a fresh hardware Chromium browser,
weather time 180 seconds at coverage readiness and fixed daylight 0.48.

Three 81.6 km regional corridors are reviewed at 150 m and 7,000 m AGL. They
cross real seeded fronts, with no forced weather presets. `route-survey.json`
records the planned conditions. The low paths use the resident contact surface
where available. The high paths are above the convective deck. Timed stills,
raw telemetry and final frame/resource records are retained per case.

A separate 900-simulation-second flight repeats the 81.6 km front corridor in
both directions, traveling 612 km. This tests sustained weather lifetimes in a
bounded, warmed landscape. It is not an always-new-region cache stress test.
The 300-420 and 780-900 second windows cover the same route phases, two complete
round trips apart. Lower-decile unforced JS heap samples distinguish sustained
memory from individual GC peaks. No GC is forced and no resource budget is cut.

Read-only browser instrumentation retains instance references and polls every
five wall-clock seconds. It verifies actual audio targets, wind inputs, active
particle families, aircraft buffet, fog, camera mode, cloud/rain/snow/shaft
capacities and pool/node identity. There is no production debug global or
per-frame diagnostic history. Source fingerprints must match across final cases.

The diagonal amber streaks in these maximum-speed stills belong to the existing
HUD speed treatment. Particle visibility telemetry distinguishes them from
rain; they are retained in the actual game views. Screenshots and polling can
affect frame timing, so these runs are weather/memory acceptance, not a matched
FPS comparison. The [10.917 performance review](../performance-10.917/README.md)
retains the separate northeast heap failure and unproven long flight-gap cause.

`pilot/` retains the first completed storm corridor before the final steady-wind
altitude rule. Its audio/particle checks and stills are diagnostic evidence,
excluded from the final same-source acceptance table.

## Verification

The 77 focused audio, regional weather, atmosphere, precipitation, storm and
flight-recorder checks pass, as does the production build. Regression checks
cover audible cell wind at full airspeed, bounded storm levels, environment
mute/impact behavior, fog/convection through the deck and zero exposure above
it. Existing pause, determinism, profile locks and fixed pools remain covered.
Final visual, condition coverage and sustained-memory results are retained in
`measurements.md`, `summary.json` and the actual browser stills.

These prescribed flights do not establish manual handling quality, subjective
speaker/headphone balance or physical-device behavior. Geometry, collision,
water detail, draw distance, workers, uploads, weather capacities and all existing
budgets remain unchanged. No paused system is resumed.

## Reproduction

Start Vite at 127.0.0.1:5173 and set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` to
the installed Playwright module and Chromium executable. Run:

```sh
node scripts/review-regional-weather.mjs
node scripts/summarize-regional-weather.mjs docs/reviews/weather-10.918
```

Set `REVIEW_WEATHER_CASES` to comma-separated case names for an individual
flight, and `REVIEW_DIRECTORY` for a separate capture directory. A completed
case is reused only when its source fingerprint matches. Release-only metadata
changes occur after measurement.

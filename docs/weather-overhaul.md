# Weather overhaul delivery

## Approved direction

Natural, cinematic and playable weather for the shared world generator, with
Free flight as the review focus. Terrain, rivers, flight physics, mission
design, UI layout, removed warnings/effects and paused vegetation are excluded.
Keep existing presets, Automatic, authored locks, settings and replay IDs.

## Batch 1: regional fields and clouds (10.893)

- Coverage, moisture and convection are independent continuous fields, with
  broad moving air masses, irregular rain bands and smaller embedded cells.
  Temperature, landform elevation, humidity and coast exposure affect them.
- The five-seed review (1, 42, 73, 1337, 2026; +/-200 km, 8 km spacing, time
  180, observer height 200 m) checks 55-70% clear/scattered samples and at most
  10% storm/blizzard samples in each world. It also requires dry overcast and
  rainy regions without lightning. All eight families remain represented.
- Caller-owned samples include cloud base/top, precipitation base, visibility
  metres and convection. Manual presets use the same structure adapter.
  Their profile remains authored/locked while cloud/source heights fit local
  landforms instead of sitting inside tall terrain. Observer-altitude valley
  fog changes visibility, never the physical precipitation source height.
  Local sampling runs at 5 Hz; values interpolate between targets. Explicit
  clock seeks, initial seeds and large position changes resolve immediately.
- An 8 km world-cell field considers at most 81 neighbours and retains 46
  fixed slots. Cloud identity and layout derive from seed/cell, not slot or
  travel history. Equal family capacities keep revisited silhouettes stable.
  Old identities fade before replacement; no persistent world cache is added.
- Three instanced draws hold 320 cumulus, 288 stratus and 80 cirrus elements
  (688 total, below the 694 cap). Cumulus has a lower crown, towers and an
  upper crown that spreads with convection; sheets and wisps use distinct
  layouts. Cloud top bounds constrain height, and the same transformed
  ellipsoids supply immersion. Opacity and exact simulation-time drift
  interpolate in the shader without rebuilding matrices every frame.
  Distant sky decks now fade above that shared cloud top, including tall storms.
- Temporary authoring meshes/materials were removed. Pool sizes, draw limits,
  quality scaling, precipitation capacities and terrain distance stay bounded.

## Reproducible review

Open `dev/terrain.html?destination=weatherfront&seed=1`. Expand Reproducible
weather review, enter seed, world X/Z, simulation seconds and day fraction
(0-1), choose a preset/Automatic and height above ground, then Apply review
pose. Hold weather clock freezes the sampled front while rendering/streaming
and particle presentation continue. This is a review fixture, not game pause.
Below/Inside/Above cloud inspection targets a currently rendered dense cloud;
it reports the target centre. Choose a destination to leave that inspection.
Inspection cameras stay above actual terrain; an impossible below-cloud view
is reported without moving the camera into the ground.
Choose a cloud family to inspect a specific formation type. Inside-cloud
inspection also rejects terrain-intersecting viewpoints rather than falsely
reporting immersion from an underground camera. Advance weather 30s advances
only the review atmosphere by 30.1 simulation seconds, including a short flash
attack step; with Hold weather clock enabled this can preserve an actual
eligible event for inspection. It does not force an event into dry weather.

## Batch 2: precipitation and storms (10.894)

- One additional instanced draw, 16 shaft slots and 46 bounded candidate records
  share positions, rain intensity, source height and identity with cloud banks.
  Existing ground/water depth occludes the planes below their surfaces. No
  terrain queries, framebuffer passes, textures or per-frame meshes are added.
  Old identities fade before their occupied slots move. Balanced shows at most
  12 shafts; quality settings scale visibility without enlarging the pool.
- Rain retains 1,800 particles, with individually seeded exposure/opacity and
  soft tails. Snow retains 4,200 flakes, with seeded opacity/size, an 8 px cap
  and restrained heavy-snow size gain. Both fade close to the camera and remain
  clipped to the same physical precipitation source. Fractional world seeds
  now remain distinct in their appearance buffers.
- Wire the physical visibility field into existing scene fog. Heavy snow and
  low fog now reduce depth visibility rather than relying on large bright
  particles; outside cloud interiors the physical floor is 2.6 km. Above the
  source layer the existing clear envelope returns. Terrain streaming radius,
  camera range, worker/upload budgets and generated/drawn tile ownership are
  unchanged: this is weather visibility, not a performance-distance reduction.
- A seeded event controller owns one cloud-positioned flash and one pending
  thunder. Illumination peaks at no more than .18, lasts .6 seconds and applies
  only inside the cloud shader around its source, not to sky/fog, ambient/fill
  lights or global exposure. Mature-storm cooldown is 18-36 seconds; pending
  sound can postpone the next event further. No new camera shake or banners.
- Thunder delay uses source/listener distance at 343 m/s; event sources beyond
  20 km are skipped. Arrival gain uses the listener's current distance and is
  silent beyond 30 km. The gameplay loop consumes the sole ready event once,
  reusing the existing procedural audio cue and its preferences/limiter. Pause
  freezes the controller; reseed clears it. Reduced motion cancels illumination
  but not sound. Preset switches also cancel illumination while retaining sound
  already travelling from an earlier event.
- Correct matrix rebuild cadence to .2 seconds. Batch 1 sampled regions at
  5 Hz but inadvertently retained the old 30 Hz matrix constant; its notes
  overstated this part. A direct 150-second matrix-version regression now
  requires exactly 750 updates, while shader drift/opacity interpolate frames.

The actual storm review used seed 1, X 8000/Z -56000, 220 m above sampled
ground, day .48, manual Storm. At held time 210.1 the event preview was active
and Balanced reported 12 shafts. Chase and below-stratus stills rendered
without reported shader errors; the latter targeted (10360.0, 3171.3, -53177.8).
These are static rendering checks, not proof of transition quality, audible
thunder timing or acceptable frame times. Render intervals remained near
1,000 ms. The initial first-person Blizzard still at held time 180 exposed
overly faint sub-pixel flakes; opacity/size were adjusted within the existing
count and 8 px cap, with final readability review still required.

Retained stills: [storm chase](reviews/weather-storm-chase-10.894.png),
[below stratus](reviews/weather-storm-bank-10.894.png) and
[snow before depth-visibility tuning](reviews/weather-snow-before-depth-tuning-10.894.png).
The storm stills were captured before the final preset-switch guard, which
does not change their steady profile/shader appearance. The snow still
predates the final physical-visibility wiring and is not final snow acceptance.
The browser capability and DOM both reported visible while the approximately
one-second render intervals persisted; the underlying cause is not established.

Batch 2 passed 102 checks in the 11 affected weather/sky/audio files and the
production build/release-metadata check. The existing Three.js bundle-size
warning remains. Those results prove the scoped data/lifecycle/budget checks,
not the missing continuous visual, gameplay or performance/memory acceptance.

## Baseline and acceptance limits

The unchanged 10.892 baseline was attempted before source edits at Balanced,
1280 x 720, pixel ratio 1, seed 73, using the existing 81.6 km recorder. It
lost focus during loading, then continued near 1,000 ms rendered intervals
after Resume. No flight samples were recorded before stopping the attempt.
The raw partial result is retained in
[the diagnostic record](reviews/weather-baseline-10.892.json). It is rejected
as startup/FPS comparison evidence. No three-run performance claim is made.
A scattered-cloud baseline still was also captured; the subsequent attempted
storm still had not visibly applied its preset and is not storm evidence.
[Baseline still](reviews/weather-baseline-cloudy-10.892.png) and
[current work-in-progress still](reviews/weather-clouds-in-progress-10.893.png)
are retained. They are different conditions/times, not a matched visual
quality comparison. The current still reports Overcast at time 11.9 and shows
the final optical code rendering, but not a close-up of every formation family.

Initial candidate stills rendered without reported browser errors, and the
held review clock read 180.0 seconds. That does not prove all cloud families,
interiors, weather transitions or acceptable frame times. The same roughly
one-frame-per-second restriction currently prevents continuous travel review.
Keep final visual acceptance open rather than substituting green unit tests.

The below-cloud check exposed an underground review camera and fixed manual
cloud heights inside taller ground. Both were corrected, with a mountain-source
regression that preserves authored profile values. The corrected exterior
rendered above ground, but individual flat rims remained apparent. Optical
falloff was broadened, per-element bright rims removed and banks thickened;
that final tuning still needs reliable rendered inspection, including interiors.

## Remaining delivery

1. Review/tune cloud families below, inside and above them, in chase and first
   person, with saved fixed-pose screenshots.
2. Finish rain/snow appearance and transition review, including above/below
   source layers; tune the implemented shafts/particles if the rendered result
   needs it, without increasing the fixed budgets.
3. Review actual gameplay thunder arrival/volume and local illumination with
   reduced motion and preset changes. The implementation/unit checks are not
   a substitute for hearing/seeing it during flight.
4. Verify continuous maximum-speed clear/rain/storm and mountain-snow routes,
   including preset/Automatic, authored locks, reseeding and pause behavior.
5. Complete three matching baseline/candidate full-game runs, targeting median
   and p95 regressions within the greater of 10% or 1 ms, plus a 15-minute
   sustained-travel resource/memory check. Retain known hitches and investigate
   new weather-specific stalls. Never reduce terrain distance to pass.

Affected weather tests and a production build are required for each delivery.
Batch 1 passed all 70 checks in the eight affected weather/cloud/sky files and
the production/release-metadata build. The existing large Three.js bundle
warning remains. Those checks are not substituted for the remaining field and
performance review.
The full overhaul remains active until implementation and acceptance are done.

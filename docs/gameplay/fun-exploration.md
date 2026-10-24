# Finding the fun, b31 / 10.998

The original b31 brief was exploration only. This replaces the rejected [10.994 scope](overhaul-scope.md). Daniel has not chosen the game yet. Every new feature and any prototype needs his explicit approval before code. b31 built nothing.

The shared core: **the joy of flying through terrain**. Low and fast through canyons and valleys, around ridgelines, under arches and bridges, choosing near-misses and linking flowing lines. Mastery means reading terrain and knowing when to boost, brake, bank or climb. Terrain is the activity, not scenery beside gates. None of these directions ends with a return to the airfield or a home-runway landing.

## What we can honestly reuse

The [mission generator](../../src/systems/MissionGenerator.ts) supplies repeatable seeds and 15 to 100 gates, but currently makes a circuit aimed back at a runway. [Landforms](../../src/world/Landforms.ts) shape terrain separately: the mountain valley is several kilometres wide, not a tight flying line. More gates alone cannot make this fun.

[Terrain geometry](../../src/world/TerrainGeometry.ts) and [contact sampling](../../src/world/TerrainSystem.ts) use a height field. Canyons, passes and ridges fit it; overhanging arches do not. Existing road bridges are not guaranteed flyable openings. Arches and reliable bridge openings need separately approved geometry, placement and collision checks, including undersides at speed. Cheapest tests omit them. Vegetation and removed rock props stay excluded; bridge work that reopens the closed city/roads redesign needs explicit approval.

[b20 physics](../../src/aircraft/FlightModel.ts) already provides banking, braking, stall recovery and turn-energy loss. [b21 nitro](../../src/aircraft/NitroSystem.ts) provides 12 seconds of boost, 45 seconds of passive refill and b30's scaled accepted-gate awards. Gate-free options keep passive refill; near-misses grant no nitro. The [current scored finish](../../src/systems/ChallengeRun.ts) requires landing, so an airborne finish is real integration work, not a text change. Prototype results must stay separate from existing medals and saves.

Costs are rough Codex effort, not dollar or quota forecasts. A pass includes implementation, checks, build and focused flight review. Estimates include terrain and start/finish work; polished UI, permanent progression and arches/bridges cost extra. These are alternatives.

## A. One perfect line

**Pitch:** A short terrain time trial you replay until the whole flight feels like one movement.

**My five minutes:** “I'm already airborne above the canyon entrance. I dive into a left-right sequence, brake before a blind ridge and save boost for the valley exit. I finish in the air after about ninety seconds. I retry immediately: this time I hold the bank through that second bend. One more run.”

**Why return:** Beat my time on a familiar seed, then master a harder line. Progression could use route medals to reveal harder courses, with no aircraft upgrades. Gates may guide; terrain supplies the pull.

**Terrain change:** Replace the runway circuit with a one-way canyon, changing bend radii, ridge saddles and occasional breathing space. Shape terrain and route together. Turns need readable lead-in at b20 speeds, with optional tighter cuts for experts. Later, an arch or bridge could punctuate a memorable section.

**Cheapest feel test:** One fixed seed, a 60 to 90 second shaped corridor, 15 existing gates with unchanged scaled refills, airborne start/finish, elapsed time and immediate same-line retry. No medals, unlocks or saved record changes. Spend five minutes on repeated attempts. **Medium, 2 to 4 Codex passes.** Test whether improving the line feels good before adding courses.

### Approved A prototype, b32 / 10.999

The Oct 23 approval covers only this cheapest feel test. It now exists: choose **Perfect Line (prototype)** on the title screen. Seed 32026 supplies one hand-shaped 11.2 km canyon, changing bend radii, two ridge saddles and breathing spaces. Start airborne at 150 m/s, pass all 15 existing gates in order, then finish in the air. Existing scaled nitro refills apply. The running timer holds the finish time; **R** instantly retries the same line, including after a crash. Escape opens the existing menu to quit. No landing, medals, unlocks, saved times or new save fields. Existing missions keep their scoring and records.

This is a short feel test, not approval for additional courses or systems. Human replay appeal still needs five minutes of flying. Physics, nitro tuning, streaming/worker/draw budgets and paused exclusions remain unchanged.

## B. Make your own line

**Pitch:** A compact flying playground where the goal is to make a beautiful, daring run through terrain.

**My five minutes:** “I skim the canyon floor, roll around a spur and pop over the ridge into a second valley. I could take the wide gap, but I bank into the narrow cut. I loop around to link those moves without losing speed. I end the session in the air when I'm satisfied.”

**Why return:** Find new combinations and fly them cleaner. Progression is mastery first, then optional low-flight or clean-passage challenges. No mandatory route, finish order or gate count.

**Terrain change:** One bounded area with connected valleys, ridge crossings, safe recovery space and several lines through each junction. Lines must work from different headings. Arches and bridge gaps would become optional moves, never compulsory collectibles.

**Cheapest feel test:** One fixed area with three connected passages, airborne restart and gate-free Free flight using passive nitro refill. No new score or near-miss detector. End through the menu. **Medium, 3 to 5 Codex passes.** First ask whether flying there is compelling without rewards; a scored freestyle system would be additional work.

## C. What's beyond that ridge?

**Pitch:** A five-minute one-way journey where choosing the next valley makes each flight your own.

**My five minutes:** “The canyon forks. I take the narrow river cut instead of the high saddle. It opens into a basin, then another choice: fast along the wall or a climb across the ridge. I burst through the last gap into open country and finish in the air. Next run I want to see the other branch.”

**Why return:** Discover other connected routes and learn which lines suit my flying. Progression could reveal journeys as branches are completed. No combat, delivery chores or return leg.

**Terrain change:** Generate connected forks and reconnections with readable entrances, distinct silhouettes and flyable exits. Keep branches close enough for bounded streaming; no promise of endless worlds. Arches and bridges could distinguish choices later.

**Cheapest feel test:** One fixed seed with two forks and one airborne exit, roughly three to five minutes long. No gates, passive nitro refill, simple exit detection and retry. Remember choices only during the session, with no persistent map. **Medium to large, 4 to 7 Codex passes.** Branch terrain and navigation cost more than A; a generated network is additional work.

## Try A first

It answers the central question fastest: is threading deliberately shaped terrain worth another run? A short line makes changes easy to compare. This does not commit Blackout to racing. If the timer distracts, try B on the same terrain before expanding.

## Choices for Daniel

- First feeling: A) perfect a line, B) invent lines, C) discover routes?
- Pressure: A) beat a time, B) optional challenges, C) no score?
- Guidance: A) gates, B) sparse landmarks, C) terrain alone?
- Progression: A) harder routes, B) technique challenges, C) discovered branches?
- Openings: A) canyons first, B) separately approve an arch test, C) separately approve bridge work, including any needed city/roads exception?

## Limits for every option

Keep b20 physics, b21 nitro, b24's 10.978 stutter fix and the 10.989 frame-spike fixes. Heap stays about 200 MB; retain existing streaming, worker and draw budgets. Fit terrain to the plane, not a physics retune. Preserve telemetry, instruments, G readout, existing scoring, saves, collision and ordinary navigation/glide guidance. No weapons, combat, multiplayer, Discord integration, parallel world or record systems. Vegetation, flight-warning strips/tones and blackout/redout effects stay excluded. No option assumes a hard-limit relaxation. If a prototype cannot fit these limits, bring Daniel an explicit choice before proceeding.

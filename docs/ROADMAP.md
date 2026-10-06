# Roadmap

Chunk **10.831** is current and chunk **10.830** is the previous ship. The public release stays **v0.12.0** (`Systems expansion`). `src/core/Version.ts` and the README lead already name this chunk.

## Done

The playable loop is courses, contracts, landings, and Ops. Training Orbit is the first sortie when no course preference exists. Daily, weekly, and monthly Ops, ghost replay, and the persisted course filters are shipped. Weapons and combat are not part of the game.

The unreleased hot-path pass through **10.831** gates or squares comparison-only distance and speed roots, and drops duplicate speed math, across traffic alerts, radar contacts, obstacle and contact sweeps, wakes, landing scrub, warning lookahead, thermals, vegetation slope, cloud fade, airfield pad blends, PAPI approaches, grounded runway speed, settlement streaming, and regional road candidate ranking. **10.831** ranks regional road candidates with squared distances.

## Next

Continue that hot-path pass. Drop a distance or speed root only when it is comparison-only or duplicated, and keep the result, the draw calls, and the fixed-step flight loop unchanged. Settlement planning and queue scoring, water, hydrology, regional road connection gates, and the flight model still evaluate square roots, so that is where the pass still has work. Do not add weapons or a combat mode. Further play stays inside courses, contracts, landings, and Ops.

# Wind-carried regional weather, 10.916

Spatial coverage, moisture, convection, precipitation and climate envelopes
already existed. Their fronts and cloud identities moved at a fixed (12, 3)
m/s while surface wind could point elsewhere. This follow-up makes the transport
coherent instead of adding a second weather system.

One seed-derived prevailing wind aloft, 10-16 m/s, carries the regional fields,
world-cell cloud identities, between-update cloud drift and distant sky origin.
Surface wind retains the weather-dependent strength and gust ceilings while
veering at most 0.3 radians around that prevailing direction. Cloud and surface
wind speeds can differ. Terrain climate still modulates the passing air mass.
Existing local snapshots continue to drive rain, fog, lighting, water/ground
response, wind, turbulence and storm buffet.

All placement remains a direct function of seed, position and simulation time.
No integrated drift, wall-clock weather timer, growing cell cache, worker or
draw family is introduced. Pause, seeking and revisiting remain deterministic.
Manual presets share cloud transport so changing mode cannot teleport cloud
identities; authored weather/wind locks and profile strengths remain intact.
The storm review origin moves 2 km north to cross the intended front under the
new transport. This changes a developer fixture, not world geometry or missions.

The existing 46 formations / 688 allocated instances / three cloud batches,
16-shaft pool and rain/snow capacities are unchanged. Balanced still draws its
existing scaled subset. Terrain, collision, geometry, render distance, worker
limits, records, ghost revision 27 and paused systems are unchanged.

## Verification

Focused checks cover simultaneous clear/overcast/rain/storm regions, smooth
maximum-speed transitions, seed/revisit determinism, aligned wind, manual-mode
identity continuity, sky transport, true pause, all existing pool identities,
precipitation and storm presentation. The production build is checked separately.

`scripts/review-weather-boundary.mjs` runs two continuous 28 km maximum-speed
flights at 150 m AGL, using the production chase and cockpit cameras. The review
starts at seed 1, (-240000, -192000), simulation time 180 s and fixed daylight
0.48. Stills and read-only telemetry are saved before, within and after the dry/
rain boundary. The browser-only telemetry hook adds no production global.

All six stills are inspected. Terrain remains readable as rain streaks,
haze and darker lighting develop. Actual modes are `chase` (about 66 degree
FOV) and `cockpit` (74 degree FOV). Page/shader error logs are empty. Allocated
cloud counts remain 320/288/80; Balanced draws 240/216/56. The shaft capacity
remains 16. Raw buffet is the production weather drive before gear scaling and
motion preferences. [Complete telemetry](boundary.json) records both flights.

| Still | Weather | Rain | Surface wind m/s | Fog far km | Raw buffet |
| --- | --- | ---: | ---: | ---: | ---: |
| [chase-0.5km.png](chase-0.5km.png) | clear | 0.000 | 4.73 | 30.24 | 0.000 |
| [chase-14km.png](chase-14km.png) | cloudy | 0.000 | 5.16 | 30.24 | 0.000 |
| [chase-27.5km.png](chase-27.5km.png) | rain | 0.604 | 12.28 | 19.22 | 0.458 |
| [first-0.5km.png](first-0.5km.png) | clear | 0.000 | 4.86 | 30.24 | 0.000 |
| [first-14km.png](first-14km.png) | cloudy | 0.000 | 5.35 | 30.24 | 0.000 |
| [first-27.5km.png](first-27.5km.png) | rain | 0.606 | 12.29 | 18.85 | 0.462 |

This is a prescribed review path, not a free-flight handling/audio playthrough.
The [10.915 performance comparison](../performance-10.915/README.md) measures the
hitch changes before this weather follow-up; it is not a performance comparison
of the combined release. Complete storm/blizzard/audio coverage, sustained
15-minute memory acceptance, smaller hitches, the remaining native timing gap,
coastal road connectivity and rough-terrain road artwork stay open. No overall
FPS/heap win or completed weather-overhaul acceptance is claimed.

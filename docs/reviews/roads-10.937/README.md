# Bounded coastal recovery, 10.937

The expanded sixteen-village corpus improves from twelve connected sites to fifteen. Both seed-42 villages `-6,-4` and `-7,-5` share the new `-6,-4|-7,-5` road. Seed 1337, village `6,-6`, gains `6,-6|7,-6`. Every previously connected site remains connected. Seed 73, village `-3,8`, remains unresolved, so Part C is only partially complete.

## Repairs and budgets

The first, unchanged corridor remains the preferred profile. When an early climb would require raising a fixed street endpoint, a wider inland corridor can find a graded departure with the same station/lane limits. Its reach is at most 20 km and 80 percent of endpoint distance. The clearance blueprint window includes that reach and still rejects anything exceeding the existing 49-cell ceiling. Buildings and service pads cannot be bypassed by a wider search.

For a dry coastal corridor whose middle grades fail, eligible local repairs use 40 m station spacing inside the existing 64-station, eleven-lane and 600 m lateral limits. Plan all patches before sampling: more than four patches returns immediately, and finer coastal patches must fit a conservative 70-percent work estimate, reserving room for the ordinary coastal detour. This prevents the failed seed-808 repair from spending the allowance required by its existing valid shoreline road.

All extra repairs and the ordinary coastal detour share one 5,000-probe allowance. A single profile gate enforces four complete profile builds across every branch. The original first corridor keeps its 3,000-probe bound. Discovery still uses 24 neighboring cells, four ranked attempts, one village link/two city links, eight attachment candidates, 8,192 profile points and 192 supports. Wet/dry spans remain 1,800/1,200 m, structure height remains 96 m, and maximum grade remains .24. No extra links, neighbor scans, workers, meshes, draws, streaming resources or terrain excavation are introduced.

| New road | Profile points | Supports | Maximum wet span | Maximum dry structure span | Maximum height | Maximum grade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Seed 42, `-6,-4|-7,-5` | 1,564 | 6 | 0 m | 1,006.47 m | 27.87 m | .2352 |
| Seed 1337, `6,-6|7,-6` | 1,724 | 7 | 358.02 m | 634.44 m | 32.82 m | .2352 |

Both have dry street ends and identical reverse-query profiles. Generated checks independently sample water/ground, verify supported crossings and every physical ceiling. The synthetic exhaustion check consumes the shared allowance through one repair, proves the following detour sees an exhausted sampler, and bounds complete profiles at four. The existing coastal departures, clearances and connectivity checks remain required.

## Evidence and limits

`before.json` and `after.json` record identical sites, every proposal, source hashes, rejections and accepted physical metrics. `experiments.json` retains the unsuccessful lane, grade, wetness, attachment, local, wider and mixed candidates, including the rejected version that lost seed 808. These are offline planning diagnostics, not frame measurements.

Eight before and eight after stills use the production chase/cockpit rig at 30 m road clearance, 1280 x 720 and pixel ratio 1. The three connected sites show their selected new regional road; the unresolved seed-73 site still shows local streets. These are resident-road inspection poses, not a continuous manual drive or full infinite-network proof. `pilot-hmr` is excluded because its disabled websocket produced development-client errors; the accepted repeat uses a live HMR transport and frozen routing source.

Seed 73 still rejects its three ordinary proposals under the span/height/grade/clearance rules. Additional bounded experiments also fail three otherwise sparse-gated neighbors in the same 24-cell discovery ring; that proposal-rule experiment is not shipped. This is not proof that every conceivable route is impossible. Connecting this last site needs a further bounded routing improvement. No failed road is forced through the physical limits, and the unresolved site is not marked connected.

Landscape revision 29 and route revision 30 remain unchanged as explicitly requested. Terrain/water generation, aircraft physics/contact, saved records, all resource ceilings and paused exclusions are preserved. Some regional winners/profiles can change; no complete world-network or performance acceptance is claimed. The heap target remains approximately 200 MB, with no heap investigation in this part.

Reproduce the corpus with `COAST_SITES=4 COAST_FIXTURES=docs/reviews/roads-10.937/before.json node scripts/survey-coastal-roads.mjs OUTPUT.json`. The optional `COAST_SOURCE_DIR` supplies frozen routing source and its actual hashes. Run `scripts/review-coastal-villages.mjs DIRECTORY LABEL SURVEY.json` with `COAST_VIEW_SITES='73/-3,8;42/-6,-4;42/-7,-5;1337/6,-6'`, matching `COAST_VIEW_FIXTURES`, `REVIEW_URL`, `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`.

All sixteen accepted before/after stills are visually inspected, and both clean captures have no page/console errors. The 12 focused road routing/connectivity, generated geometry, clearance, profile, protected-plan, collision, removed-system and release files pass 73 checks. The production build passes with the existing bundle-size advisory.

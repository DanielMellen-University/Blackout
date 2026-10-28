# r9 proof flights (11.022)

Headless, deterministic and controls-only. The flights use the existing review pilot from `scripts/browser-generator.js` and the production aircraft, collision, mission and scoring code. There are no browser screenshots in this pass; the tests are the proof.

## What is proven

- **Every theme, airborne start to scored airborne finish** ([proofFlights.test.ts](../../../tests/proofFlights.test.ts)). Training orbit, Desert, Mountain valley, Coastal island, Volcanic and Waterway each fly seeds 42 and 1337. Each flight starts in the air at about 150 m/s, lined up on gate 1. It passes every gate in order with no misses and never touches the ground. It finishes in the air at the last gate, and the result is scored with time plus the three M4 flying bonuses, with no landing quality.
- **Flown routes** ([proofRoutes.test.ts](../../../tests/proofRoutes.test.ts)). This covers 5 themes and 60 seeds on the bent routes players actually fly. Gates are 0.8 to 2.5 km apart and every turn is under 75°. Bending moves a gate at most 160 m. The last two gates stay on the runway axis, and every loop is wider than 1.4 km. Waterway keeps river and lake gates on 60 of 60 seeds, unbent.
- **Daily challenge determinism.** Three UTC days were checked. Morning and evening resolve the same course and fly the same flight, with the same passes, time, score and bonuses. The next day gets a new seed.
- **Free flight** ([proofFreeFlight.test.ts](../../../tests/proofFreeFlight.test.ts)). On real seeded terrain, Free flight starts at rest on its runway with no gates on 6 seeds. On seed 1337 a controls-only takeoff, circuit and touchdown raises LANDED and is never scored as a gated finish.

## Bug found and fixed

- A gentle touchdown in a gated run showed the LANDED banner and played the landed cue. 11.022 announces LANDED only in Free flight. The ground state is unchanged.

## Findings for r10+ (not fixed here)

- **Terrain bonus is unreachable on the line.** Gates sit about 120 to 150 m above the terrain, so a pilot following the gates scores 0 terrain-proximity bonus. Full credit is at 0 m and none at 100 m. Every proof flight scored 0 here. This is a tuning call for Daniel.
- **Time score never drops.** Every proof flight scored the full 75,000 time score, because the allowance is generous at 150 m/s. Every flight earned silver.
- **Training orbit gate count.** Training prefers 8 to 10 gates, but over 200 seeds it always gets 11 to 14, because the turn limit forces more gates on the loop ends. It flies almost the same route as the Desert run.
- **Bending is rare outside desert and coast.** It is active on 60 of 60 Desert and 58 of 60 Coastal seeds, but only 4 of 60 Volcanic and 0 of 60 Mountain valley seeds, where the floor offers no lower line within 160 m.
- **Review pilot landings.** The controls-only review pilot landed a full Free flight circuit on only 1 of 6 seeds. Elsewhere it floated past the runway or touched down nose-high. This points at the review pilot, not the game; the flat-ground touchdown test still passes. A sturdier headless landing pilot would let the proof cover more seeds.

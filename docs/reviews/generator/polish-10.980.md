# Coastal island and Volcanic polish, 10.980

This part polishes only the two existing generated themes under the Oct 20 batch approval. There are still exactly four approved generated themes. Further themes, features, mission types, systems and roadmap items require separate approval. Older missions remain functional without polish.

Both recipes now use full seeded runway headings, independently varied departures, dogleg widths, outbound reaches, return legs and gate heights. Coastal widths span 1150-2150 m with outbound reaches 2350-3550 m. Volcanic widths span 1100-1750 m with outbound reaches 2600-3300 m, staying between the existing cones. Both retain five gates and the last two aligned with the home runway. The existing scoring allowance follows actual circuit length, with the existing 88,000 gold threshold.

Coastal shore outlines combine broad headlands with smaller bays. The same signed field drives terrain, beaches, ocean clipping and contact, keeping the existing sea level and water implementation. Sea-air horizon color complements the existing water. Volcanic cones gain broken rim outlines and flank gullies, with slightly stronger relief retaining deep calderas and the low flight corridor. Existing baked lava colors gain a clearer warm accent, balanced by cooler ash haze and warm neutral sunlight. No new material draw family, texture, prop, particle system, terrain detail level or resource budget is introduced or reduced.

Dense independent corridor probes caught a small clearance shortfall on a wide-angle coastal leg. These two profiles now use the existing three probes along each leg's actual wing direction, at 52 m, plus a one-metre interpolation reserve tapered on departure. Older routes and the shipped Desert/Mountain routes keep their original fitter behavior. The test also distinguishes a coastal seabed height from its zero-level water contact surface when the new flight line crosses open sea. Runway edge/centre flatness, the clear approach, coastline/sea, caldera depth, rim relief, shared LOD geometry, cache isolation, original missions, records and medals pass the 123 focused checks. The production build passes.

Coastal advances to landscape revision 34 / route revision 37. Volcanic advances to landscape revision 35 / route revision 38. Records and ghosts reuse the existing bounded revisioned theme families. B20 physics, b21 nitro, collision, water levels and budgets, the closed city/roads design and all paused exclusions remain preserved.

Tuning uses seeds 73, 808 and 2026. Before gate views are under `polish-baseline/`; after gate, close runway, low approach and completion views are under `polish-c/`. The same seed, gate phase and camera mode support comparison, with deliberately different route headings and poses. All six flights use ordinary controls and full rendering cadence to clear five gates, boost, receive the five ordinary gate refill calls, contact the runway and earn gold. These visual flights include captures and camera changes and are excluded from timing acceptance. Final performance proof uses separate capture-free flights in 10.981.

Additional fixed-camera caldera views use the resident production terrain, materials, lighting and ordinary streaming budgets. Only the review camera changes; no aircraft, physics, mission, gate or score state is overridden. These views are excluded from timing and completion acceptance and retain their separate hook and source manifest. Step 3 remains STARTED.

| Theme | Seed | Flight s | Score | Gates | Refills | Runway contact | Medal |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| coastal-island-run | 73 | 116.8 | 98463 | 5/5 | 5 | yes | gold |
| coastal-island-run | 808 | 108.7 | 98083 | 5/5 | 5 | yes | gold |
| coastal-island-run | 2026 | 114.6 | 97993 | 5/5 | 5 | yes | gold |
| generated-volcanic-run | 73 | 113.2 | 97995 | 5/5 | 5 | yes | gold |
| generated-volcanic-run | 808 | 108.1 | 97885 | 5/5 | 5 | yes | gold |
| generated-volcanic-run | 2026 | 110.5 | 97824 | 5/5 | 5 | yes | gold |

Resume audit: five complete receipts matched the current source hashes and were retained. Only the incomplete Volcanic seed-2026 flight was repeated to completion. The focused checks and production build were rerun successfully. All six chase/cockpit before/after pairs, six close runway pairs and six approach/result pairs were inspected. No seam, missing water surface, floating runway or blocked approach was observed. Separate caldera views on all three tuning seeds confirm the summit bowls and broken rims. No performance acceptance is inferred from these capture sessions.

# Desert and Mountain valley polish, 10.979

This part polishes only the two existing generated themes. The Oct 20 batch approval also covers Coastal and Volcanic polish in the next part. No new theme, mission type, system or feature is added. Further themes and features require separate approval. Older missions remain functional without polish.

The previous recipe always departed within 20 degrees of north and reused almost the same right-hand rectangle. Both themes now use the full seeded heading range, left or right circuits, independently varied departures, outbound distances, return corners and gate heights. Desert circuit widths span 1100-2150 m, with outbound reach 2650-3900 m. Valley widths span 1450-2150 m, with longer 3000-4450 m outbound reaches. The last two gates remain aligned with the runway, with a descending height profile. The ordinary terrain-clearance fitter still resolves the five gate planes.

Desert relief uses variable dune wavelengths and intersecting wind patterns, with stronger eroded mesa shoulders. Valley relief breaks the large walls into seeded spurs and subtly varies the low floor; the tested six-kilometre mountain relief remains. Warm desert haze and sunlight, and cooler valley horizon and sunlight, refine the existing atmosphere. Fog distances, render distances, geometry, workers, draw families and budgets are unchanged. These are scalar terrain and color changes inside the existing pipeline, with no props or vegetation.

The runway stays at the seeded basin centre on its existing flat footprint. Independent checks sample both runway edges and centre across its usable length, the centreline approach and a wider 52 m route corridor. The independent dense route check uses the existing half-metre validation tolerance, including points between production probes. The three-seed flights verify actual runway contacts. Gold remains the existing 88,000 threshold: clean timely runs earn gold, while poor-precision runs delayed two minutes do not. No scoring or physics tuning is changed.

Both themes advance to landscape revision 33 and route revision 36. Existing bounded theme records and ghosts use these revisioned identities; the record system and its retention cap are unchanged. Old records stay separated. B20 physics, b21 nitro, collision, water, the closed city/roads design and all paused exclusions are preserved.

Verification uses tuning seeds 73, 808 and 2026. The before stills are from the final 10.978 runtime under `polish-baseline/`; the after flights and comparison sheets are under `polish-b/`. Each comparison uses the same seed, gate-one phase and camera mode. Changed headings and routes mean the poses differ; these are visual course comparisons, not pixel-identical performance comparisons. All six after flights run to completion with ordinary controls, fixed-step physics, five accepted gates, boost, five ordinary 25% gate refills, runway contact and gold. Captures and camera switches are explicitly ineligible for timing acceptance. Final performance proof uses separate capture-free flights in 10.981.

The focused set passes 91 checks across seeded variety, runway/approach clearance, medals, terrain/LOD, replay/records, original missions, nitro and metadata. The production build passes. The 10.978 CI is green. Browser receipts retain immutable runtime and pilot hashes. Step 3 remains STARTED, with only these four generated themes approved for polish.

| Theme | Seed | Heading before/after | Turn before/after | Width m before/after | Circuit km before/after | Gate heights above runway m, after | Score |
| --- | ---: | --- | --- | --- | --- | --- | ---: |
| desert-run | 73 | 7 / 60 | right / right | 1406 / 1481 | 13.24 / 12.89 | 290, 193, 190, 160, 131 | 97992 |
| desert-run | 808 | 1 / 5 | right / left | 1477 / 1795 | 12.80 / 13.25 | 298, 176, 160, 150, 122 | 97722 |
| desert-run | 2026 | 348 / 249 | right / right | 1426 / 1339 | 13.32 / 13.62 | 263, 174, 181, 136, 120 | 97940 |
| mountain-valley-run | 73 | 7 / 60 | right / right | 1406 / 1704 | 13.24 / 13.73 | 290, 193, 190, 160, 131 | 97996 |
| mountain-valley-run | 808 | 1 / 5 | right / left | 1477 / 1913 | 12.80 / 13.94 | 298, 176, 160, 150, 122 | 97802 |
| mountain-valley-run | 2026 | 348 / 249 | right / right | 1426 / 1609 | 13.32 / 14.79 | 263, 174, 181, 136, 124 | 97888 |

All 24 before/after gate views and the 12 approach/result views were inspected. Terrain relief, haze, runway approaches and landing results are coherent, with no observed seam or floating surface. Close chase/cockpit runway views on all six theme/seed pairs are retained under `polish-b-runways-final/`; each shows the existing flat marked strip and an open departure/approach corridor. The earlier startup-panel-covered runway stills are excluded under `polish-b-runways-early/`. The review runner now waits for the existing 1.5-second launch panel to hide before starting its pilot or captures. Final timing proof will state this start boundary explicitly; the 10.978 launch-inclusive timing remains retained.

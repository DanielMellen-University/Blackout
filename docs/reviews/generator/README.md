# Approved mission generator and two themes

Approval: Oct 20, step 3 start, generator plus exactly Desert run and Mountain valley run. Current missions stay functional without polish. Physics b20, nitro b21, collision, water implementation, streaming caps and paused exclusions remain preserved.

## Part A, 10.971

The pure generator selects one of the two approved themes, or accepts an explicit theme. Its seed produces the same start, five-point course, landing runway, existing-medal goals and terrain parameters. The landing strip is the departure strip, reached after the circuit's final inbound leg. There is no second record or world system. The foundation reserves landscape revision 30 and route revision 33 for theme identities; existing families stay unchanged. Theme catalog activation follows in B and C.

Terrain parameters enter Landforms, Geography and Hydrology through their ordinary samplers. The same serializable profile travels with terrain and settlement worker requests. Dry profiles have no standing water or live drainage; ordinary worlds retain the original water paths. No vegetation, warning strip or veils return.

Focused generator, original Contour circuit, terrain and version checks pass, as does the production build. Playwright flies the existing Training orbit from the runway through gate one using the existing external controls-only review pilot. The paired chase/cockpit images under a/ were inspected. This is a foundation smoke check, not theme acceptance or an FPS claim. The original training course ignores a custom seed, as before.

Reproduce the isolated minified review build with `node scripts/build-generator-review.mjs`, serve `/tmp/blackout-generator-production` with Vite preview on 5176, then run `node scripts/review-generator.mjs`. Build manifests retain source and pilot hashes. Normal `dist` has no injected pilot. Browser timing remains native wall time and production fixed-step physics.

## Part B, 10.972

Desert run is a new catalog entry with a fresh seed on launch. Seed replay preserves all six decimal places, while the captured sortie and retry retain the same world. The terrain recipe covers the whole infinite world: warm desert/mesa biome weights, wind-shaped dunes, eroded shelves and mesas outside the low course basin, dry winding washes, scarce organic villages and the existing village anchor. Cities are suppressed in this theme. Clear daylight uses a warm horizon/haze tint. No meshes or props are added for geology.

The five-gate circuit returns along the generated runway axis and uses the existing completion, medal, score, history and ghost paths. Identities include the generated profile, flight r32, landscape l30 and route q33. Existing seeded-record retention now also bounds generated families in the same 12-entry manifest; authored and historical records stay untouched.

Final recipe verification flies seeds 42, 73 and 808 from the runway through gate one with nitro bursts and paired Playwright chase/cockpit stills under b/. These images were inspected for dunes, mesas, uninterrupted terrain and a clean cockpit. Completion verification on three additional seeds follows in Part D. The three complete early-relief flights are explicitly excluded from final-theme acceptance and retained under excluded-early-relief/. Their timing overlaps a large local test run and is not a performance baseline.

Focused generator, original missions, catalog/session, record retention, b20 physics, nitro and version checks pass; the production build passes. The first broad suite had five unchanged terrain/weather timeouts under CPU contention, without assertion failures. All four affected files pass on repeats with at most two workers and no raised timeout. The broader repeat is recorded in the final Part D report.

## Part C, 10.973

Mountain valley run is the second and final new catalog theme. A seeded bend carves a roughly 5.8 to 6.5 km-wide floor between mountain shoulders rising more than 6 km above it. The course uses the inner four kilometres of that floor with a wide downwind leg and a long aligned inbound leg. Floor relief stays below 30 m in the tested corridor; the normal corridor validator still probes the route. Existing elevation-driven rock and snow colors shade the immense walls. The generated dry valley uses the same landform, geography, hydrology, worker, collision and LOD paths as other terrain.

Theme selection now participates in both settlement cache identities. This prevents a same-seed, same-pad theme switch from reusing the other world's towns or anchor plans. A focused regression exercises that switch. No city/roads redesign or budget change is included.

Seeds 42, 73 and 808 fly from the runway through gate one with real controls and nitro bursts. Paired chase/cockpit stills under c/ were inspected for the valley floor, giant mountains on both sides, uninterrupted terrain and a clear cockpit. Part D supplies completion flights on three additional seeds. The 59 focused theme/catalog/session/physics/nitro/paused/version checks and the production build pass; another 33 generator/record/version checks include the settlement cache regression. The prior full repeat passes 170 files / 1,672 checks at two workers without increased timeouts.

# Approved mission generator and two themes

Approval: Oct 20, step 3 start, generator plus exactly Desert run and Mountain valley run. Current missions stay functional without polish. Physics b20, nitro b21, collision, water implementation, streaming caps and paused exclusions remain preserved.

## Part A, 10.971

The pure generator selects one of the two approved themes, or accepts an explicit theme. Its seed produces the same start, five-point course, landing runway, existing-medal goals and terrain parameters. The landing strip is the departure strip, reached after the circuit's final inbound leg. There is no second record or world system. The foundation reserves landscape revision 30 and route revision 33 for theme identities; existing families stay unchanged. Theme catalog activation follows in B and C.

Terrain parameters enter Landforms, Geography and Hydrology through their ordinary samplers. The same serializable profile travels with terrain and settlement worker requests. Dry profiles have no standing water or live drainage; ordinary worlds retain the original water paths. No vegetation, warning strip or veils return.

Focused generator, original Contour circuit, terrain and version checks pass, as does the production build. Playwright flies the existing Training orbit from the runway through gate one using the existing external controls-only review pilot. The paired chase/cockpit images under a/ were inspected. This is a foundation smoke check, not theme acceptance or an FPS claim. The original training course ignores a custom seed, as before.

Reproduce the isolated minified review build with `node scripts/build-generator-review.mjs`, serve `/tmp/blackout-generator-production` with Vite preview on 5176, then run `node scripts/review-generator.mjs`. Build manifests retain source and pilot hashes. Normal `dist` has no injected pilot. Browser timing remains native wall time and production fixed-step physics.

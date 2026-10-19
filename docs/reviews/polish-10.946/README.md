# Real-flight polish, 10.946

Two new-seed Free flights run against frozen a8739c0 source. Seed 31415 reaches 610.95 simulation seconds over 617.89 wall seconds and approximately 134.6 km. Seed 27182 reaches 611.38 simulation seconds over 632.96 wall seconds and approximately 138.9 km. Each has 11 minute checkpoints in both chase and cockpit, 22 Playwright stills per flight. All 44 stills are inspected. No captured application errors, unexplained crashes, ground contacts or terrain strikes occur. Summary checks verify every recorded source hash against a8739c0. The pilot makes one airborne setup, then changes controls only through real physics, collision, weather and streaming. These are automated browser flights, not human or physical-controller validation.

The three selected repairs are visible in the review:

- Broad cloud decks expose polygon silhouettes and stacked sheet boundaries. Feather optical opacity by ray distance in ellipsoid space before the mesh silhouette. Keep the existing cloud geometry, instances, draw count, weather fields and immersion envelope.
- Chase shows green on the aircraft's port side and red on starboard. The aircraft nose is +Z, so port is +X. Correct the two authored light positions and regress both side and color while preserving their pulse.
- The top-right ALT value is actually terrain-relative radio height. Label it AGL and announce metres above ground. Keep its source telemetry unchanged.

`before/` contains continuous-flight evidence. `matched-before/` and `matched-second-before/` reproduce recorded poses before the repair. `matched-release-after/` contains eight final chase/cockpit views on both seeds, with browser assertions for AGL, its accessible description, and the actual light positions/colors. Static reproductions hold a pose and seeded regional time; they are separate from the continuous-flight proof. Worker completion and terrain LOD can differ between captures. The earlier candidate comparisons are retained in `matched-after/`.

The seven focused/release files pass all 169 tests, including aircraft, weather, HUD, briefing, cockpit, guide and version checks. Two stale HUD hint expectations are updated to the already-shipped 10.945 wording. The production build passes with its existing large-chunk advisory. The final matched views have no captured application or shader errors and are visually inspected, including full-size cloud, wingtip and AGL views.

Reproduce flights with `scripts/review-endurance.mjs`, FLIGHT_SEEDS=31415,27182 and FLIGHT_SECONDS=610. Use `scripts/review-polish.mjs` for static comparisons. Supply PLAYWRIGHT_MODULE, CHROMIUM_PATH and REVIEW_URL. Flight physics, collision, water, landscape revision 29, route revision 30, cockpit visibility, resource budgets and paused exclusions are preserved. City/road work remains closed. No performance or memory improvement is claimed.

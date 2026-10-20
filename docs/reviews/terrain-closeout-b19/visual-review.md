# Fresh visual recheck

All six 45-second low-altitude flights in `final/` finish cleanly. Inspect all 36 stills: no reproduced visible terrain seam, gap, floating building or broken/floating road. The set covers alpine seed 42, dry/badlands seed 2026, green seed 9001, volcanic seed 1, coastal seed 73 and city/hinterland seed 1337. The starts/headings match the accepted audit routes. This is a fresh repeat, not reused audit imagery.

Normal-altitude passes in `lod/` start at 650 m clearance and run over 25 seconds each, using clear daylight and both production cameras. Actual sampled AGL spans 565-909 m across the set. Each retains a continuous 1280 x 720 WebM, four chase/cockpit stills and flight telemetry. `lod/sequences/` contains forty frames per seed at half-second spacing after the reset warmup, split into two sheets. All twelve sheets, 240 frames total, are inspected in sequence. No obvious LOD silhouette jump, opening crack or abruptly appearing terrain patch is observed. Camera changes are deliberate and recorded; they are not LOD events.

Sequence timestamps are approximate, aligned from video duration minus measured flight wall duration. Startup and the first five seconds after the airborne reset are outside those sheets. Raw videos retain startup and that warmup, with subsequent chase/cockpit switching, so the underlying recording remains inspectable. Dense frame inspection is bounded temporal evidence, not an exhaustive claim about every rendered frame or world coordinate. LOD recording uses video capture; endurance performance runs do not.

The appearance remains visibly different across the five requested groups: snow-covered alpine ridges, tan dry slopes and orange badlands, green rolling ground, dark charcoal cinder relief, and sand against independent blue coastal water. No biome, geometry, material or physics changes are made to obtain these results.

`mission-loads.json` records successful DOM selection and launch of the five featured missions and Random world, with no application/console errors. This is a loading smoke check only, with no mission polish or completion claim.

Seeds 42 and 73 complete clean 650-second flights, with all 44 chase/cockpit minute stills rechecked during b19r. The third accepted ten-minute flight remains pending. The interrupted seed-1337 repeat is archived in `endurance-partial/1337-usage-limit/` and is excluded from acceptance. See `part-a.md` and the final report for the eventual decision.

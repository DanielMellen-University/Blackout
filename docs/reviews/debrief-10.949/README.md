# 10.949 existing flight-report polish

The crash summary repeated its failure reason in both the outcome position and the landing/failure position. The inspected 10.947 Contour report read `ATTITUDE ... ATTITUDE`. It now reads `CRASH ... ATTITUDE`. Ditch reports use `DITCHED`, and a missing reason does not append a second copy of the generic outcome. The copied summary also identifies the actual crash/ditch outcome while retaining the failure detail.

This is presentation polish on shipped flight reports. Score, medals, coaching, saved records, route generation, flight physics, collision, terrain and weather are unchanged. The README's existing featured-mission list now includes the already-shipped Contour circuit. No mission or feature is added, and paused systems remain excluded.

## Evidence

The before screenshot is `../recovery-10.948/verified-keyboard-retry/8-gates-1-crashed.png`. The fresh after screenshot is `keyboard/8-gates-1-crashed.png`, with the same seed 982451, Contour circuit, actual crash flown by mapped keyboard inputs, viewport 1280 x 720, Balanced quality and pixel ratio 1. `summary.json` checks the stored before/after report text and confirms one ATTITUDE in the after summary. It also checks that native Enter on Choose mission returns to mission selection with Launch focused. The accepted run has zero page errors. Screenshots were visually inspected for readable summary, coaching and accessible action buttons.

`review-recovery.mjs` supplies the controls-only crash pilot through the production InputManager. Its full method and limitations are documented in the 10.947 recovery review. No pose, velocity, gate or score writes are introduced here. `source-sha256.json` identifies the final runtime sources and markup. `production-smoke` separately checks the unmodified built page, its four featured missions, launch and Pause Retry.

The focused debrief, picker, course library, Contour, briefing, layout, paused-exclusion, HUD and version set passes 80 tests in nine files. Existing crash checks now assert a single failure reason, an explicit crash outcome in copied text, and no duplicated generic crash/ditch fallback. The production build and synchronized version check pass.

Reproduce using the same Playwright/Chromium setup as recovery: `RECOVERY_AFTER=1 RECOVERY_CHOOSE=1 node scripts/review-recovery.mjs <output>`. Serve the production build with Vite preview for the separate smoke check. This batch does not alter the in-flight runtime measured in 10.948, apart from release identity; its only functional code change is in post-flight report text.

# Ridge relay follow-up 11.042

Route engine and nitro audio from the stepped operation aircraft into the existing flight mixer. The operation pose exposes the resolved throttle, engine power, nitro activation and speed; the normal scene aircraft continues to supply audio outside the operation. This shared simulation path applies to both Model and Stick control. Opening Ridge relay resumes the audio context on the user gesture before the lazy import. The frame mute gate accepts an active operation without a scene flight, preserves settings, hidden-tab, pause and results muting, and resumes an active operation when the tab becomes visible. Context resumption remains independent of output muting, so unmuting after a tab return works in ordinary flights and operations. Nitro on/off cues use that same stepped operation aircraft. No sounds, assets or mixer synthesis were added.

Warm terrain through ingress before scored flight starts using one quadtree planner pass. Coverage and leaf refinement use the minimum distance to the player or an ingress corridor point, producing a single non-overlapping leaf set. This extends fine leaf coverage along ingress; it does not preserve a player-only leaf layout. Mesh density, LOD hysteresis and build priority use real distance from the player, rather than distance from a corridor point. The radius at each focus, worker limits, upload time budget and 16-upload cap are unchanged.

## Verified

- `tests/operationAudio.test.ts`: real stepped operation flights exercise the mapping used by `main.ts`, audible operation gating without `playing`, mute restrictions, scene fallback and nitro on/off cues while the scene simulation is idle. The mute and cue regressions failed before their respective fixes and passed afterward.
- `tests/terrainStreaming.test.ts`: seed-42 ingress at x=50, z=-200 through `stageEndZ(0)=2400` requests fine endpoint coverage with no desired parent/child overlap and fewer than 900 tiles. Actual build requests use player-distance LOD; the frozen-clock check retains the 16-upload cap. The overlap and density regressions failed before the fix and passed afterward.
- `tests/operationFlight.test.ts`: operation pose and flight behavior regression checks pass.
- Targeted Vitest runs: 90 terrain streaming/layout/LOD/seam tests passed; 39 audio/operation-flight tests passed.
- Full test suite: `npm test -- --testTimeout=0 --maxWorkers=4` passes: Vitest reports 3,303 passed, 0 failed and 9 skipped across 263 passing files (3,312 tests total). The Node frame-metrics wrapper also passes: 1 passed, 0 failed, 0 skipped. The 9 `requireArchiveGit` skips are environment-dependent: restricted runners may deny the synchronous Git archive probe. When that capability is available, those checks run and must pass; 9 is not a fixed skip count.
- Production build: `npm run build` passes. Vite reports its existing advisory that some chunks exceed 500 kB after minification.

## Not verified

A real browser flight is still unverified. Engine/nitro sound balance, audio playback in a browser, visible ground on the first rendered frames, physical Stick/gamepad operation and player-device frame performance were not manually verified. No real flight performance result is claimed. The seed-42 model score and replay verifier were not changed by these edits, but the operation paths were not flown in a browser for this chunk.

Roadmap items 11, 12 and 13 remain parked. Physics, scoring, seed-42 expectations and replay format were not changed.

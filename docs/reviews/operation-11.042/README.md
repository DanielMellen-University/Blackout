# Ridge relay follow-up 11.042

Route engine and nitro audio from the stepped operation aircraft into the existing flight mixer. The operation pose exposes the resolved throttle, engine power, nitro activation and speed; the normal scene aircraft continues to supply audio outside the operation. This shared simulation path applies to both Model and Stick control. No sounds, assets or mixer behavior were added.

Warm terrain through ingress before scored flight starts. The existing terrain planner keeps its current view radius, tile LOD, worker limits and upload budgets, with extra near-field focuses along the ingress leg retained in the desired tile request set.

## Verified

- `tests/operationAudio.test.ts`: the mixer mapping returns the stepped aircraft's throttle, resolved power, active nitro and speed, and no override when the operation aircraft is unavailable.
- `tests/terrainStreaming.test.ts`: a fine tile covering the far end of a corridor appears in the desired tile request set while the stream focus remains at the start.
- `tests/operationFlight.test.ts`: operation pose and flight behavior regression checks pass.
- Targeted Vitest run: 58 tests passed across the audio, terrain streaming and operation flight files.
- Full test suite: `npm test -- --testTimeout=0 --maxWorkers=4` passes, 3,287 passed and 9 skipped across 263 files (3,296 tests total).
- Production build: `npm run build` passes. Vite reports its existing advisory that some chunks exceed 500 kB after minification.

## Not verified

A real browser flight was not possible in this sandbox. Engine/nitro sound balance, audio playback in a browser, visible ground on the first rendered frames, physical Stick/gamepad operation and player-device frame performance were not manually verified. No real flight performance result is claimed. The seed-42 model score and replay verifier were not changed by these edits, but the operation paths were not flown in a browser for this chunk.

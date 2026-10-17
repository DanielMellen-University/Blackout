# CI baseline audit, chunk 10.910

Clean `origin/main` at `ea0c64d` reproduces 21 failures / 1,414 passes in
139 files on Node 22.23.2. The reported CI run has 20 failures / 1,415 passes;
the additional local failure is the five-seed water agreement test's 5 s timeout.

Eleven failures are stale golden expectations, independently reproduced by
running the unchanged tests on a detached clean `b0c6cbd` (10.891) checkout.
That predates the entire settlement overhaul. The documented 10.890 wetland and
shoreline changes and 10.891 coarse wet-bed correction intentionally changed
these outputs. No terrain or water generator is changed in this batch.

| Payload | Reproduced SHA-256 on both 10.891 and 10.909 |
| --- | --- |
| Terrain pond and cancellation restart | `a8035efe576eef94178dabce16ac856b9cac2927ca6b358d46f5bccd6e4212e4` |
| Terrain far water | `4de4bd5328eac688319cefe190d1113e2605ea3319172f33b01ce208ff8fb462` |
| Hydrology seed 42, -1,-1 | `5a0303d96158af7eafbb74a2c0f4c6ffbfe33bc720f4e7084d5fd6bc3f4f06bf` |
| Hydrology seed 42, 0,0 and seed/cancel paths | `e0323ffb8b05478947b280a63b218f56eef2f7ad84427939a9b56b8b67315b40` |
| Hydrology seed 42, 1,-1 | `11c47f9b81a756411437f5152d6146abad5b5a64fb58caa093cca5f9c49e8726` |
| Hydrology seed 1337, 1,-1 | `f498ce3da5409f88de5862823419c11ae542607bd8d3f62ff0b4433ee44c5fbb` |

Keep independent payload hashes, exact synchronous/cooperative equality,
interleaved builds, cancellation disposal and stale-world rejection. Unchanged
near/skirt/fallback/runway and other hydrology hashes remain pinned.

The other failures need separate repairs:

- Four budget-test timeouts execute real route searches against synthetic
  settlement plans. Isolate graph planning in this test file, retaining real
  route/profile/worker coverage in the dedicated generated-world tests. The
  retry test now measures admission calls and verifies reuse of canonical plans;
  its old generation-call assertion was accidentally satisfied by graph work.
- Settings CSS moved to `settingsDeck.css`; read both shipped stylesheets.
  Manual copy assertions follow the existing manual, and README history moves
  to the changelog to meet its existing length contract. Remove redundant
  paused-system wording from ordinary feature summaries; AGENTS and ROADMAP
  retain the exclusions.
- Seed 27 exposes a real Thermal Run route failure: the closest pocket is outside
  the allowed forward corridor, while another of the same nine pockets is
  eligible. Filter eligibility before nearest ranking. Retain terrain-clearance
  validation and the live lift envelope. No force calculation changes.
- Give the existing five-seed exact water agreement test 30 s for its CPU-heavy
  generated-world scan. Keep all coverage and zero-mismatch assertions.

The CI repair alone changes no obstacle geometry. The subsequent road-selection
slice advances ghost compatibility to revision 26 for its changed road placements;
saved records stay.


Validation after the combined batch: ordinary `npm test` passes 1,444 tests in
141 files; the production build and release metadata gate pass. No test is
skipped or removed by this repair. The five-seed agreement scan retains exact
zero-mismatch assertions.

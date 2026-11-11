# Ridge relay replay file 11.040

One completed run can leave the browser as JSON and be rescored from exact samples. Flight, scoring, cockpit, controls and existing results are unchanged.

`OperationSession.exportReplay()` returns file text for the latest saved finish, including after reload, or `null` when unavailable. Claims come from that result, even if an older run is best. The pure helper is `exportLatestOperationReplay(progress)`; there is no new UI.

## Format version 1

| Field | Content |
| --- | --- |
| `format`, `version` | `blackout-operation-replay`, `1` |
| `operationId`, `seed` | `ridge-relay`, integer 1 through 1,000,000,000 |
| `decisions` | `route`: valley or ridge; `energy`: conserve or commit |
| `flightMode` | Optional model or stick, only when known by the source |
| `samples` | Ingress, transit and egress arrays, at least two samples each |
| `claimed` | Integer scores in `stages.ingress`, `stages.transit`, `stages.egress` and `total` |
| `integrity` | `fnv1a64:` followed by 16 lowercase hexadecimal digits |

Samples have finite `t`, `x`, `y`, `z`, `speed`, `clearance` and boolean `airborne`. Optional `fuel` is 0 to 100 and `nitro` is 0 to 1. Units are seconds, metres and m/s. Time is nonnegative and strictly increases across all stages. Speed is nonnegative. Unknown fields are rejected. Browser transcripts record neither flight mode nor stick commands, so session exports omit them. The sample's model mode is known from its harness.

The checksum excludes `integrity`. Canonical JSON sorts every object's keys lexicographically, retains array order, uses JavaScript JSON number spelling and has no whitespace. FNV-1a 64 hashes UTF-8 bytes with offset `cbf29ce484222325` and prime `100000001b3`, wrapping to 64 bits per byte. Export adds a newline outside the hash. Formatting and object key order do not affect integrity. The checksum is not proof of authorship.

`parseOperationReplayFile` returns a file or a reason and field path. Duplicate object keys at any depth, including names equal after JSON escape decoding, are rejected as `duplicate-key` before parsing can discard them. `serializeOperationReplayFile` validates the same content, throwing `ReplayFileError` on invalid input. `verifyOperationReplayFile` uses the existing scorer and returns actual minus claimed differences for each stage and the total, including decision bonuses. Failed replays cannot match; unreached stage scores are null.

`operationReplaySummary` holds decisions, medal, total score and time, plus stage time, score, peak speed, minimum clearance, seeded gates and gate score. Verification rescores samples without simulating aircraft or certifying their source.

## Seed 42 sample

[seed-42-valley-commit.replay.json](seed-42-valley-commit.replay.json) comes from `flyOperation(42, 'valley', 'commit')` and its recorded scores. A test repeats the model harness and requires identical bytes. Earlier performance records are untouched.

| Stage | Score | Simulated time |
| --- | ---: | ---: |
| Ingress | 17,245 | 12.700 s |
| Transit | 18,737 | 11.900 s |
| Egress | 22,790 | 4.250 s |
| Total with decision bonuses | 61,472 gold | 28.850 s |

Run `npm run verify:operation -- docs/reviews/operation-11.040/seed-42-valley-commit.replay.json`. Exit codes: 0 match, 1 mismatch, 2 unreadable or invalid. Node 22 uses the installed Vite loader and existing scorer without a browser, listening port or network.

The Node 22.23.2 sandbox observations are separate from the independent run. In that sandbox the first candidate grew operation tests from 199 to 277 and Vitest from 3,126 to 3,204. Its default baseline had 14 failures, its default final run added a real-clock cockpit timing failure, and a one-worker 20 s run passed 3,195 with nine terrain-evidence checks failing on `spawnSync git EPERM`. The accepted candidate in that sandbox passed 291 operation/replay tests, and its full npm test passed 3,205 with 13 failures (nine git EPERM and four timeouts; a retry left the nine EPERM). No hydrology hash failures were reported there.

The independent Node 22.23.4 run, at default workers, passed all 291 operation/replay tests and all 3,218 Vitest tests. The Node script test, production build and version check passed, and `npm test` exited 0. No GUI or browser was exercised.

## Follow-ups 11.041

Invalid route, energy, airborne, negative time and negative speed report their exact field paths. Fuel and nitro range failures retain their precise paths. Flight and scoring rules are unchanged.

Import rejects JSON nesting beyond 32 containers as `too-deep`, with the path of the rejected container. Brackets inside strings do not count. The format itself needs only four container levels.

Import and export cap file size at 16 MiB of UTF-8, including whitespace and the export newline, reporting `too-large at $`. Oversized input is rejected before the JSON walk. This is above the live flight recorder’s 5,400-sample ceiling and does not change flight limits.

Boundary regression tests pin inclusive fuel/nitro limits, zero time/speed, safe integer claims, empty stages, non-object roots and exact stage-boundary time ordering. BOM-prefixed JSON and trailing non-whitespace data are rejected as `invalid-json`; JSON whitespace is allowed. Equivalent integer, decimal, exponent and signed-zero spellings share the same canonical checksum.

Export requires plain data records (ordinary or null prototype) with own enumerable data properties. Inherited fields, hidden fields and accessors are rejected as `invalid-shape`, preventing validation and hashing from seeing different content.

Error paths use dot notation for ordinary field names and JSON-quoted brackets for unusual names. Dots, brackets, quotes, newlines and terminal control characters inside a key remain unambiguous and escaped in CLI output.

Missing or extra CLI arguments print usage, the received argument count and the exit-code legend to stderr, with no score output and exit 2. They are reported as invocation mistakes rather than invalid replay content.

CLI read errors name the quoted input path and the filesystem error code. Directories and other non-regular inputs are rejected explicitly. Invalid JSON or replay content includes the filename as well as the validation reason and field path. All of these errors exit 2 and leave stdout empty.

The CLI checks the opened file’s type and byte length before decoding. Reads are bounded to the same 16 MiB budget (plus one detection byte), including when a file grows after inspection; descriptors close on success and failure. Nonblocking open avoids waiting on a FIFO.

`exportLatestOperationReplay` also returns `null` for malformed progress/history containers, not just malformed traces. It does not throw while attempting to find the latest saved result.

A new completed result clears the previous transcript if its own transcript is unavailable or has a different identity/decision path. This prevents an older flight on the same seed and decisions from being exported against a new result’s claims. Failed or unfinished attempts still retain the last completed replay.

# Four-theme completion verification, 10.977

Sequential native-wall-time controls-only production browser flights, Balanced at 1280x720 and device scale 1, ordinary adaptive resolution and full rendering cadence. RAF intervals include camera switches and still capture; the first ten intervals are omitted. Coverage is sampled after ten simulation seconds. Heap is sampled main-thread JS heap, not total browser or GPU memory. No local test suite runs during capture.

| Theme | Seed | Flight s | Medal | FPS | p95 ms | >50 ms | >100 ms | Worst ms | Heap peak MB |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| coastal-island-run | 1337 | 104.8 | gold | 41.9 | 33.4 | 24 | 1 | 433.4 | 102.4 |
| coastal-island-run | 2026 | 108.6 | gold | 37.5 | 49.9 | 29 | 1 | 450.0 | 106.9 |
| coastal-island-run | 9001 | 106.4 | gold | 36.5 | 50.0 | 61 | 1 | 383.3 | 103.6 |
| generated-volcanic-run | 1337 | 104.8 | gold | 36.1 | 50.0 | 68 | 1 | 383.3 | 116.1 |
| generated-volcanic-run | 2026 | 108.6 | gold | 36.1 | 50.0 | 66 | 1 | 366.6 | 126.9 |
| generated-volcanic-run | 9001 | 106.4 | gold | 35.6 | 50.0 | 82 | 1 | 433.3 | 112.8 |
| desert-run | 42 | 108.6 | gold | 36.7 | 50.0 | 58 | 1 | 366.6 | 68.5 |
| mountain-valley-run | 42 | 108.6 | gold | 34.3 | 50.0 | 134 | 1 | 333.3 | 78.0 |

All eight flights clear five gates, observe boost and five ordinary 25% gate refill calls, touch down inside the runway footprint and reach the existing landed/complete medal result. No sampled resident coverage misses occur after ten seconds in the 200 m square around the aircraft. Raw receipts retain stream pressure, LOD, controls, telemetry, contacts, refills, pictures and immutable source/pilot manifests. These sampled flights do not certify all seeds or long-duration memory behavior. Timing spikes are retained without attributing their cause or claiming a performance improvement.

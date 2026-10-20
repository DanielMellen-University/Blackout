# Completion and streaming measurements

Six sequential native-wall-time controls-only flights. Balanced at a 1280x720 viewport and device scale 1 with the ordinary adaptive resolution scaler, full rendering cadence, ordinary physics/streaming/collision/scoring. RAF intervals include camera changes and screenshot capture. First ten intervals are omitted from the frame summary; resident coverage is checked after ten simulation seconds. Heap is the sampled main-thread JS heap, not total browser/GPU memory.

| Theme | Seed | Flight s | FPS | p95 ms | >50 ms | >100 ms | Worst ms | Heap peak MB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desert-run | 1337 | 104.8 | 48.2 | 33.4 | 2 | 1 | 349.9 | 68.6 |
| desert-run | 2026 | 108.6 | 43.7 | 33.4 | 20 | 1 | 350.0 | 66.2 |
| desert-run | 9001 | 106.4 | 42.8 | 33.4 | 16 | 1 | 350.0 | 66.1 |
| mountain-valley-run | 1337 | 104.8 | 41.8 | 33.4 | 19 | 1 | 366.7 | 88.2 |
| mountain-valley-run | 2026 | 108.6 | 41.6 | 33.4 | 14 | 1 | 383.3 | 72.4 |
| mountain-valley-run | 9001 | 106.4 | 41.7 | 33.4 | 14 | 1 | 383.3 | 92.8 |

Every flight accepts five gates, observes boost and five ordinary nitro refills, touches down inside the runway footprint and reaches the normal landed/complete result. No resident terrain coverage misses occur after ten seconds in the 200 m square around the aircraft. These are sampled course flights, not an all-seed or long-duration certification. Raw receipts retain LOD, stream pressure, controls, telemetry and source hashes.

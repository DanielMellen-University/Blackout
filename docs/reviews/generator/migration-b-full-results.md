Sequential complete production-mode browser flights. Capture OFF, profiler OFF, fixed chase, balanced 1280x720, scale 1, native RAF, ordinary adaptive resolution. Timing begins after the launch panel hides. Omit only the first ten intervals; retain every remaining interval and strict >50/100 ms counts. No test, build or other browser overlaps timing. Heap is sampled main-thread used JS heap.

| Mission | Profile | Seed | Medal | FPS | p95 ms | >50 ms | >100 ms | Max ms | Heap MB |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| training-orbit | desert-run | 42 | gold | 49.3 | 33.4 | 7 | 0 | 66.7 | 71.5 |
| training-orbit | desert-run | 1337 | gold | 44.5 | 33.4 | 17 | 0 | 66.7 | 77.9 |
| training-orbit | desert-run | 9001 | gold | 42.7 | 33.4 | 26 | 0 | 66.7 | 78.0 |
| range-sweep | mountain-valley-run | 42 | gold | 42.9 | 33.4 | 29 | 0 | 66.7 | 99.9 |
| range-sweep | mountain-valley-run | 1337 | gold | 40.8 | 33.4 | 31 | 0 | 66.7 | 110.4 |
| range-sweep | mountain-valley-run | 9001 | gold | 42.8 | 33.4 | 20 | 0 | 66.7 | 101.0 |
| coastal-run | coastal-island-run | 42 | gold | 39.5 | 49.9 | 47 | 0 | 66.7 | 130.5 |
| coastal-run | coastal-island-run | 1337 | gold | 38.9 | 49.9 | 47 | 0 | 83.4 | 138.7 |
| coastal-run | coastal-island-run | 9001 | gold | 39.8 | 49.9 | 49 | 0 | 66.7 | 137.3 |
| volcanic-run | volcanic-run | 42 | gold | 41.5 | 33.4 | 25 | 0 | 66.8 | 95.5 |
| volcanic-run | volcanic-run | 1337 | gold | 40.7 | 33.4 | 42 | 0 | 66.8 | 125.7 |
| volcanic-run | volcanic-run | 9001 | gold | 41.0 | 33.4 | 38 | 0 | 100.0 | 124.9 |

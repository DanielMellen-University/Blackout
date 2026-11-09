# Ridge relay 11.038

The same three airborne stages can now be flown on the stick or left to the model. Stick mode is W/S pitch, A/D roll, Q/E rudder, Shift/Ctrl power and Space nitro. A standard gamepad uses the left stick for pitch and roll, the right stick for rudder, the triggers for power and the bottom face button for nitro.

Each stage measures the flown trace and adds that to the score: path deviation from the seeded line, altitude error against the briefed band, time inside the speed window, and fuel burned. Nitro burned off a commit leg also cuts the energy score. A failed stage still shows the measurements and banks nothing. The results screen lists ingress, transit and egress.

Valley or ridge, then conserve or commit, are unchanged. The featured row and the 82-course catalog stay unchanged.

## Measured model flight, seed 42

`npm run perf:operation` flew all four paths with the model. The wall clock for that run was 170.7 ms. The times below are simulated flight seconds at 1/60 s steps, not frames per second.

| Path | Result | Medal | Time | Peak speed | Min clearance |
| --- | --- | --- | --- | --- | --- |
| Valley, conserve | 57,741 | Silver | 36.900 s | 231.813 m/s | 121.901 m |
| Valley, commit | 61,472 | Gold | 28.850 s | 762.747 m/s | 126.849 m |
| Ridge, conserve | 42,947 | Bronze | 37.733 s | 232.969 m/s | 188.326 m |
| Ridge, commit | 56,521 | Silver | 28.100 s | 763.035 m/s | 198.887 m |

The model holds the lateral line. Altitude error is the climb or descent onto the next briefed band, so a stick pilot who arrives on altitude can outscore the model on that term. Valley stays lower than ridge. Commit still reaches the egress leg much faster than conserve. All four scores differ, and every path finishes airborne. The stage figures are in [performance.json](performance.json).

`?dev=operation` opens the operation from the flight plan on Stick. Model is the other control. The stage HUD shows the stick, the line, the altitude band, speed, fuel and nitro while the leg is flying.

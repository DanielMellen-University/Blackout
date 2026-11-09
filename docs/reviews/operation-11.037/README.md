# Ridge relay 11.037

One operation, three stages, finished in the air. Ingress, transit and egress are flown with the aircraft model on the dry desert profile. The flight-plan cards are unchanged.

After ingress the choice is valley or ridge. Valley is the low line and pays when transit clearance stays at or under 160 m. Ridge is the high line. After transit the choice is conserve or commit. Conserve stays slower on egress. Commit lights nitro on egress and pays when that leg peaks at or above 320 m/s.

Progress, the best result and the sample transcript are stored under `blackout.operation.ridge-relay`. Replaying the transcript rescores the same samples.

## Measured flight, seed 42

`npm run perf:operation` flew all four paths. The wall clock for that run was 165.9 ms. The times below are simulated flight seconds at 1/60 s steps, not frames per second.

| Path | Result | Medal | Time | Peak speed | Min clearance |
| --- | --- | --- | --- | --- | --- |
| Valley, conserve | 44,097 | Silver | 36.900 s | 231.813 m/s | 121.901 m |
| Valley, commit | 48,516 | Gold | 28.850 s | 762.747 m/s | 126.849 m |
| Ridge, conserve | 30,550 | Bronze | 37.733 s | 232.969 m/s | 188.326 m |
| Ridge, commit | 43,290 | Silver | 28.100 s | 763.035 m/s | 198.887 m |

Valley stays lower than ridge. Commit reaches the egress leg much faster than conserve. All four scores differ, and every path finishes airborne. The full stage breakdown is in [performance.json](performance.json).

Browser play of the operation is not wired into the flight-plan screen, so manual handling is unverified.

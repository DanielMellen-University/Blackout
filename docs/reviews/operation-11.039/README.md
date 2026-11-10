# Ridge relay 11.039

The three airborne stages can be flown from the cockpit camera. The stage HUD sits over the view. Rings and posts mark the gates, and a pair of walls marks the briefed altitude band for the leg in progress. During the route choice the valley and ridge bands are both shown. During the energy choice the conserve and commit bands are both shown.

Stick and model are unchanged. Stick is still W/S pitch, A/D roll, Q/E rudder, Shift/Ctrl power, Space nitro, and the same axes on a standard gamepad. The score is still the measured path, altitude, speed, fuel and nitro from the flight that was actually stepped. The run still finishes in the air.

The featured row stays Free flight, Training orbit and Daily challenge. The course catalog stays at 82.

## What was flown

Headless Chrome, WebGL through SwiftShader (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`), viewport 1280×720, `http://127.0.0.1:8098/?dev=operation`. Not port 5173.

The deck opens on Stick. Model was selected before the first scored step. Valley, then commit. Seed 42.

| | |
| --- | --- |
| Result | 61,472 gold |
| Time | 28.8 s simulated |
| Ingress | 17,245 · 12.7 s · path 0 m · alt 0 m |
| Transit | 18,737 · 11.9 s · path 0 m · alt 79 m |
| Egress | 22,790 · 4.2 s · path 0 m · alt 119 m · nitro 85% |

Those stage figures match the 11.038 model record. The 3D view mirrors that aircraft. It does not rescore it.

At 34% of ingress the cockpit showed the desert, the altitude walls, the next gate, and the HUD reading line 0 m, band 0 m, 206 m/s, 200 m clearance. The results card listed the three stages over the same desert. State stayed Airborne.

Rendered frame rate on this machine, 28 one-second samples during that flight: about 7 to 9 frames per second, with a low of 6.9 and a high of 9.0. A late frame advances at most eight physics steps, so the 28.8 s flight still finished in a 35.5 s page session that includes loading the world. That frame rate is SwiftShader, not a player GPU.

## Limits

The cockpit is the existing first-person seat camera. There is no interior canopy to look at.

Replay stays on the stage HUD. It does not move the 3D aircraft.

The operation is silent. The scene jet is only a mirror of the stepped aircraft, and the audio still follows the scene jet's own throttle.

The browser path was flown by the model so the score stays comparable to 11.038. Stick and the gamepad mapping are the same code as that release and are covered by the unit tests. A physical gamepad was not used in Chrome.

The ground is the operation's flat dry desert. Tiles stream in after the corridor opens, so the first moments can show the band and the gates before the terrain fills the view.

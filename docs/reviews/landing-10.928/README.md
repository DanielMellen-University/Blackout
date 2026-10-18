# Landing guidance, 10.928

The working tree was clean at cb51f2f. The original regression and landing stills were already committed in 10.925. No runtime cone or mode defect reproduced in this follow-up.

`all-modes.json` records refreshed seed-42 approaches in Free flight, Training Orbit and Thermal Run. All three use the actual generated runway, physics step, collision classifier, lights and HUD. Each probes nose and ground track at both signs of 35 degrees (hidden) and 20 degrees (visible), and directly checks both signs of the inclusive 30 degree boundary against 31 degrees. Paired chase/cockpit stills use 1280 x 720 at pixel ratio 1. Training Orbit and Thermal Run complete and display debriefs. Free flight remains exploration and continues on the ground.

The shared unit regression additionally checks all nine combinations of -30, 0 and 30 degree crab/drift at four runway headings and three speeds, rejecting measurable excess on either axis. The five focused files pass 66 checks. Production build and release metadata checks pass.

The stricter browser checks require non-null world guidance inside the cone, preventing a null-equals-null false pass. The first renewed Training review correctly accepted a landing but failed the inherited `onGround` assertion. Mission completion freezes simulation on accepted contact before the physics ground flag necessarily settles. The assertion now requires safe contact, no crash, completed mission and open results for mission modes, while Free flight must settle on the ground. `pilot/` retains that failed review attempt. This is a fixture correction, not a physics change.

The scripted trajectory is prescribed before each actual physics step. Mission gates are pre-completed to enter return. Manual control, complete gate flights, crosswind handling and arbitrary airfield terrain clearance remain unverified. The refreshed seed-42 evidence supplements the three-seed/six-approach review in 10.925. All six refreshed production camera stills and both debriefs are visually checked. Paused systems remain excluded.

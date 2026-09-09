# Asset attribution

Place aircraft and environment models here.

## Current bundle audit

The repository currently ships no external GLB, GLTF, audio, texture, or scanned
environment asset. The default aircraft is generated from TypeScript geometry,
and the flight audio is generated with Web Audio noise and oscillators. No
third-party attribution is required for the files currently committed.

## Expected files

| Path | Description |
|------|-------------|
| `f35.glb` | Primary F-35 model (optional). If missing, Blackout uses a built-in procedural F-35A silhouette. |

## Built-in procedural model

The default aircraft is a **code-generated F-35A-inspired mesh** (not a licensed 3D scan). Proportions approximate a real F-35A (about 15.7 m length, about 11 m span) with diverterless intakes, canted twin tails, clipped-delta wings, and RAM-gray panel texturing.

Visual polish is still in progress. A real GLB is optional and must be audited
below before it is committed.

## Optional: drop in a real GLB

1. Download a GLB/GLTF you have rights to use (for example Sketchfab CC models for personal projects).
2. Save as `public/models/f35.glb`.
3. Reload the app. Blackout auto-loads and scales it.

Example personal-use model (CC BY-NC-SA, **not bundled**; download yourself):

- [F-35 Lightning II by bohmerang on Sketchfab](https://sketchfab.com/3d-models/f-35-lightning-ii-fighter-jet-free-b1ab1c0090e34b0fbfe667e706023e6d)

## License notes

Only add assets with clear redistribution rights (CC0, CC-BY with credit, purchased licenses, or self-authored).

When you add a model, record:

- Source URL or author
- License
- Any required attribution text

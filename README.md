# Blackout

Browser arcade flight game. Pilot an F-35, take off, fly a short gate run low enough to see the ground, and land or crash. Roadmap chunk: **10.831**. New pilots begin in Training Orbit when no course preference exists.
Recent changes from **10.831**. Regional road planning now ranks candidate links with squared distances, preserving hub preference and nearest-spoke selection while removing connection-planner square roots.
Built with TypeScript, Three.js, and Vite. Current release: **v0.12.0** (`Systems expansion`). Previous roadmap chunk: **10.830**. Atmosphere startup and procedural audio noise now use deterministic seeds instead of unseeded randomness, keeping pre-reseed state and replay diagnostics repeatable without per-frame work.

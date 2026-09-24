#!/usr/bin/env python3
import zlib, base64, pathlib, sys
parts = []
i = 0
while True:
    p = pathlib.Path(f"scripts/.cam_restore_{i}.z64")
    if not p.exists():
        break
    parts.append(p.read_text().strip())
    i += 1
if not parts:
    sys.exit("no camera restore parts found")
raw = zlib.decompress(base64.b64decode("".join(parts)))
pathlib.Path("src/camera/CameraSystem.ts").write_bytes(raw)
assert b"setStormBuffet" in raw
print("restored CameraSystem.ts", len(raw))

from pathlib import Path
import json
import sys

phase = sys.argv[1]
data = json.loads(Path('.github/ship-frags/buffet_hud_polish_ops.json').read_text())
ops = data[phase]
for i, op in enumerate(ops):
    p = Path(op['path'])
    t = p.read_text()
    old, new = op['old'], op['new']
    count = t.count(old)
    if count != 1:
        raise SystemExit(f'{p} marker {i}: expected 1 match, got {count}')
    p.write_text(t.replace(old, new, 1))
    print(f'ok {p} #{i}')
print(phase, 'DONE')

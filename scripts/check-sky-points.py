"""Pixel regression for the isolated production star shader. Requires Pillow."""
import json
import sys
from pathlib import Path
from PIL import Image


def metrics(path):
    image = Image.open(path).convert("RGB")
    width, height = image.size
    lit = {i for i, pixel in enumerate(image.getdata()) if max(pixel) >= 40}
    areas = []
    while lit:
        todo = [lit.pop()]
        area = 0
        while todo:
            i = todo.pop()
            area += 1
            x, y = i % width, i // width
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                if not (0 <= x + dx < width and 0 <= y + dy < height):
                    continue
                neighbor = (y + dy) * width + x + dx
                if neighbor in lit:
                    lit.remove(neighbor)
                    todo.append(neighbor)
        areas.append(area)
    return {"components": len(areas), "litPixels": sum(areas),
            "meanArea": sum(areas) / max(1, len(areas)), "maxArea": max(areas, default=0)}


before, after = metrics(sys.argv[1]), metrics(sys.argv[2])
result = {"threshold": 40, "before": before, "after": after}
Path(sys.argv[3]).write_text(json.dumps(result, indent=2) + "\n")
assert after["components"] >= 10, "Stars disappeared"
assert after["meanArea"] < before["meanArea"] * .65, "Stars still occupy broad polygon cells"
assert after["maxArea"] <= 8, "Oversized star block remains"
print(json.dumps(result, indent=2))

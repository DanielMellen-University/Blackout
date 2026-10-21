"""Contact sheets for retained chase/cockpit review stills. No timing use."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw
part=sys.argv[1]
root=Path('docs/reviews/generator')/part
items=[]
for receipt in sorted(root.glob('*/run.json')):
 data=json.loads(receipt.read_text())
 for camera in ['chase','cockpit']:
  path=receipt.parent/f'gates-{camera}.jpg'
  if path.exists():items.append((path,f"{data['theme']} / {data['seed']} / {camera}"))
for start in range(0,len(items),48):
 group=items[start:start+48];canvas=Image.new('RGB',(1920,((len(group)+5)//6)*205),'#111827');draw=ImageDraw.Draw(canvas)
 for i,(path,label) in enumerate(group):
  x=(i%6)*320;y=(i//6)*205
  canvas.paste(Image.open(path).resize((320,180)),(x,y+25));draw.text((x+4,y+5),label,fill='white')
 target=root/f'contact-{start//48+1}.jpg';canvas.save(target,quality=91);print(target)

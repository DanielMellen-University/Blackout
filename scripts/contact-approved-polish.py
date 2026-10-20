"""Make labelled review sheets from retained Playwright stills, without changing originals."""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse
p=argparse.ArgumentParser();p.add_argument('part');p.add_argument('theme');p.add_argument('--before');p.add_argument('--seeds',default='73,808,2026');p.add_argument('--landing',action='store_true');a=p.parse_args()
root=Path('docs/reviews/generator');out=root/a.part/'sheets';out.mkdir(parents=True,exist_ok=True)
seeds=a.seeds.split(',')
if a.before:
 for seed in seeds:
  sheet=Image.new('RGB',(1280,768),'#111d32');draw=ImageDraw.Draw(sheet)
  for row,part in enumerate([a.before,a.part]):
   for col,camera in enumerate(['chase','cockpit']):
    file=root/part/f'{a.theme}-{seed}'/f'gates-{camera}.jpg'
    im=Image.open(file);im.thumbnail((640,360));sheet.paste(im,(col*640,row*384+24));draw.text((col*640+10,row*384+6),f'{part} / {seed} / {camera}',fill='white')
  sheet.save(out/f'{a.theme}-{seed}-comparison.jpg',quality=90)
else:
 names=['approach-cockpit.jpg','final.jpg'] if a.landing else ['gates-chase.jpg','gates-cockpit.jpg']
 sheet=Image.new('RGB',(1280,384*len(seeds)),'#111d32');draw=ImageDraw.Draw(sheet)
 for row,seed in enumerate(seeds):
  for col,name in enumerate(names):
   im=Image.open(root/a.part/f'{a.theme}-{seed}'/name);im.thumbnail((640,360));sheet.paste(im,(col*640,row*384+24));draw.text((col*640+10,row*384+6),f'{a.part} / {seed} / {name}',fill='white')
 sheet.save(out/(f'{a.theme}-'+('landings.jpg' if a.landing else 'gates.jpg')),quality=90)

"""Trim a transparent Cycles poster (render_poster.py) to its alpha bounding box and pad it to the
frame the hero and the explorer expect (514x826, bottom-centred).

    python3 scripts/blender/trim_poster.py data/plates/poster-m8.png public/samples/tower-m8-poster.png [../control-io-mobile/assets/images/tower-poster.png ...]
"""
import sys

from PIL import Image, ImageOps

FRAME = (514, 826)
PAD = 0.02  # fraction of the crop kept around the building

src, outs = sys.argv[1], sys.argv[2:]
im = Image.open(src).convert("RGBA")
bbox = im.getchannel("A").getbbox()
if bbox is None:
    raise SystemExit("poster is fully transparent")
x0, y0, x1, y1 = bbox
px, py = int((x1 - x0) * PAD), int((y1 - y0) * PAD)
crop = im.crop((max(0, x0 - px), max(0, y0 - py), min(im.width, x1 + px), min(im.height, y1 + py)))
out = ImageOps.pad(crop, FRAME, method=Image.LANCZOS, color=(0, 0, 0, 0), centering=(0.5, 1.0))
for o in outs:
    out.save(o, optimize=True)
    print("wrote", o, out.size)

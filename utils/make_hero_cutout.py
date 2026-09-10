"""Alpha-cut the ipomea scan for the homepage header.

Not part of generate_thumbnails.py: that pipeline turns img/ into the opaque
thumbnails/ and large/ sets the gallery serves. This is a one-off derivative
WITH an alpha channel, which is a different kind of asset, so it lands in
assets/ and the recipe is kept here.

    venv/bin/python utils/make_hero_cutout.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

SRC   = "large/Fragile Systems/08-14-2026 - ipomea - cp_ed_small.jpg"
OUT   = "assets/hero-ipomea.webp"
WIDTH = 760

# Where the sheet ends and the pencil begins, on the darkest of the three
# channels (paper is high on all three, coloured pencil is low on at least
# one). A ramp rather than a hard cut, so pencil edges stay soft.
PAPER, INK = 246.0, 227.0
# Everything below this much coverage is scan grain, not drawing. Subtracting
# it and rescaling is what keeps the dark theme from filling with white dust.
FLOOR = 0.12

im = Image.open(SRC).convert("RGB")
im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.Resampling.LANCZOS)
rgb = np.asarray(im).astype(np.float32)

# Median first: the scan's paper is not flat, and single speckled pixels a few
# levels below the threshold would otherwise survive as white dust once the
# drawing is put on a dark ground. A 3px median removes them and leaves every
# real stroke, which is wider than one pixel, untouched.
m = np.asarray(
    Image.fromarray(rgb.min(axis=2).astype(np.uint8), "L").filter(ImageFilter.MedianFilter(3))
).astype(np.float32)

alpha = np.clip((PAPER - m) / (PAPER - INK), 0.0, 1.0)
alpha = np.clip((alpha - FLOOR) / (1.0 - FLOOR), 0.0, 1.0)

# Every white goes, including the whites enclosed by the drawing - the bloom's
# throat and the circle inside the curl of the stem. Keeping those (by flooding
# the background in from the corners instead) was the first attempt and it is
# wrong in both directions at once: on cream it is invisible either way, and on
# the dark ground it left two opaque white plates sitting inside the plant. Let
# them go transparent and the page shows through, which is what the paper was
# doing there in the first place.

# An edge pixel is a mix: observed = a*ink + (1-a)*paper. Keeping the observed
# colour and only lowering alpha leaves the paper's white inside it - invisible
# on cream, a white fringe the moment the drawing is on a dark ground. Solving
# for the ink is what makes one file work on both.
paper_rgb = np.array([255.0, 254.0, 248.0], dtype=np.float32)
a3 = np.clip(alpha, 0.04, 1.0)[..., None]
ink = np.clip((rgb - (1.0 - a3) * paper_rgb) / a3, 0.0, 255.0)
rgb_out = np.where(alpha[..., None] < 0.999, ink, rgb)

cut = Image.fromarray(np.dstack([rgb_out, alpha * 255.0]).astype(np.uint8), "RGBA")

# Trim to where the drawing actually is - and NOT with getbbox(). A bounding
# box is decided by the single outermost surviving pixel, and on a scan that is
# always a speck of grain rather than a stroke: measured, the box it returned
# carried 135px of empty sheet above the bloom and 112px below the leaves for
# the sake of a few specks. The crop is taken from the distribution instead -
# walk in from each edge until 0.05% of the total ink has been passed - which
# lands on the plant and leaves the specks outside.
INK_MARGIN = 0.0005
PAD = 10

def span(v):
    c = np.cumsum(v) / v.sum()
    return int(np.searchsorted(c, INK_MARGIN)), int(np.searchsorted(c, 1 - INK_MARGIN))

x0, x1 = span(alpha.sum(axis=0))
y0, y1 = span(alpha.sum(axis=1))
cut = cut.crop((max(0, x0 - PAD), max(0, y0 - PAD),
                min(cut.width, x1 + PAD), min(cut.height, y1 + PAD)))

# Normalise the delivered width, since the crop above no longer guarantees one.
OUT_WIDTH = 700
cut = cut.resize((OUT_WIDTH, round(cut.height * OUT_WIDTH / cut.width)),
                 Image.Resampling.LANCZOS)

os.makedirs("assets", exist_ok=True)
cut.save(OUT, "WEBP", quality=80, method=6)
print(f"{OUT}  {cut.size}  {round(os.path.getsize(OUT)/1024)}KB  "
      f"fully transparent {round(float((alpha < 0.004).mean())*100)}%")

#!/usr/bin/env python3
"""
Generate web images for all gallery images:
  - thumbnails-300/  300px width  (grid, 1x displays and phones)
  - thumbnails/      600px width  (grid, 2x displays)
  - large/          2400px width  (lightbox) - also emits a sibling .webp
Always outputs .jpg, maintains aspect ratio, organizes by category.
HEIC/PDF originals are converted via sips (macOS built-in).

2400px matches the lightbox's on-screen cap (max-width: min(1200px, 90vw))
at 2x retina - anything larger is bytes the display can't use.

The grid renders each thumbnail in a ~288px slot on desktop and ~180px on a
phone, so 600px is the 2x candidate and 300px the 1x one; generate_index.py
offers both via srcset and lets the browser pick.
"""

from PIL import Image

# Allow very large originals (some scans exceed Pillow default pixel limit)
Image.MAX_IMAGE_PIXELS = None
import os
import subprocess
from pathlib import Path

IMG_DIR = "img"

# "Featured" is a curated overlay, not a category: its files are copies of works
# that also live in their home category folder, and the CSV keeps the home
# category plus a "Featured" tag. generate_index.py therefore derives every
# thumbnail path from the home category, so anything emitted under a Featured/
# subdirectory here would never be referenced - dead weight in the repo.
SKIP_DIRS = {"Featured"}

# (output_dir, max_width, jpeg_quality, also_emit_webp)
OUTPUTS = [
    ("thumbnails-300", 300, 82, True),  # grid thumbnails, 1x displays
    ("thumbnails", 600, 82, True),      # grid thumbnails, 2x displays
    ("large", 2400, 85, True),          # lightbox web versions
]

WEBP_QUALITY = 80

SUPPORTED = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.pdf']

print("🖼️  Starting image generation...\n")

# Track statistics
total_jobs = 0
generated = 0
skipped = 0
errors = 0


def make_resized(img_path, out_path, max_width, quality):
    """Create a resized .jpg from the original. Returns (width, height) string info."""
    if img_path.suffix.lower() in ['.heic', '.heif', '.pdf']:
        # Use sips (macOS built-in) to convert and resize
        result = subprocess.run(
            ['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', str(quality),
             '--resampleWidth', str(max_width),
             str(img_path), '--out', str(out_path)],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip())
        dims = subprocess.run(
            ['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', str(out_path)],
            capture_output=True, text=True
        ).stdout
        w = next((l.split()[-1] for l in dims.splitlines() if 'pixelWidth' in l), '?')
        h = next((l.split()[-1] for l in dims.splitlines() if 'pixelHeight' in l), '?')
        return f"{w}x{h}px (via sips)"

    # Open and process image with Pillow
    with Image.open(img_path) as img:
        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        width, height = img.size
        if width <= max_width:
            new_width, new_height = width, height
        else:
            new_width = max_width
            new_height = int((max_width / width) * height)

        if (new_width, new_height) != (width, height):
            img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        else:
            img_resized = img

        img_resized.save(out_path, 'JPEG', quality=quality, optimize=True)
        return f"{new_width}x{new_height}px"


def is_current(out_path, img_path, max_width):
    """An output counts as current only if it is newer than the original AND no
    wider than the cap that produced it.

    The mtime test alone is not enough: 53 thumbnails were still 1000px wide
    from before this script capped the grid at 600, and because they were newer
    than their originals every run skipped them, so the gallery kept shipping
    ~3x the pixels it could display. Checking the width makes a lowered cap
    actually take effect.
    """
    if not out_path.exists():
        return False
    if out_path.stat().st_mtime <= img_path.stat().st_mtime:
        return False
    try:
        with Image.open(out_path) as img:
            return img.size[0] <= max_width
    except Exception:
        # Unreadable/truncated output - regenerate it.
        return False


def make_webp(jpg_path, webp_path, quality):
    """Re-encode an already-resized .jpg as .webp (smaller at equivalent quality)."""
    with Image.open(jpg_path) as img:
        img.save(webp_path, 'WEBP', quality=quality)


# Walk through all category directories
for category_dir in Path(IMG_DIR).iterdir():
    if not category_dir.is_dir():
        continue

    category_name = category_dir.name
    if category_name.startswith('.'):
        continue
    if category_name in SKIP_DIRS:
        print(f"⏭  Skipping: {category_name} (overlay, served from home categories)")
        continue

    print(f"📁 Processing: {category_name}")

    for img_path in category_dir.glob('*'):
        if img_path.suffix.lower() not in SUPPORTED:
            continue

        for out_dir, max_width, quality, also_webp in OUTPUTS:
            total_jobs += 1

            out_category_dir = Path(out_dir) / category_name
            out_category_dir.mkdir(parents=True, exist_ok=True)

            out_path = out_category_dir / (img_path.stem + '.jpg')
            webp_path = out_category_dir / (img_path.stem + '.webp')

            # Skip if output already exists, is newer than original, and is sized
            # for the current cap
            jpg_fresh = is_current(out_path, img_path, max_width)
            webp_fresh = not also_webp or is_current(webp_path, img_path, max_width)

            if jpg_fresh and webp_fresh:
                skipped += 1
                continue

            try:
                if not jpg_fresh:
                    info = make_resized(img_path, out_path, max_width, quality)
                    print(f"  ✓ [{out_dir}] {img_path.name} → {info}")
                if also_webp and not webp_fresh:
                    make_webp(out_path, webp_path, WEBP_QUALITY)
                    print(f"  ✓ [{out_dir}] {img_path.name} → {webp_path.name}")
                generated += 1
            except Exception as e:
                errors += 1
                print(f"  ✗ [{out_dir}] Error processing {img_path.name}: {e}")

print("\n" + "="*60)
print("✓ Image generation complete!")
print("="*60)
print(f"  Total jobs (image × size): {total_jobs}")
print(f"  Generated: {generated}")
print(f"  Skipped (already exist): {skipped}")
print(f"  Errors: {errors}")
print("="*60)

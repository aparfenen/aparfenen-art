#!/usr/bin/env python3
"""
Generate web images for all gallery images:
  - thumbnails/  600px width  (grid)
  - large/      3500px width  (lightbox)
Always outputs .jpg, maintains aspect ratio, organizes by category.
HEIC/PDF originals are converted via sips (macOS built-in).
"""

from PIL import Image

# Allow very large originals (some scans exceed Pillow default pixel limit)
Image.MAX_IMAGE_PIXELS = None
import os
import subprocess
from pathlib import Path

IMG_DIR = "img"

# (output_dir, max_width, jpeg_quality)
OUTPUTS = [
    ("thumbnails", 600, 82),   # grid thumbnails
    ("large", 3500, 85),       # lightbox web versions
]

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


# Walk through all category directories
for category_dir in Path(IMG_DIR).iterdir():
    if not category_dir.is_dir():
        continue

    category_name = category_dir.name
    if category_name.startswith('.'):
        continue

    print(f"📁 Processing: {category_name}")

    for img_path in category_dir.glob('*'):
        if img_path.suffix.lower() not in SUPPORTED:
            continue

        for out_dir, max_width, quality in OUTPUTS:
            total_jobs += 1

            out_category_dir = Path(out_dir) / category_name
            out_category_dir.mkdir(parents=True, exist_ok=True)

            out_path = out_category_dir / (img_path.stem + '.jpg')

            # Skip if output already exists and is newer than original
            if out_path.exists() and out_path.stat().st_mtime > img_path.stat().st_mtime:
                skipped += 1
                continue

            try:
                info = make_resized(img_path, out_path, max_width, quality)
                generated += 1
                print(f"  ✓ [{out_dir}] {img_path.name} → {info}")
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

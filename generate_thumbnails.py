#!/usr/bin/env python3
"""
Generate thumbnails for all gallery images
Creates 1000px width thumbnails in .jpg format
Maintains aspect ratio and organizes by category
"""

from PIL import Image
import os
import subprocess
from pathlib import Path

IMG_DIR = "img"
THUMB_DIR = "thumbnails"
THUMBNAIL_WIDTH = 1000
QUALITY = 85  # JPEG quality (0-100)

print("🖼️  Starting thumbnail generation...\n")

# Create thumbnails directory
Path(THUMB_DIR).mkdir(exist_ok=True)

# Track statistics
total_images = 0
generated = 0
skipped = 0
errors = 0

# Walk through all category directories
for category_dir in Path(IMG_DIR).iterdir():
    if not category_dir.is_dir():
        continue

    category_name = category_dir.name
    if category_name.startswith('.'):
        continue

    # Create category subdirectory in thumbnails
    thumb_category_dir = Path(THUMB_DIR) / category_name
    thumb_category_dir.mkdir(exist_ok=True)

    print(f"📁 Processing: {category_name}")

    # Process all images in this category
    for img_path in category_dir.glob('*'):
        if img_path.suffix.lower() not in ['.jpg', '.jpeg', '.png', '.heic', '.heif']:
            continue

        total_images += 1

        # Generate thumbnail filename (always .jpg)
        thumb_filename = img_path.stem + '.jpg'
        thumb_path = thumb_category_dir / thumb_filename

        # Skip if thumbnail already exists and is newer than original
        if thumb_path.exists() and thumb_path.stat().st_mtime > img_path.stat().st_mtime:
            skipped += 1
            continue

        try:
            if img_path.suffix.lower() in ['.heic', '.heif']:
                # Use sips (macOS built-in) to convert and resize HEIC files
                result = subprocess.run(
                    ['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', str(QUALITY),
                     '--resampleWidth', str(THUMBNAIL_WIDTH),
                     str(img_path), '--out', str(thumb_path)],
                    capture_output=True, text=True
                )
                if result.returncode != 0:
                    raise RuntimeError(result.stderr.strip())
                dims = subprocess.run(
                    ['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', str(thumb_path)],
                    capture_output=True, text=True
                ).stdout
                w = next((l.split()[-1] for l in dims.splitlines() if 'pixelWidth' in l), '?')
                h = next((l.split()[-1] for l in dims.splitlines() if 'pixelHeight' in l), '?')
                generated += 1
                print(f"  ✓ {img_path.name} → {w}x{h}px (via sips)")
            else:
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
                    if width <= THUMBNAIL_WIDTH:
                        new_width, new_height = width, height
                    else:
                        new_width = THUMBNAIL_WIDTH
                        new_height = int((THUMBNAIL_WIDTH / width) * height)

                    if (new_width, new_height) != (width, height):
                        img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    else:
                        img_resized = img

                    img_resized.save(thumb_path, 'JPEG', quality=QUALITY, optimize=True)
                    generated += 1
                    print(f"  ✓ {img_path.name} → {new_width}x{new_height}px")

        except Exception as e:
            errors += 1
            print(f"  ✗ Error processing {img_path.name}: {e}")

print("\n" + "="*60)
print("✓ Thumbnail generation complete!")
print("="*60)
print(f"  Total images: {total_images}")
print(f"  Generated: {generated}")
print(f"  Skipped (already exist): {skipped}")
print(f"  Errors: {errors}")
print("="*60)

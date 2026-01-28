#!/usr/bin/env python3
"""
Generate thumbnails for all gallery images
Creates 1000px width thumbnails in .jpg format
Maintains aspect ratio and organizes by category
"""

from PIL import Image
import os
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
        if img_path.suffix.lower() not in ['.jpg', '.jpeg', '.png']:
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
            # Open and process image
            with Image.open(img_path) as img:
                # Convert to RGB if necessary (for PNG with transparency)
                if img.mode in ('RGBA', 'LA', 'P'):
                    # Create white background
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                # Calculate new dimensions maintaining aspect ratio
                width, height = img.size
                if width <= THUMBNAIL_WIDTH:
                    # Image is already smaller than thumbnail size
                    new_width, new_height = width, height
                else:
                    # Resize maintaining aspect ratio
                    new_width = THUMBNAIL_WIDTH
                    new_height = int((THUMBNAIL_WIDTH / width) * height)

                # Resize image with high-quality downsampling
                if (new_width, new_height) != (width, height):
                    img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                else:
                    img_resized = img

                # Save as JPEG
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

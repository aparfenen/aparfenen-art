import pandas as pd
from collections import defaultdict
import re
# aliased: generate_filter_sidebar() uses a local variable named `html` as its
# string accumulator, which would shadow a plain `import html`.
from html import escape as escape_html
from datetime import datetime
from pathlib import Path
from urllib.parse import quote as url_quote
from PIL import Image
import os

CSV_PATH = "gallery_metadata.csv"
CATEGORY_DESC_PATH = "category_descriptions.csv"  # FIXED: использую category вместо themes
INDEX_PATH = "index.html"
OUTPUT_PATH = "index.html"
IMG_DIR = "img"
THUMB_DIR = "thumbnails"          # 600px - 2x displays
THUMB_SMALL_DIR = "thumbnails-300"  # 300px - 1x displays and phones

# What the grid actually reserves for one thumbnail, so the browser can pick the
# right srcset candidate instead of always taking the largest:
#   <=768px   grid is repeat(auto-fill, minmax(150px, 1fr)) with a 10px gap over
#             the full viewport - 2 columns on a 375px phone, ~48vw each
#   <=1200px  minmax(240px, 1fr) with a 16px gap, 3 columns, ~33vw each
#   wider     the grid is capped at 1200px: 4 columns of (1200 - 3*16)/4 = 288px
GALLERY_SIZES = "(max-width: 768px) 50vw, (max-width: 1200px) 34vw, 288px"

START_MARKER = "<!-- START GALLERY -->"
END_MARKER = "<!-- END GALLERY -->"
FILTER_START_MARKER = "<!-- START FILTERS -->"
FILTER_END_MARKER = "<!-- END FILTERS -->"

print("🎨 Starting gallery generation...\n")

# ===== STEP 1: Auto-extract dates from filenames =====
def extract_date_from_filename(filename):
    """Extract date from filename patterns like: name2025.jpg, name_2025.jpg, 2025_name.jpg"""
    # Pattern 1: year at end (name2025.jpg)
    match = re.search(r'(\d{4})(?:\.\w+)?$', filename)
    if match:
        year = match.group(1)
        return f"1/1/{year}", year
    
    # Pattern 2: year in middle (name_2025_v2.jpg)
    match = re.search(r'[_-](\d{4})[_-]', filename)
    if match:
        year = match.group(1)
        return f"1/1/{year}", year
    
    # Pattern 3: full date (2025-03-15_name.jpg or 20250315_name.jpg)
    match = re.search(r'(\d{4})[-_]?(\d{2})[-_]?(\d{2})', filename)
    if match:
        year, month, day = match.groups()
        return f"{int(month)}/{int(day)}/{year}", year
    
    return None, None

def get_month_name(month_num):
    """Convert month number to month name"""
    months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December']
    try:
        return months[int(month_num)]
    except:
        return ''

# FIXED: Load category descriptions
category_descriptions = {}
try:
    desc_df = pd.read_csv(CATEGORY_DESC_PATH, sep=',')
    desc_df['category'] = desc_df['category'].str.strip()
    desc_df['description'] = desc_df['description'].str.strip()
    category_descriptions = dict(zip(desc_df['category'], desc_df['description']))
    print(f"✓ Loaded descriptions for {len(category_descriptions)} categories")
except FileNotFoundError:
    print(f"⚠ {CATEGORY_DESC_PATH} not found")
except Exception as e:
    print(f"⚠ Error loading category descriptions: {e}")

# Load CSV
df = pd.read_csv(CSV_PATH, sep=',')
df['category'] = df['category'].str.strip()
df['filename'] = df['filename'].str.strip()

print(f"✓ Loaded {len(df)} artworks from CSV\n")

# ===== STEP 2: Auto-fill year from show_date if missing =====
auto_filled_years = 0
for idx, row in df.iterrows():
    year_val = row.get('year')
    show_date = str(row.get('show_date', '')).strip()
    
    # If year is missing but show_date exists
    if (pd.isna(year_val) or str(year_val).strip() == '') and show_date:
        # Extract year from show_date (format: "Month YYYY")
        parts = show_date.split()
        if len(parts) >= 2:
            try:
                year = int(parts[1])
                if 1900 < year < 2100:  # Validate year range
                    df.at[idx, 'year'] = year
                    auto_filled_years += 1
                    print(f"  Auto-filled year for {row['title']}: {year} (from show_date)")
            except ValueError:
                pass

if auto_filled_years > 0:
    print(f"\n✓ Auto-filled {auto_filled_years} missing years from show_date")
    df.to_csv(CSV_PATH, index=False)
    print(f"✓ Updated {CSV_PATH} with auto-filled years\n")

# ===== STEP 3: Auto-fill missing dates from filenames =====
auto_filled_dates = 0
for idx, row in df.iterrows():
    filename = row['filename']
    year_val = row.get('year')

    if pd.isna(row.get('date_created')) or pd.isna(year_val) or str(year_val).strip() == '':
        date_created, year = extract_date_from_filename(filename)
        if date_created and year:
            df.at[idx, 'date_created'] = date_created
            df.at[idx, 'year'] = year

            # create show_date if missing
            if pd.isna(row.get('show_date')) or str(row.get('show_date', '')).strip() == '':
                parts = date_created.split('/')
                if len(parts) >= 2:
                    month_name = get_month_name(parts[0])
                    df.at[idx, 'show_date'] = f"{month_name} {year}"

            auto_filled_dates += 1
            print(f"  Auto-filled date for {filename}: {date_created}")

if auto_filled_dates > 0:
    print(f"\n✓ Auto-filled {auto_filled_dates} missing dates from filenames")
    df.to_csv(CSV_PATH, index=False)
    print(f"✓ Updated {CSV_PATH} with auto-filled dates\n")

# Fill NaN values
filter_columns = ['category', 'year', 'medium', 'tags']
for col in filter_columns:
    if col in df.columns:
        df[col] = df[col].fillna('').astype(str).str.strip()

# Filter by visibility
if 'visible' in df.columns:
    df['visible'] = df['visible'].fillna('').astype(str).str.strip().str.lower()
    df = df[df['visible'] == 'yes']
    print(f"✓ Filtered to {len(df)} visible artworks")

# ===== STEP 3: Parse and sort by dates =====
def parse_date(row):
    """
    Parse date with priority:
    1. date_finished (M/D/YYYY) - most precise
    2. date_created (M/YY) - month/year only
    3. show_date (Month YYYY) - text format
    """
    date_finished = str(row.get('date_finished', '')).strip()
    date_created = str(row.get('date_created', '')).strip()
    show_date = str(row.get('show_date', '')).strip()
    year_str = str(row.get('year', '')).strip()

    # Priority 1: date_finished (format: M/D/YYYY or MM/DD/YYYY)
    if date_finished and '/' in date_finished:
        parts = date_finished.split('/')
        if len(parts) == 3:  # M/D/YYYY
            try:
                month = int(parts[0])
                day = int(parts[1])
                year = int(parts[2])
                return datetime(year, month, day)
            except (ValueError, IndexError):
                pass

    # Priority 2: date_created (format: M/YY - month/year, e.g., "12/25" = December 2025)
    if date_created and '/' in date_created:
        parts = date_created.split('/')
        if len(parts) == 2:  # M/YY format
            try:
                month = int(parts[0])
                year_short = int(parts[1])
                # Convert YY to YYYY (25 -> 2025, 26 -> 2026)
                year = 2000 + year_short if year_short < 100 else year_short
                return datetime(year, month, 1)
            except (ValueError, IndexError):
                pass

    # Priority 3: show_date (format: "Month YYYY")
    if show_date:
        try:
            parsed = datetime.strptime(show_date, '%B %Y')
            return parsed
        except ValueError:
            pass

    # Fallback: use year only
    if year_str:
        try:
            year = int(float(year_str))
            return datetime(year, 1, 1)
        except (ValueError, TypeError):
            pass

    return datetime(1900, 1, 1)

df['parsed_date'] = df.apply(parse_date, axis=1)
df = df.sort_values('parsed_date', ascending=False)

print(f"✓ Sorted {len(df)} artworks chronologically (newest first)\n")

# ===== Precompute unique art-block ids =====
# Two works can share the same title (e.g. two pieces both called "Landscapes"),
# which used to produce duplicate DOM ids and broke deep-links (#slug always
# resolved to whichever one appeared first in the HTML).
def slugify(text):
    s = re.sub(r'[^\w\s-]', '', str(text).lower())
    s = re.sub(r'[-\s]+', '-', s).strip('-')
    return s

_base_slug_counts = df['title'].apply(slugify).value_counts()
_dup_base_slugs = set(_base_slug_counts[_base_slug_counts > 1].index)

_unique_ids = {}
_seen_ids = set()
for idx, row in df.iterrows():
    base = slugify(row['title'])
    if base in _dup_base_slugs:
        suffix = slugify(row.get('show_date', ''))
        candidate = f"{base}-{suffix}" if suffix else base
    else:
        candidate = base
    if candidate in _seen_ids:
        n = 2
        while f"{candidate}-{n}" in _seen_ids:
            n += 1
        candidate = f"{candidate}-{n}"
    _seen_ids.add(candidate)
    _unique_ids[idx] = candidate

if len(_dup_base_slugs) > 0:
    print(f"✓ Disambiguated {len(_dup_base_slugs)} duplicate title(s): {sorted(_dup_base_slugs)}\n")

_missing_fullsize = []

# ===== STEP 4: Collect filter values - FIXED =====
# Используем category как основную таксономию
unique_categories = sorted(df['category'].unique())
unique_categories = [c for c in unique_categories if c]

unique_years = sorted([str(int(float(y))) if pd.notna(y) and y != '' else y for y in df['year'].unique()], reverse=True)
unique_years = [y for y in unique_years if y]

# Collect unique mediums and tags
unique_mediums = []
unique_tags = []

if 'medium' in df.columns:
    mediums_raw = df['medium'].dropna().unique()
    unique_mediums = sorted([m.strip() for m in mediums_raw if m.strip()])

if 'tags' in df.columns:
    all_tags = set()
    for tags_str in df['tags'].dropna():
        if tags_str.strip():
            tags = [t.strip() for t in str(tags_str).split(',')]
            all_tags.update(tags)
    unique_tags = sorted([t for t in all_tags if t])

print(f"✓ Found filter values:")
print(f"  Categories: {len(unique_categories)}")
print(f"  Years: {len(unique_years)}")
print(f"  Mediums: {len(unique_mediums)}")
print(f"  Tags: {len(unique_tags)}\n")

# ===== STEP 5: Generate filter sidebar - FIXED =====
def generate_filter_sidebar():
    html = '    <div class="filter-header">\n'
    html += '      <h2>Filters</h2>\n'
    html += f'      <span id="artwork-counter">{len(df)} works</span>\n'
    html += '    </div>\n\n'
    
    # Search box
    html += '    <div class="filter-search-container">\n'
    html += '      <input type="text" id="filter-search" placeholder="Search artworks..." />\n'
    html += '    </div>\n\n'
    
    html += '    <button id="clear-filters">Clear All</button>\n\n'
    
    # FIXED: Categories filter
    if unique_categories:
        html += '    <div class="filter-section">\n'
        html += '      <div class="filter-section-header">Category</div>\n'
        html += '      <div class="filter-options">\n'
        for category in unique_categories:
            category_esc = escape_html(category)
            html += f'        <label class="filter-option">\n'
            html += f'          <input type="checkbox" class="filter-checkbox" data-filter-group="category" value="{category_esc}">\n'
            html += f'          <span class="filter-label">{category_esc}</span>\n'
            html += f'        </label>\n'
        html += '      </div>\n'
        html += '    </div>\n\n'
    
    if unique_years:
        html += '    <div class="filter-section">\n'
        html += '      <div class="filter-section-header">Year</div>\n'
        html += '      <div class="filter-options">\n'
        for year in unique_years:
            year_esc = escape_html(year)
            html += f'        <label class="filter-option">\n'
            html += f'          <input type="checkbox" class="filter-checkbox" data-filter-group="year" value="{year_esc}">\n'
            html += f'          <span class="filter-label">{year_esc}</span>\n'
            html += f'        </label>\n'
        html += '      </div>\n'
        html += '    </div>\n\n'
    
    # Medium filter removed - too large to display
    # if unique_mediums:
    #     html += '    <div class="filter-section collapsed">\n'
    #     html += '      <div class="filter-section-header">Medium</div>\n'
    #     html += '      <div class="filter-options">\n'
    #     for medium in unique_mediums:
    #         html += f'        <label class="filter-option">\n'
    #         html += f'          <input type="checkbox" class="filter-checkbox" data-filter-group="medium" value="{medium}">\n'
    #         html += f'          <span class="filter-label">{medium}</span>\n'
    #         html += f'        </label>\n'
    #     html += '      </div>\n'
    #     html += '    </div>\n\n'

    if unique_tags:
        html += '    <div class="filter-section collapsed">\n'  # FIXED: collapsed by default
        html += '      <div class="filter-section-header">Tags</div>\n'
        html += '      <div class="filter-options">\n'
        for tag in unique_tags:
            tag_esc = escape_html(tag)
            html += f'        <label class="filter-option">\n'
            html += f'          <input type="checkbox" class="filter-checkbox" data-filter-group="tags" value="{tag_esc}">\n'
            html += f'          <span class="filter-label">{tag_esc}</span>\n'
            html += f'        </label>\n'
        html += '      </div>\n'
        html += '    </div>\n\n'
    
    return html

# ===== Image dimensions / srcset helpers =====
# Every work is emitted twice (chronological + thematic view), so cache the
# header reads instead of opening ~650 files twice.
_dimension_cache = {}

def image_dimensions(path):
    """(width, height) of an image on disk, or None if it isn't there."""
    if path not in _dimension_cache:
        try:
            with Image.open(path) as img:
                _dimension_cache[path] = img.size
        except Exception:
            _dimension_cache[path] = None
    return _dimension_cache[path]


def srcset_candidates(*paths):
    """['small.jpg 300w', 'big.jpg 600w'] for whichever of `paths` exist on disk.

    Widths come from the files themselves rather than from the nominal cap,
    because a work whose original is narrower than the cap comes out smaller
    (one thumbnail is 376px) and a lying descriptor makes the browser pick the
    wrong candidate.

    URLs are percent-encoded, which is not cosmetic here: srcset splits
    candidates on whitespace, so "thumbnails/Between Waking/x.webp" parses as
    the URL "thumbnails/Between" plus the invalid descriptor "Waking/x.webp"
    and the candidate is dropped. Verified in headless Chrome: with the raw
    space the <source> stops matching and the browser silently falls back to
    the JPEG - which is what every category with a space in its name has been
    doing since WebP thumbnails were added.
    """
    candidates = []
    seen_widths = set()
    for path in paths:
        dims = image_dimensions(path)
        if dims is None or dims[0] in seen_widths:
            continue
        seen_widths.add(dims[0])
        candidates.append(f"{url_quote(path)} {dims[0]}w")
    return candidates


# ===== STEP 6: Generate artwork block - FIXED =====
def generate_artwork_block(row, include_id=True):
    # escape_html() (not just a bare .replace('"', '&quot;')) so a stray & < > "
    # in any field can't produce malformed attributes - title/show_date used to
    # go in completely unescaped, and everything else only had quotes handled.
    title_escaped = escape_html(str(row["title"]))
    show_date_escaped = escape_html(str(row["show_date"]))
    desc_escaped = escape_html(str(row["description"]))
    global _missing_fullsize
    dimensions = str(row.get("dimensions", "")).strip() if "dimensions" in row and pd.notna(row.get("dimensions")) else ""
    medium = str(row.get("medium", "")).strip() if "medium" in row and pd.notna(row.get("medium")) else ""
    tags = str(row.get("tags", "")).strip() if "tags" in row and pd.notna(row.get("tags")) else ""
    category = row.get("category", "").strip() if "category" in row else ""
    # FIXED: Convert year float (2025.0) to int string ("2025")
    year_raw = row.get("year", "")
    if pd.notna(year_raw) and str(year_raw).strip():
        try:
            year = str(int(float(year_raw)))
        except (ValueError, TypeError):
            year = str(year_raw).strip()
    else:
        year = ""

    dimensions_escaped = escape_html(dimensions)
    medium_escaped = escape_html(medium)
    tags_escaped = escape_html(tags)
    category_escaped = escape_html(category)
    year_escaped = escape_html(year)

    unique_id = _unique_ids[row.name]

    date_created = str(row.get("date_created", "")).strip() if "date_created" in row else ""
    date_created_escaped = escape_html(date_created)
    
    # Generate thumbnail filename (always .jpg regardless of original extension)
    filename_base = os.path.splitext(row["filename"])[0]
    thumbnail_path = f"{THUMB_DIR}/{row['category']}/{filename_base}.jpg"
    thumbnail_webp_path = f"{THUMB_DIR}/{row['category']}/{filename_base}.webp"
    thumbnail_webp_exists = os.path.exists(thumbnail_webp_path)
    thumbnail_small_path = f"{THUMB_SMALL_DIR}/{row['category']}/{filename_base}.jpg"
    thumbnail_small_webp_path = f"{THUMB_SMALL_DIR}/{row['category']}/{filename_base}.webp"
    # Lightbox uses web-sized large/ version (always .jpg, browser-safe, 2400px).
    large_path = f"large/{row['category']}/{filename_base}.jpg"
    large_webp_path = f"large/{row['category']}/{filename_base}.webp"
    if os.path.exists(large_path):
        full_image_path = large_path
        full_image_webp_path = large_webp_path if os.path.exists(large_webp_path) else ""
    else:
        # img/ is gitignored (local-only) - a data-full-src pointing there would
        # load fine in a local preview and then 404 once deployed, since GitHub
        # Pages never sees that folder. This bit the site before (see commit
        # d7e613b: "51 missing full-size images"): the previous fallback checked
        # img/ on disk and silently used it whenever it happened to exist locally,
        # so the break stayed invisible until deploy. Always fall back to the
        # thumbnail (which *is* deployed) instead, and warn so large/ gets
        # regenerated before pushing.
        full_image_path = thumbnail_path
        full_image_webp_path = ""
        _missing_fullsize.append(f"{row['category']}/{row['filename']} ({row['title']})")

    webp_attr = f'\n           data-full-src-webp="{full_image_webp_path}"' if full_image_webp_path else ""

    # width/height keep the grid slot reserved before the bytes arrive. The CSS
    # already pins every cell to aspect-ratio 3/4 with object-fit: cover, so
    # these are the intrinsic size of the file, not the rendered box - they only
    # matter for the moment before style.css applies.
    thumbnail_dims = image_dimensions(thumbnail_path)
    size_attrs = (f'\n           width="{thumbnail_dims[0]}" height="{thumbnail_dims[1]}"'
                  if thumbnail_dims else "")

    jpg_candidates = srcset_candidates(thumbnail_small_path, thumbnail_path)
    srcset_attr = (f'\n           srcset="{", ".join(jpg_candidates)}"'
                   f'\n           sizes="{GALLERY_SIZES}"') if len(jpg_candidates) > 1 else ""

    img_tag = f'''<img src="{thumbnail_path}"
           alt="{title_escaped}"
           loading="lazy"
           decoding="async"{size_attrs}{srcset_attr}
           data-full-src="{full_image_path}"{webp_attr}
           data-title="{title_escaped}"
           data-date="{show_date_escaped}"
           data-date-created="{date_created_escaped}"
           data-description="{desc_escaped}"
           data-dimensions="{dimensions_escaped}"
           data-medium="{medium_escaped}"
           data-tags="{tags_escaped}"
           data-category="{category_escaped}"
           data-year="{year_escaped}"
           data-id="{unique_id}" />'''

    if thumbnail_webp_exists:
        webp_candidates = srcset_candidates(thumbnail_small_webp_path, thumbnail_webp_path)
        img_tag = f'''<picture>
        <source srcset="{", ".join(webp_candidates)}"
                sizes="{GALLERY_SIZES}"
                type="image/webp" />
        {img_tag}
      </picture>'''

    # Every artwork is rendered twice - once in the chronological view, once
    # in its category section of the thematic view. Emitting id="{unique_id}"
    # both times produced 313 duplicate DOM ids (invalid HTML) and made
    # #hash deep-links resolve to whichever copy happened to come first in
    # the markup. Only the chronological copy (the default active view)
    # keeps the id; the thematic copy is still identifiable via data-id.
    id_attr = f' id="{unique_id}"' if include_id else ''
    block = f'''    <div class="art-block"{id_attr} data-hover-title="{title_escaped} ({show_date_escaped})">
      {img_tag}
    </div>'''
    return block

# ===== STEP 7: Build gallery HTML - FIXED =====
gallery_html = '\n  <div class="gallery-view-controls">\n'
gallery_html += '    <button id="chronological-view-btn" class="view-btn active">Chronological</button>\n'
gallery_html += '    <button id="thematic-view-btn" class="view-btn">By Category</button>\n'
gallery_html += '  </div>\n\n'

# Chronological view
gallery_html += '  <div id="chronological-gallery" class="gallery-container active">\n'
gallery_html += '    <div class="gallery">\n'
for _, row in df.iterrows():
    gallery_html += generate_artwork_block(row) + '\n'
gallery_html += '    </div>\n'
gallery_html += '  </div>\n\n'

# Thematic (category) view
gallery_html += '  <div id="thematic-gallery" class="gallery-container">\n'

grouped_by_category = defaultdict(list)
for _, row in df.iterrows():
    category = row.get("category", "").strip()
    if category:
        grouped_by_category[category].append(row)

# Sort categories by custom order
CATEGORY_ORDER = [
    "Nothing more than Human",
    "Animalia Forms", 
    "Echoes of Distance",
    "Between Waking",
    "Daydwellers",
    "Subconscious",
    "Underwater",
    "Fragile Systems",
    "Sketches",
    "Boston",
    "Postcards"
]
sorted_categories = [c for c in CATEGORY_ORDER if c in grouped_by_category]
# Add any missing categories
for c in grouped_by_category:
    if c not in sorted_categories:
        sorted_categories.append(c)

for category in sorted_categories:
    rows = grouped_by_category[category]
    anchor = category.lower().replace(" ", "-").replace("&", "and")
    
    gallery_html += f'  <div class="theme-section">\n'
    gallery_html += f'    <h3 id="{anchor}" class="section-title">{category}</h3>\n'
    
    if category in category_descriptions:
        gallery_html += f'    <p class="category-description">{category_descriptions[category]}</p>\n'
    
    gallery_html += '    <div class="gallery">\n'
    for row in rows:
        gallery_html += generate_artwork_block(row, include_id=False) + '\n'
    gallery_html += '    </div>\n'
    gallery_html += '  </div>\n\n'

gallery_html += '  </div>\n'

# ===== STEP 7b: Compute Activity stats (mirrors activity.js's own math) =====
# activity.js recomputes these from the CSV client-side and overwrites the
# static numbers on load - but the static numbers are what ships in the HTML
# (and what anyone/anything without JS sees), so they need to be regenerated
# here too instead of being hand-typed once and left to rot.
_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December']
_activity_counts = defaultdict(int)
for _, row in df.iterrows():
    show_date = str(row.get('show_date', '')).strip()
    if not show_date:
        continue
    try:
        parsed = datetime.strptime(show_date, '%B %Y')
    except ValueError:
        continue
    _activity_counts[(parsed.year, parsed.month)] += 1

total_works_stat = len(df)

if _activity_counts:
    # Tie-break on the later month, same rule as activity.js - otherwise a tie would
    # resolve by row order and the static number could disagree with the JS one.
    (_peak_year, _peak_month), _peak_count = max(_activity_counts.items(), key=lambda kv: (kv[1], kv[0]))
    most_productive_stat = f"{_MONTH_NAMES[_peak_month - 1][:3]} {_peak_year} ({_peak_count})"
else:
    most_productive_stat = ""

_current_year = datetime.now().year
current_year_stat = sum(c for (y, m), c in _activity_counts.items() if y == _current_year)

print(f"✓ Activity stats: {total_works_stat} total, peak {most_productive_stat}, {current_year_stat} this year\n")

# ===== STEP 8: Read and update index.html =====
with open(INDEX_PATH, "r", encoding="utf-8") as f:
    content = f.read()

if START_MARKER not in content or END_MARKER not in content:
    raise ValueError("Gallery markers not found in index.html")

before_gallery = content.split(START_MARKER)[0]
after_gallery = content.split(END_MARKER)[1]

filter_sidebar_html = generate_filter_sidebar()
if FILTER_START_MARKER in before_gallery and FILTER_END_MARKER in before_gallery:
    before_filter_section = before_gallery.split(FILTER_START_MARKER)[0]
    after_filter_section = before_gallery.split(FILTER_END_MARKER)[1]
    
    new_content = (f"{before_filter_section}{FILTER_START_MARKER}\n{filter_sidebar_html}"
                   f"{FILTER_END_MARKER}{after_filter_section}{START_MARKER}\n{gallery_html}\n{END_MARKER}{after_gallery}")
else:
    new_content = f"{before_gallery}{START_MARKER}\n{gallery_html}\n{END_MARKER}{after_gallery}"
    print("⚠ Filter markers not found - only gallery updated")

for _stat_id, _stat_value in (("total-works", total_works_stat),
                              ("most-productive-month", escape_html(most_productive_stat)),
                              ("current-year-count", current_year_stat)):
    new_content, _n = re.subn(rf'(id="{_stat_id}">)[^<]*(</div>)',
                              lambda m: f'{m.group(1)}{_stat_value}{m.group(2)}', new_content, count=1)
    if _n != 1:
        # A silent no-op here is exactly how the block drifted to stale numbers before.
        raise ValueError(f'Activity stat placeholder id="{_stat_id}" not found in index.html')

with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    f.write(new_content)

print("\n" + "="*60)
print("✓ index.html updated successfully!")
print("="*60)
print(f"  - {len(df)} artworks in chronological order")
print(f"  - {len(sorted_categories)} category sections")
print(f"  - {len(unique_mediums)} mediums")
print(f"  - {len(unique_tags)} tags")
print(f"  - Auto-filled {auto_filled_dates} dates from filenames")
if _missing_fullsize:
    print(f"  ⚠ {len(_missing_fullsize)} works have no large/ or img/ source - lightbox falls back to thumbnail:")
    for entry in _missing_fullsize:
        print(f"      - {entry}")
print("="*60)

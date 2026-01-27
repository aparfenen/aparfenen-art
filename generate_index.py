import pandas as pd
from collections import defaultdict
import re
from datetime import datetime
from pathlib import Path
import os

CSV_PATH = "gallery_metadata.csv"
CATEGORY_DESC_PATH = "category_descriptions.csv"  # FIXED: использую category вместо themes
INDEX_PATH = "index.html"
OUTPUT_PATH = "index.html"
IMG_DIR = "img"

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
    """Parse date using show_date for month/year, date_created for day if available."""
    show_date = str(row.get('show_date', '')).strip()
    date_created = str(row.get('date_created', '')).strip()
    year_str = str(row.get('year', '')).strip()
    
    if not show_date or not year_str:
        return datetime(1900, 1, 1)
    
    # Parse month from show_date (e.g., "March 2025")
    try:
        parsed = datetime.strptime(show_date, '%B %Y')
        
        # If date_created has full date, extract day
        if '/' in date_created:
            parts = date_created.split('/')
            if len(parts) == 3:  # M/D/YYYY format
                try:
                    day = int(parts[1])
                    parsed = parsed.replace(day=min(day, 28))
                except:
                    pass
        
        return parsed
    except:
        pass
    
    # Fallback: use year and month from date_created
    if '/' in date_created:
        parts = date_created.split('/')
        if len(parts) >= 2:
            try:
                month = int(parts[0])
                year = int(year_str)
                day = 1
                if len(parts) == 3:
                    day = int(parts[1])
                return datetime(year, month, day)
            except:
                pass
    
    return datetime(1900, 1, 1)

df['parsed_date'] = df.apply(parse_date, axis=1)
df = df.sort_values('parsed_date', ascending=False)

print(f"✓ Sorted {len(df)} artworks chronologically (newest first)\n")

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
            html += f'        <label class="filter-option">\n'
            html += f'          <input type="checkbox" class="filter-checkbox" data-filter-group="category" value="{category}">\n'
            html += f'          <span class="filter-label">{category}</span>\n'
            html += f'        </label>\n'
        html += '      </div>\n'
        html += '    </div>\n\n'
    
    if unique_years:
        html += '    <div class="filter-section">\n'
        html += '      <div class="filter-section-header">Year</div>\n'
        html += '      <div class="filter-options">\n'
        for year in unique_years:
            html += f'        <label class="filter-option">\n'
            html += f'          <input type="checkbox" class="filter-checkbox" data-filter-group="year" value="{year}">\n'
            html += f'          <span class="filter-label">{year}</span>\n'
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
            html += f'        <label class="filter-option">\n'
            html += f'          <input type="checkbox" class="filter-checkbox" data-filter-group="tags" value="{tag}">\n'
            html += f'          <span class="filter-label">{tag}</span>\n'
            html += f'        </label>\n'
        html += '      </div>\n'
        html += '    </div>\n\n'
    
    return html

# ===== STEP 6: Generate artwork block - FIXED =====
def generate_artwork_block(row):
    desc_escaped = str(row["description"]).replace('"', '&quot;')
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
    
    dimensions_escaped = dimensions.replace('"', '&quot;')
    medium_escaped = medium.replace('"', '&quot;')
    tags_escaped = tags.replace('"', '&quot;')
    category_escaped = category.replace('"', '&quot;')
    year_escaped = year.replace('"', '&quot;')
    
    unique_id = re.sub(r'[^\w\s-]', '', str(row["title"]).lower())
    unique_id = re.sub(r'[-\s]+', '-', unique_id).strip('-')
    
    date_created = str(row.get("date_created", "")).strip() if "date_created" in row else ""
    date_created_escaped = date_created.replace('"', '&quot;')
    
    block = f'''    <div class="art-block" id="{unique_id}" data-hover-title="{row["title"]} ({row["show_date"]})">
      <img src="img/{row["category"]}/{row["filename"]}"
           alt="{row["title"]}"
           loading="lazy"
           decoding="async"
           data-title="{row["title"]}"
           data-date="{row["show_date"]}"
           data-date-created="{date_created_escaped}"
           data-description="{desc_escaped}"
           data-dimensions="{dimensions_escaped}"
           data-medium="{medium_escaped}"
           data-tags="{tags_escaped}"
           data-category="{category_escaped}"
           data-year="{year_escaped}"
           data-id="{unique_id}" />
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
        gallery_html += generate_artwork_block(row) + '\n'
    gallery_html += '    </div>\n'
    gallery_html += '  </div>\n\n'

gallery_html += '  </div>\n'

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
print("="*60)

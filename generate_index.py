import pandas as pd
from collections import defaultdict
import re
from datetime import datetime
from pathlib import Path
import os

CSV_PATH = "gallery_metadata.csv"
THEMES_DESC_PATH = "themes_descriptions.csv"
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

# Load theme descriptions
theme_descriptions = {}
try:
    desc_df = pd.read_csv(THEMES_DESC_PATH, sep=',')
    desc_df['theme'] = desc_df['theme'].str.strip()
    desc_df['description'] = desc_df['description'].str.strip()
    theme_descriptions = dict(zip(desc_df['theme'], desc_df['description']))
    print(f"✓ Loaded descriptions for {len(theme_descriptions)} themes")
except FileNotFoundError:
    print("⚠ themes_descriptions.csv not found")
except Exception as e:
    print(f"⚠ Error loading theme descriptions: {e}")

# Load CSV
df = pd.read_csv(CSV_PATH, sep=',')
df['category'] = df['category'].str.strip()
df['filename'] = df['filename'].str.strip()

print(f"✓ Loaded {len(df)} artworks from CSV\n")

# ===== STEP 2: Auto-fill missing dates from filenames =====
auto_filled_dates = 0
for idx, row in df.iterrows():
    filename = row['filename']
    year_val = row.get('year')

    # БЫЛО: row.get('year', '').strip() -> падало, когда year = int
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
    # Save updated CSV
    df.to_csv(CSV_PATH, index=False)
    print(f"✓ Updated {CSV_PATH} with auto-filled dates\n")

# Fill NaN values
filter_columns = ['subject', 'mood', 'themes', 'year', 'medium', 'tags']
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

# ===== STEP 4: Collect filter values =====
SUBJECT_ORDER = ['Abstract & Structures', 'Science & Discoveries', 'Human Figures', 'Animalia Forms', 
                 'Surreal Scenes', 'Landscapes & Nature', 'Objects & Artifacts', 'Architecture & Space', 
                 'Sketches & Studies', 'Digital Experiments']
MOOD_ORDER = ['Calm & Contemplative', 'Tender & Intimate', 'Melancholic', 'Disquiet & Tension', 
              'Detached & Clinical', 'Liminal & Dreamlike', 'Intense & Ecstatic', 'Feral & Primal', 'Fear & Indifference']
THEMES_ORDER = ['Identity & Self', 'Transformation & Evolution', 'Memory & Time', 'Control & Entropy', 
                'Perception & Noise', 'Alienation & Belonging', 'Survival & Collapse', 'Death & Renewal']

unique_subjects_in_data = set(df['subject'].unique()) if 'subject' in df.columns else set()
unique_moods_in_data = set(df['mood'].unique()) if 'mood' in df.columns else set()
unique_themes_in_data = set(df['themes'].unique()) if 'themes' in df.columns else set()

unique_subjects = [s for s in SUBJECT_ORDER if s in unique_subjects_in_data and s]
unique_moods = [m for m in MOOD_ORDER if m in unique_moods_in_data and m]
unique_themes = [t for t in THEMES_ORDER if t in unique_themes_in_data and t]
unique_years = sorted(df['year'].unique(), reverse=True) if 'year' in df.columns else []
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
print(f"  Subjects: {len(unique_subjects)}")
print(f"  Moods: {len(unique_moods)}")
print(f"  Themes: {len(unique_themes)}")
print(f"  Years: {len(unique_years)}")
print(f"  Mediums: {len(unique_mediums)}")
print(f"  Tags: {len(unique_tags)}\n")

# ===== STEP 5: Generate filter sidebar =====
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
    
    if unique_subjects:
        html += '    <div class="filter-section">\n'
        html += '      <div class="filter-section-header">Subject</div>\n'
        html += '      <div class="filter-options">\n'
        for subject in unique_subjects:
            html += f'        <label class="filter-option">\n'
            html += f'          <input type="checkbox" class="filter-checkbox" data-filter-group="subject" value="{subject}">\n'
            html += f'          <span class="filter-label">{subject}</span>\n'
            html += f'        </label>\n'
        html += '      </div>\n'
        html += '    </div>\n\n'
    
    if unique_moods:
        html += '    <div class="filter-section">\n'
        html += '      <div class="filter-section-header">Mood</div>\n'
        html += '      <div class="filter-options">\n'
        for mood in unique_moods:
            html += f'        <label class="filter-option">\n'
            html += f'          <input type="checkbox" class="filter-checkbox" data-filter-group="mood" value="{mood}">\n'
            html += f'          <span class="filter-label">{mood}</span>\n'
            html += f'        </label>\n'
        html += '      </div>\n'
        html += '    </div>\n\n'
    
    if unique_themes:
        html += '    <div class="filter-section">\n'
        html += '      <div class="filter-section-header">Themes</div>\n'
        html += '      <div class="filter-options">\n'
        for theme in unique_themes:
            html += f'        <label class="filter-option">\n'
            html += f'          <input type="checkbox" class="filter-checkbox" data-filter-group="themes" value="{theme}">\n'
            html += f'          <span class="filter-label">{theme}</span>\n'
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
    
    if unique_mediums:
        html += '    <div class="filter-section">\n'
        html += '      <div class="filter-section-header">Medium</div>\n'
        html += '      <div class="filter-options">\n'
        for medium in unique_mediums:
            html += f'        <label class="filter-option">\n'
            html += f'          <input type="checkbox" class="filter-checkbox" data-filter-group="medium" value="{medium}">\n'
            html += f'          <span class="filter-label">{medium}</span>\n'
            html += f'        </label>\n'
        html += '      </div>\n'
        html += '    </div>\n\n'
    
    if unique_tags:
        html += '    <div class="filter-section">\n'
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

# ===== STEP 6: Generate artwork block =====
def generate_artwork_block(row):
    desc_escaped = str(row["description"]).replace('"', '&quot;')
    dimensions = str(row.get("dimensions", "")).strip() if "dimensions" in row and pd.notna(row.get("dimensions")) else ""
    medium = str(row.get("medium", "")).strip() if "medium" in row and pd.notna(row.get("medium")) else ""
    tags = str(row.get("tags", "")).strip() if "tags" in row and pd.notna(row.get("tags")) else ""
    
    subject = row.get("subject", "").strip() if "subject" in row else ""
    mood = row.get("mood", "").strip() if "mood" in row else ""
    themes = row.get("themes", "").strip() if "themes" in row else ""
    year = row.get("year", "").strip() if "year" in row else ""
    
    dimensions_escaped = dimensions.replace('"', '&quot;')
    medium_escaped = medium.replace('"', '&quot;')
    tags_escaped = tags.replace('"', '&quot;')
    subject_escaped = subject.replace('"', '&quot;')
    mood_escaped = mood.replace('"', '&quot;')
    themes_escaped = themes.replace('"', '&quot;')
    year_escaped = year.replace('"', '&quot;')
    
    unique_id = re.sub(r'[^\w\s-]', '', str(row["title"]).lower())
    unique_id = re.sub(r'[-\s]+', '-', unique_id).strip('-')
    
    date_created = str(row.get("date_created", "")).strip() if "date_created" in row else ""
    date_created_escaped = date_created.replace('"', '&quot;')
    
    block = f'''    <div class="art-block" id="{unique_id}">
      <img src="img/{row["category"]}/{row["filename"]}"
           alt="{row["title"]}"
           title="{row["title"]} ({row["show_date"]})"
           data-title="{row["title"]}"
           data-date="{row["show_date"]}"
           data-date-created="{date_created_escaped}"
           data-description="{desc_escaped}"
           data-dimensions="{dimensions_escaped}"
           data-medium="{medium_escaped}"
           data-tags="{tags_escaped}"
           data-subject="{subject_escaped}"
           data-mood="{mood_escaped}"
           data-themes="{themes_escaped}"
           data-year="{year_escaped}"
           data-id="{unique_id}" />
    </div>'''
    return block

# ===== STEP 7: Build gallery HTML =====
gallery_html = '\n  <div class="gallery-view-controls">\n'
gallery_html += '    <button id="chronological-view-btn" class="view-btn active">Chronological</button>\n'
gallery_html += '    <button id="thematic-view-btn" class="view-btn">By Themes</button>\n'
gallery_html += '  </div>\n\n'

gallery_html += '  <div id="chronological-gallery" class="gallery-container active">\n'
gallery_html += '    <div class="gallery">\n'
for _, row in df.iterrows():
    gallery_html += generate_artwork_block(row) + '\n'
gallery_html += '    </div>\n'
gallery_html += '  </div>\n\n'

gallery_html += '  <div id="thematic-gallery" class="gallery-container">\n'

grouped_by_theme = defaultdict(list)
for _, row in df.iterrows():
    theme = row.get("themes", "").strip()
    if theme:
        grouped_by_theme[theme].append(row)

sorted_themes = [t for t in THEMES_ORDER if t in grouped_by_theme]

for theme in sorted_themes:
    rows = grouped_by_theme[theme]
    anchor = theme.lower().replace(" ", "-").replace("&", "and")
    
    gallery_html += f'  <div class="theme-section">\n'
    gallery_html += f'    <h3 id="{anchor}" class="section-title">{theme}</h3>\n'
    
    if theme in theme_descriptions:
        gallery_html += f'    <p class="category-description">{theme_descriptions[theme]}</p>\n'
    
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
print(f"  - {len(sorted_themes)} theme sections")
print(f"  - {len(unique_mediums)} mediums")
print(f"  - {len(unique_tags)} tags")
print(f"  - Auto-filled {auto_filled_dates} dates from filenames")
print("="*60)

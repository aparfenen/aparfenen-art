import pandas as pd
from collections import defaultdict
import re
from datetime import datetime

# 🎨🎨🎨 CONFIG 🎨🎨🎨
CSV_PATH = "gallery_metadata.csv"
THEMES_DESC_PATH = "themes_descriptions.csv"
INDEX_PATH = "index.html"
OUTPUT_PATH = "index.html"

START_MARKER = "<!-- START GALLERY -->"
END_MARKER = "<!-- END GALLERY -->"
FILTER_START_MARKER = "<!-- START FILTERS -->"
FILTER_END_MARKER = "<!-- END FILTERS -->"

# 🎨🎨🎨 LOAD THEME DESCRIPTIONS 🎨🎨🎨
theme_descriptions = {}
try:
    desc_df = pd.read_csv(THEMES_DESC_PATH, sep=',')
    desc_df['theme'] = desc_df['theme'].str.strip()
    desc_df['description'] = desc_df['description'].str.strip()
    theme_descriptions = dict(zip(desc_df['theme'], desc_df['description']))
    print(f"✓ Loaded descriptions for {len(theme_descriptions)} themes")
except FileNotFoundError:
    print("⚠ themes_descriptions.csv not found - themes will have no descriptions")
except Exception as e:
    print(f"⚠ Error loading theme descriptions: {e}")

# 🎨🎨🎨 LOAD CSV 🎨🎨🎨
df = pd.read_csv(CSV_PATH, sep=',')
df['category'] = df['category'].str.strip()
df['filename'] = df['filename'].str.strip()

# Fill NaN values in new filter columns with empty strings
filter_columns = ['subject', 'mood', 'themes', 'year']
for col in filter_columns:
    if col in df.columns:
        df[col] = df[col].fillna('').astype(str).str.strip()

# 🎨🎨🎨 FILTER BY VISIBILITY 🎨🎨🎨
if 'visible' in df.columns:
    df['visible'] = df['visible'].str.strip().str.lower()
    df = df[df['visible'] == 'yes']
    print(f"✓ Filtered to {len(df)} visible artworks")
else:
    print("⚠ No 'visible' column found - showing all artworks")

# 🎨🎨🎨 PARSE DATES FOR CHRONOLOGICAL SORTING 🎨🎨🎨
def parse_date(date_str):
    """Parse various date formats and return a sortable datetime object."""
    if pd.isna(date_str) or not date_str:
        return datetime(1900, 1, 1)
    
    date_str = str(date_str).strip()
    
    # Try different formats
    formats = [
        '%m/%d/%Y',  # 07/28/2025
        '%m/%d/%y',  # 7/28/25
        '%m/%d',     # 7/21
        '%m/%y',     # 8/25
    ]
    
    for fmt in formats:
        try:
            parsed = datetime.strptime(date_str, fmt)
            # If year is missing, assume 2020s
            if parsed.year < 1950:
                parsed = parsed.replace(year=2020 + (parsed.year % 100))
            return parsed
        except:
            continue
    
    # If all parsing fails, return minimum date
    return datetime(1900, 1, 1)

df['parsed_date'] = df['date_created'].apply(parse_date)
df = df.sort_values('parsed_date', ascending=False)  # Most recent first

print(f"✓ Sorted {len(df)} artworks chronologically")

# 🎨🎨🎨 COLLECT UNIQUE FILTER VALUES IN SPECIFIC ORDER 🎨🎨🎨
# Define order of categories
SUBJECT_ORDER = [
    'Abstract & Structures',
    'Science & Discoveries',
    'Human Figures',
    'Animalia Forms',
    'Surreal Scenes',
    'Landscapes & Nature',
    'Objects & Artifacts',
    'Architecture & Space',
    'Sketches & Studies',
    'Digital Experiments'
]

MOOD_ORDER = [
    'Calm & Contemplative',
    'Tender & Intimate',
    'Melancholic',
    'Disquiet & Tension',
    'Detached & Clinical',
    'Liminal & Dreamlike',
    'Intense & Ecstatic',
    'Feral & Primal',
    'Fear & Indifference'
]

THEMES_ORDER = [
    'Identity & Self',
    'Transformation & Evolution',
    'Memory & Time',
    'Control & Entropy',
    'Perception & Noise',
    'Alienation & Belonging',
    'Survival & Collapse',
    'Death & Renewal'
]

# Get unique values that exist in data, in the defined order
unique_subjects_in_data = set(df['subject'].unique()) if 'subject' in df.columns else set()
unique_moods_in_data = set(df['mood'].unique()) if 'mood' in df.columns else set()
unique_themes_in_data = set(df['themes'].unique()) if 'themes' in df.columns else set()

unique_subjects = [s for s in SUBJECT_ORDER if s in unique_subjects_in_data and s]
unique_moods = [m for m in MOOD_ORDER if m in unique_moods_in_data and m]
unique_themes = [t for t in THEMES_ORDER if t in unique_themes_in_data and t]
unique_years = sorted(df['year'].unique(), reverse=True) if 'year' in df.columns else []
unique_years = [y for y in unique_years if y]

print(f"\n✓ Found filter values:")
print(f"  Subjects: {len(unique_subjects)}")
print(f"  Moods: {len(unique_moods)}")
print(f"  Themes: {len(unique_themes)}")
print(f"  Years: {len(unique_years)}")

# 🎨🎨🎨 GENERATE FILTER SIDEBAR HTML 🎨🎨🎨
def generate_filter_sidebar():
    html = '    <div class="filter-header">\n'
    html += '      <h2>Filters</h2>\n'
    html += f'      <span id="artwork-counter">{len(df)} works</span>\n'
    html += '    </div>\n'
    html += '    <button id="clear-filters">Clear All</button>\n\n'
    
    # Subject filter
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
    
    # Mood filter
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
    
    # Themes filter
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
    
    # Year filter
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
    
    return html

# 🎨🎨🎨 GENERATE ARTWORK BLOCK 🎨🎨🎨
def generate_artwork_block(row):
    """Generate HTML for a single artwork block."""
    # Escape quotes in description for data attribute
    desc_escaped = str(row["description"]).replace('"', '&quot;')
    
    # Get dimensions and medium (optional fields)
    dimensions = str(row.get("dimensions", "")).strip() if "dimensions" in row and pd.notna(row.get("dimensions")) else ""
    medium = str(row.get("medium", "")).strip() if "medium" in row and pd.notna(row.get("medium")) else ""
    
    # Get filter attributes
    subject = row.get("subject", "").strip() if "subject" in row else ""
    mood = row.get("mood", "").strip() if "mood" in row else ""
    themes = row.get("themes", "").strip() if "themes" in row else ""
    year = row.get("year", "").strip() if "year" in row else ""
    
    # Escape for data attributes
    dimensions_escaped = dimensions.replace('"', '&quot;')
    medium_escaped = medium.replace('"', '&quot;')
    subject_escaped = subject.replace('"', '&quot;')
    mood_escaped = mood.replace('"', '&quot;')
    themes_escaped = themes.replace('"', '&quot;')
    year_escaped = year.replace('"', '&quot;')
    
    # Generate unique ID from title
    unique_id = re.sub(r'[^\w\s-]', '', str(row["title"]).lower())
    unique_id = re.sub(r'[-\s]+', '-', unique_id).strip('-')
    
    # Get date_created for activity tracking
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
           data-subject="{subject_escaped}"
           data-mood="{mood_escaped}"
           data-themes="{themes_escaped}"
           data-year="{year_escaped}"
           data-id="{unique_id}" />
    </div>'''
    return block

# 🎨🎨🎨 BUILD CHRONOLOGICAL GALLERY HTML 🎨🎨🎨
gallery_html = '\n  <div class="gallery-view-controls">\n'
gallery_html += '    <button id="chronological-view-btn" class="view-btn active">Chronological</button>\n'
gallery_html += '    <button id="thematic-view-btn" class="view-btn">By Themes</button>\n'
gallery_html += '  </div>\n\n'

# Chronological view (default)
gallery_html += '  <div id="chronological-gallery" class="gallery-container active">\n'
gallery_html += '    <div class="gallery">\n'
for _, row in df.iterrows():
    gallery_html += generate_artwork_block(row) + '\n'
gallery_html += '    </div>\n'
gallery_html += '  </div>\n\n'

# Thematic view (grouped by themes)
gallery_html += '  <div id="thematic-gallery" class="gallery-container">\n'

grouped_by_theme = defaultdict(list)
for _, row in df.iterrows():
    theme = row.get("themes", "").strip()
    if theme:
        grouped_by_theme[theme].append(row)

# Sort themes by the order defined
sorted_themes = [t for t in THEMES_ORDER if t in grouped_by_theme]

for theme in sorted_themes:
    rows = grouped_by_theme[theme]
    anchor = theme.lower().replace(" ", "-").replace("&", "and")
    
    gallery_html += f'  <div class="theme-section">\n'
    gallery_html += f'    <h3 id="{anchor}" class="section-title">{theme}</h3>\n'
    
    # Add theme description if available
    if theme in theme_descriptions:
        gallery_html += f'    <p class="category-description">{theme_descriptions[theme]}</p>\n'
    
    # Add gallery grid
    gallery_html += '    <div class="gallery">\n'
    for row in rows:
        gallery_html += generate_artwork_block(row) + '\n'
    gallery_html += '    </div>\n'
    gallery_html += '  </div>\n\n'

gallery_html += '  </div>\n'

# 🎨🎨🎨 READ INDEX.HTML 🎨🎨🎨
with open(INDEX_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Update gallery content
if START_MARKER not in content or END_MARKER not in content:
    raise ValueError("Gallery markers not found in index.html")

before_gallery = content.split(START_MARKER)[0]
after_gallery = content.split(END_MARKER)[1]

# Update filters if markers exist
filter_sidebar_html = generate_filter_sidebar()
if FILTER_START_MARKER in before_gallery and FILTER_END_MARKER in before_gallery:
    # Filters are before gallery
    before_filter_section = before_gallery.split(FILTER_START_MARKER)[0]
    after_filter_section = before_gallery.split(FILTER_END_MARKER)[1]
    
    new_content = (f"{before_filter_section}{FILTER_START_MARKER}\n{filter_sidebar_html}"
                   f"{FILTER_END_MARKER}{after_filter_section}{START_MARKER}\n{gallery_html}\n{END_MARKER}{after_gallery}")
else:
    # No filter markers, just update gallery
    new_content = f"{before_gallery}{START_MARKER}\n{gallery_html}\n{END_MARKER}{after_gallery}"
    print("⚠ Filter markers not found - only gallery updated")

# 🎨🎨🎨 SAVE 🎨🎨🎨
with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    f.write(new_content)

print("✓ index.html updated with chronological gallery and thematic view")
print(f"  - {len(df)} artworks in chronological order")
print(f"  - {len(sorted_themes)} theme sections")

import pandas as pd
from collections import defaultdict
import re

# 􁾤􁾤􁾤 CONFIG 􁾤􁾤􁾤
CSV_PATH = "gallery_metadata.csv"
CATEGORY_DESC_PATH = "category_descriptions.csv"
INDEX_PATH = "index.html"
OUTPUT_PATH = "index.html"

START_MARKER = "<!-- START GALLERY -->"
END_MARKER = "<!-- END GALLERY -->"
FILTER_START_MARKER = "<!-- START FILTERS -->"
FILTER_END_MARKER = "<!-- END FILTERS -->"

# 􁾤􁾤􁾤 LOAD CATEGORY DESCRIPTIONS 􁾤􁾤􁾤
category_descriptions = {}
try:
    desc_df = pd.read_csv(CATEGORY_DESC_PATH, sep=',')
    desc_df['category'] = desc_df['category'].str.strip()
    desc_df['description'] = desc_df['description'].str.strip()
    category_descriptions = dict(zip(desc_df['category'], desc_df['description']))
    print(f"✔ Loaded descriptions for {len(category_descriptions)} categories")
except FileNotFoundError:
    print("⚠ category_descriptions.csv not found - categories will have no descriptions")
except Exception as e:
    print(f"⚠ Error loading category descriptions: {e}")

# 􁾤􁾤􁾤 LOAD CSV 􁾤􁾤􁾤
df = pd.read_csv(CSV_PATH, sep=',')
df['category'] = df['category'].str.strip()
df['filename'] = df['filename'].str.strip()

# Fill NaN values in new filter columns with empty strings
filter_columns = ['subject', 'mood', 'themes', 'year']
for col in filter_columns:
    if col in df.columns:
        df[col] = df[col].fillna('').astype(str).str.strip()

# 􁾤􁾤􁾤 FILTER BY VISIBILITY 􁾤􁾤􁾤
if 'visible' in df.columns:
    df['visible'] = df['visible'].str.strip().str.lower()
    df = df[df['visible'] == 'yes']
    print(f"✔ Filtered to {len(df)} visible artworks")
else:
    print("⚠ No 'visible' column found - showing all artworks")

# 􁾤􁾤􁾤 COLLECT UNIQUE FILTER VALUES 􁾤􁾤􁾤
unique_subjects = sorted(df['subject'].unique()) if 'subject' in df.columns else []
unique_moods = sorted(df['mood'].unique()) if 'mood' in df.columns else []
unique_themes = sorted(df['themes'].unique()) if 'themes' in df.columns else []
unique_years = sorted(df['year'].unique(), reverse=True) if 'year' in df.columns else []

# Remove empty strings
unique_subjects = [s for s in unique_subjects if s]
unique_moods = [m for m in unique_moods if m]
unique_themes = [t for t in unique_themes if t]
unique_years = [y for y in unique_years if y]

print(f"\n✔ Found filter values:")
print(f"  Subjects: {len(unique_subjects)}")
print(f"  Moods: {len(unique_moods)}")
print(f"  Themes: {len(unique_themes)}")
print(f"  Years: {len(unique_years)}")

# 􁾤􁾤􁾤 GENERATE FILTER SIDEBAR HTML 􁾤􁾤􁾤
def generate_filter_sidebar():
    html = '    <div class="filter-header">\n'
    html += '      <h2>Filters</h2>\n'
    html += '      <span id="artwork-counter">127 works</span>\n'
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

# 􁾤􁾤􁾤 BUILD GALLERY HTML 􁾤􁾤􁾤
grouped = defaultdict(list)

for _, row in df.iterrows():
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
    grouped[row["category"]].append(block)

gallery_html = ""
for category, blocks in grouped.items():
    anchor = category.lower().replace(" ", "-")
    
    # Build category section with class for visibility control
    gallery_html += f'\n  <div class="category-section">\n'
    gallery_html += f'    <h3 id="{anchor}" class="section-title">{category}</h3>\n'
    
    # Add category description if available
    if category in category_descriptions:
        gallery_html += f'    <p class="category-description">{category_descriptions[category]}</p>\n'
    
    # Add gallery grid
    gallery_html += '    <div class="gallery">\n'
    gallery_html += "\n".join(blocks)
    gallery_html += "\n    </div>\n"
    gallery_html += '  </div>\n'

# 􁾤􁾤􁾤 READ INDEX.HTML 􁾤􁾤􁾤
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

# 􁾤􁾤􁾤 SAVE 􁾤􁾤􁾤
with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    f.write(new_content)

print("✔ index.html updated with filters and gallery content")

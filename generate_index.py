import pandas as pd
from collections import defaultdict

# 􁾤􁾤􁾤 CONFIG 􁾤􁾤􁾤
CSV_PATH = "gallery_metadata.csv"
CATEGORY_DESC_PATH = "category_descriptions.csv"
INDEX_PATH = "index.html"
OUTPUT_PATH = "index.html"

START_MARKER = "<!-- START GALLERY -->"
END_MARKER = "<!-- END GALLERY -->"

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

# 􁾤􁾤􁾤 FILTER BY VISIBILITY 􁾤􁾤􁾤
# Only include rows where 'visible' column is 'yes' (case-insensitive)
if 'visible' in df.columns:
    df['visible'] = df['visible'].str.strip().str.lower()
    df = df[df['visible'] == 'yes']
    print(f"✔ Filtered to {len(df)} visible artworks")
else:
    print("⚠ No 'visible' column found - showing all artworks")

# 􁾤􁾤􁾤 BUILD GALLERY HTML 􁾤􁾤􁾤
grouped = defaultdict(list)

for _, row in df.iterrows():
    # Escape quotes in description for data attribute
    desc_escaped = str(row["description"]).replace('"', '&quot;')
    
    # Get dimensions and medium (optional fields)
    dimensions = str(row.get("dimensions", "")).strip() if "dimensions" in row and pd.notna(row.get("dimensions")) else ""
    medium = str(row.get("medium", "")).strip() if "medium" in row and pd.notna(row.get("medium")) else ""
    
    # Escape for data attributes
    dimensions_escaped = dimensions.replace('"', '&quot;')
    medium_escaped = medium.replace('"', '&quot;')
    
    block = f'''    <div class="art-block">
      <img src="img/{row["category"]}/{row["filename"]}"
           alt="{row["title"]}"
           title="{row["title"]} ({row["show_date"]})"
           data-title="{row["title"]}"
           data-date="{row["show_date"]}"
           data-description="{desc_escaped}"
           data-dimensions="{dimensions_escaped}"
           data-medium="{medium_escaped}" />
      <div class="caption">
        <strong>{row["title"]}</strong><br>{row["show_date"]}<br>{row["description"]}
      </div>
    </div>'''
    grouped[row["category"]].append(block)


gallery_html = ""
for category, blocks in grouped.items():
    anchor = category.lower().replace(" ", "-")
    
    # Build category header with optional description
    gallery_html += f'\n  <h3 id="{anchor}" class="section-title">{category}</h3>\n'
    
    # Add category description if available
    if category in category_descriptions:
        gallery_html += f'  <p class="category-description">{category_descriptions[category]}</p>\n'
    
    # Add gallery grid
    gallery_html += '  <div class="gallery">\n'
    gallery_html += "\n".join(blocks)
    gallery_html += "\n  </div>\n"

# 􁾤􁾤􁾤 READ INDEX.HTML 􁾤􁾤􁾤
with open(INDEX_PATH, "r", encoding="utf-8") as f:
    content = f.read()

if START_MARKER not in content or END_MARKER not in content:
    raise ValueError("Markers <!-- START GALLERY --> and <!-- END GALLERY --> not found in index.html")

before = content.split(START_MARKER)[0]
after = content.split(END_MARKER)[1]
new_content = f"{before}{START_MARKER}\n{gallery_html}\n{END_MARKER}{after}"

# 􁾤􁾤􁾤 SAVE 􁾤􁾤􁾤
with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    f.write(new_content)

print("✔ index.html updated from gallery_metadata.csv with anchor tags and lightbox data attributes")

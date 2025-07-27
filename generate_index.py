import pandas as pd
from collections import defaultdict

# 􁾤􁾤􁾤 CONFIG 􁾤􁾤􁾤
CSV_PATH = "gallery_metadata.csv"
INDEX_PATH = "index.html"
OUTPUT_PATH = "index.html"

START_MARKER = "<!-- START GALLERY -->"
END_MARKER = "<!-- END GALLERY -->"

# 􁾤􁾤􁾤 LOAD CSV 􁾤􁾤􁾤
df = pd.read_csv(CSV_PATH, sep=';')
df['category'] = df['category'].str.strip()
df['filename'] = df['filename'].str.strip()

# 􁾤􁾤􁾤 BUILD GALLERY HTML 􁾤􁾤􁾤
grouped = defaultdict(list)

for _, row in df.iterrows():
    block = f'''    <div class="art-block">
      <img src="img/{row["category"]}/{row["filename"]}"
           alt="{row["title"]}"
           title="{row["title"]} ({row["show_date"]})" />
      <div class="caption">
        <strong>{row["title"]}</strong><br>{row["show_date"]}<br>{row["description"]}
      </div>
    </div>'''
    grouped[row["category"]].append(block)


gallery_html = ""
for category, blocks in grouped.items():
    anchor = category.lower().replace(" ", "-")
    gallery_html += f'\n  <h3 id="{anchor}" class="section-title">{category}</h3>\n  <div class="gallery">\n'
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

print("✔ index.html updated from gallery_metadata.csv with anchor tags")

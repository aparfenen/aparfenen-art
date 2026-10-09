# aparfenen-art
Link: https://aparfenen.github.io/aparfenen-art/

Activate venv:
`source venv/bin/activate`

Generate thumbnails for any new images:
`python3 generate_thumbnails.py`

Update index:
`python generate_index.py`

## Shareable gallery links

Filters, search and the selected view live in the address bar, so any selection
can be sent as a link (the sidebar's "Copy link to this view" button copies the
current one):

| Parameter | Example | Meaning |
| --- | --- | --- |
| `category` | `?category=Fragile+Systems` | one or more categories, comma-separated |
| `year` | `?year=2026,2025` | one or more years |
| `tags` | `?tags=birds` | one or more tags (only if the tag section is rendered) |
| `q` | `?q=river` | search query |
| `view` | `?view=thematic` | `thematic` (by category) or default `chronological` |
| `#id` | `#a-branch` | opens a single artwork in the lightbox |

Example: `https://aparfenen.art/?category=Fragile+Systems&year=2026`

Unknown values are dropped silently, so links stay usable after a category or a
work is renamed.


## Artist’s book

The published catalog is `downloads/anna-parfenenkova-artists-book.pdf`.
Its download and reading links are in the homepage’s `#catalog` section.

Rebuild with Python packages `reportlab`, `Pillow`, and `pypdf`, plus Poppler:

```sh
python3 scripts/build_catalog.py --edition 2026-10-09 --font-dir /path/to/liberation-fonts
```

The font directory must contain `LiberationSerif-Regular.ttf`,
`LiberationSerif-Italic.ttf`, and `LiberationSans-Regular.ttf`. The script defaults
to the Codex bundled font directory when available. It reads public (`visible=yes`)
CSV records and the existing `large/` images without modifying either. It creates
the PDF, updates the cover JPEG and homepage size label, and writes a local
verification manifest under `tmp/pdfs/`. The `output/pdf/` copy is for local delivery.

The October 2026 edition includes 344 records and 343 distinct source image paths.
The source archive assigns both “Overgeneralization” and “Soft Rift” to the same
image; both records are preserved and the discrepancy is documented in the book.
When preparing a new edition, review the edition notes and homepage description
alongside any changes to the archive’s record count or themes.

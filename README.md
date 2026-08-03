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


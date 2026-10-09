#!/usr/bin/env python3
"""Build the public artist's book from the gallery's recorded metadata.
Requires reportlab, Pillow, pypdf. Pass --font-dir when bundled fonts are unavailable.
"""
import argparse, csv, io, json, re, shutil, subprocess
from collections import OrderedDict
from datetime import datetime
from html import escape
from pathlib import Path
from PIL import Image, ImageOps
from reportlab import rl_config
rl_config.useA85 = False
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
DEFAULT_FONTS=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--font-dir', type=Path, default=DEFAULT_FONTS)
parser.add_argument('--edition', default='2026-10-09', help='ISO edition date')
args=parser.parse_args()
EDITION_DATE=datetime.strptime(args.edition,'%Y-%m-%d')
EDITION=EDITION_DATE.strftime('%B %Y')
(ROOT/'tmp/pdfs').mkdir(parents=True,exist_ok=True)
for name,file in [('Serif','LiberationSerif-Regular.ttf'),('Italic','LiberationSerif-Italic.ttf'),('Sans','LiberationSans-Regular.ttf')]:
 pdfmetrics.registerFont(TTFont(name,str(args.font_dir/file)))
W,H=612,792; M=48; INK='#34332F'; MUTED='#6C6B65'; ACCENT='#77718C'; RULE='#DDD9D2'
SITE='https://aparfenen.github.io/aparfenen-art/'
rows=[{k:v.strip() for k,v in r.items()} for r in csv.DictReader((ROOT/'gallery_metadata.csv').open()) if r['visible'].strip().lower()=='yes']
category_notes=OrderedDict((r['category'],r['description']) for r in csv.DictReader((ROOT/'category_descriptions.csv').open()) if r['category']!='Featured')
groups=OrderedDict((k,[r for r in rows if r['category']==k]) for k in category_notes)
for r in rows:
 if r['category'] not in groups: groups[r['category']]=[q for q in rows if q['category']==r['category']]
groups=OrderedDict((k,v) for k,v in groups.items() if v)
def datekey(r):
 for val,fmt in [(r['date_finished'],'%m/%d/%y'),(r['show_date'],'%B %Y')]:
  try:return datetime.strptime(val,fmt)
  except ValueError:pass
 return datetime.min
for g in groups.values():g.sort(key=datekey,reverse=True)
def source(r):
 p=ROOT/'large'/r['category']/(Path(r['filename']).stem+'.jpg')
 if not p.is_file():raise FileNotFoundError(p)
 return p
for r in rows:source(r)
OUT=ROOT/'output/pdf/anna-parfenenkova-artists-book.pdf';OUT.parent.mkdir(parents=True,exist_ok=True)
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
c.setTitle('An Archive of Works | Anna Parfenenkova')
c.setAuthor('Anna Parfenenkova');c.setSubject('Artist\'s book and catalog of the public gallery, '+EDITION)
c.setViewerPreference('DisplayDocTitle','true')
c.showOutline()
manifest=[];sizes=[]
def txt(s,x,y,size=10,font='Sans',color=INK):
 c.setFillColor(HexColor(color));c.setFont(font,size);c.drawString(x,y,s)
def para(s,x,top,width,size=11,font='Serif',leading=None,color=INK):
 style=ParagraphStyle('text',fontName=font,fontSize=size,leading=leading or size*1.4,textColor=HexColor(color))
 p=Paragraph(escape(s).replace('\n','<br/>'),style);_,h=p.wrap(width,H)
 p.drawOn(c,x,top-h);return h

def footer(label):
 c.setStrokeColor(HexColor(RULE));c.setLineWidth(.4);c.line(M,39,W-M,39)
 txt(label,M,24,7,color=MUTED)
 c.setFont('Sans',8);c.drawRightString(W-M,24,str(c.getPageNumber()))
def end(label='AN ARCHIVE OF WORKS'):
 footer(label);c.showPage()
def mark(key,title,level=0):
 c.bookmarkPage(key);c.addOutlineEntry(title,key,level=level,closed=True if level==0 else False)
def picture(r,box):
 x,y,bw,bh=box
 with Image.open(source(r)) as raw:im=ImageOps.exif_transpose(raw).convert('RGB')
 scale=min(bw/im.width,bh/im.height);dw,dh=im.width*scale,im.height*scale
 # Downsample only; preserve aspect, framing and color, with no synthetic alterations.
 im.thumbnail((1500,1500),Image.Resampling.LANCZOS)
 buf=io.BytesIO();im.save(buf,'JPEG',quality=76,subsampling=2,optimize=True);buf.seek(0)
 c.drawImage(ImageReader(buf),x+(bw-dw)/2,y+(bh-dh)/2,dw,dh)
 sizes.append(min(im.width/dw,im.height/dh)*72)

cover=next(r for r in rows if r['title']=='A Branch')
mark('cover','Cover')
txt('ANNA PARFENENKOVA',M,738,10,color=ACCENT)
para('An Archive\nof Works',M,700,500,38,leading=42)
txt('AN ARTIST’S BOOK',M,587,9,color=MUTED)
picture(cover,(M,116,W-2*M,433))
txt('Systems, perception and the unseen',M,77,15,'Italic')
txt('aparfenen.art',M,49,9,color=MUTED)
c.setFont('Sans',9);c.drawRightString(W-M,49,EDITION);c.showPage()

mark('statement','Artist’s statement')
txt('01 / THE PRACTICE',M,735,9,color=ACCENT)
para('Structure meets surrender',M,690,500,29,leading=34)
# Verbatim statement from the website, with typographic punctuation preserved.
html=(ROOT/'index.html').read_text()
statement=re.search(r'<div class="statement">(.*?)</div>',html,re.S).group(1)
from html import unescape
paragraphs=[unescape(re.sub('<[^>]+>','',x)).strip() for x in re.findall(r'<p>(.*?)</p>',statement,re.S)]
y=625
for i,p in enumerate(paragraphs):
 p=' '.join(p.split());h=para(p,M,y,474,13 if i==0 else 11.5,font='Italic' if i==0 else 'Serif',leading=18);y-=h+22
end('ANNA PARFENENKOVA / ARTIST’S STATEMENT')

# One linked contents page, with section starts calculated from the fixed plate structure.
section_pages={};n=4
for cat,rs in groups.items():section_pages[cat]=n;n+=1+len(rs)
index_start=n
mark('contents','Contents')
txt('02 / READING THE ARCHIVE',M,735,9,color=ACCENT)
para('Contents',M,692,500,31)
y=626
for i,(cat,rs) in enumerate(groups.items(),1):
 txt(f'{i:02d}',M,y,9,color=ACCENT);txt(cat,M+31,y,12,'Serif')
 c.setFont('Sans',9);c.drawRightString(W-M,y,str(section_pages[cat]))
 c.linkRect('',f'section-{i}',(M,y-4,W-M,y+14),relative=0,thickness=0);y-=24
c.setStrokeColor(HexColor(RULE));c.line(M,y+8,W-M,y+8)
txt('Title index',M+31,y-13,12,'Serif');c.setFont('Sans',9);c.drawRightString(W-M,y-13,str(index_start));c.linkRect('','index',(M,y-17,W-M,y+2),thickness=0)
para(f'{len(rows)} catalog records · {len(groups)} themes\nOne record per plate. Dimensions and media follow the artist’s archive.',M,88,500,9,'Sans',13,MUTED)
end('CONTENTS')

plate=0
for section,(cat,rs) in enumerate(groups.items(),1):
 assert c.getPageNumber()==section_pages[cat]
 mark(f'section-{section}',cat)
 txt(f'{section:02d} / {len(groups):02d}',M,735,9,color=ACCENT)
 h=para(cat,M,659,475,36,leading=40)
 para(category_notes.get(cat,''),M,659-h-29,425,15,leading=23)
 c.setStrokeColor(HexColor(ACCENT));c.setLineWidth(.7);c.line(M,203,M+62,203)
 txt(f'{len(rs)} '+('work' if len(rs)==1 else 'works'),M,174,10,color=MUTED)
 txt(f'PLATES {plate+1:03d}–{plate+len(rs):03d}',M,153,8,color=MUTED)
 end(cat.upper())
 for r in rs:
  plate+=1;key=f'plate-{plate}';page=c.getPageNumber();mark(key,r['title'],1)
  txt(f'{plate:03d} / {cat.upper()}',M,744,8,color=ACCENT)
  # Reserve precisely measured caption space, including the longest recorded notes.
  title_style=ParagraphStyle('title',fontName='Serif',fontSize=19,leading=23)
  title=Paragraph(escape(r['title']),title_style);_,th=title.wrap(516,200)
  meta=f"{r['show_date']}\n{r['medium'] or 'Medium not recorded'}\n{r['dimensions'] or 'Dimensions not recorded'}"
  ms=ParagraphStyle('meta',fontName='Sans',fontSize=8.5,leading=12,textColor=HexColor(MUTED))
  mp=Paragraph(escape(meta).replace('\n','<br/>'),ms);_,mh=mp.wrap(224,200)
  ds=ParagraphStyle('note',fontName='Italic',fontSize=10,leading=14,textColor=HexColor(INK))
  dp=Paragraph(escape(r['description']),ds);_,dh=dp.wrap(264,250)
  ch=max(mh,dh);caption_top=67+ch+13+th
  picture(r,(M,caption_top+24,516,718-caption_top-24))
  title.drawOn(c,M,caption_top-th)
  mp.drawOn(c,M,caption_top-th-13-mh);dp.drawOn(c,300,caption_top-th-13-dh)
  manifest.append({'plate':plate,'page':page,'title':r['title'],'category':cat,'image':str(source(r).relative_to(ROOT)),'date':r['show_date']})
  end('ANNA PARFENENKOVA')

assert c.getPageNumber()==index_start
mark('index','Title index')
indexed=sorted(manifest,key=lambda r:r['title'].casefold())
# Two columns with wrapped titles; every item is an internal link to its plate.
idx=0
while idx<len(indexed):
 txt('03 / FIND A WORK',M,735,9,color=ACCENT);para('Title index',M,696,500,28)
 for x in [M,314]:
  y=635
  while idx<len(indexed):
   r=indexed[idx];p=Paragraph(escape(r['title']),ParagraphStyle('idx',fontName='Serif',fontSize=9,leading=12));_,h=p.wrap(210,200)
   if y-h<68:break
   p.drawOn(c,x,y-h);c.setFillColor(HexColor(MUTED));c.setFont('Sans',8);c.drawRightString(x+244,y-10,str(r['page']))
   c.linkRect('',f"plate-{r['plate']}",(x,y-h-2,x+244,y+1),thickness=0)
   y-=max(20,h+7);idx+=1
 end('TITLE INDEX / PAGE NUMBERS')

mark('edition','About this edition')
txt('04 / EDITION NOTES',M,735,9,color=ACCENT);para('A record of the archive',M,690,490,30)
notes=[f'This artist’s book brings together the {len(rows)} publicly visible records in Anna Parfenenkova’s online gallery as of {EDITION_DATE.strftime('%B')} {EDITION_DATE.day}, {EDITION_DATE.year}. The sequence follows the gallery’s thematic structure; works within each theme are ordered from the most recent recorded date.',
'Titles, dates, media, dimensions, artwork notes and theme descriptions are transcribed from the artist’s gallery records. Missing media and dimensions are identified as unrecorded. Dates are catalog dates, not independently verified creation dates. The artist’s statement is reproduced from the website.',
'The catalog preserves two separate records, “Overgeneralization” (June 2025) and “Soft Rift” (July 2025), that currently share the same source image. These have not been silently merged; the book therefore contains 344 records and 343 distinct image paths.',
'Reproductions preserve the full image framing and proportions of the website’s large images. No retouching or invented details have been added. Color and apparent scale depend on the display or printer; the printed image size does not represent the physical size of the original.',
'Cover: A Branch. Full caption and record appear in Fragile Systems.\nUS Letter format, 8.5 × 11 inches. Embedded typefaces. Linked contents, title index and PDF bookmarks.']
y=622
for p in notes:y-=para(p,M,y,493,10.5,leading=15)+18
para('Anna Parfenenkova\naparfenen.art',M,y-3,490,13,leading=19)
c.linkURL(SITE,(M,y-43,M+230,y),relative=0)
end('EDITION / '+EDITION.upper())
c.save()
reader=PdfReader(OUT)
assert len(reader.pages)==c.getPageNumber()-1
for r in manifest:
 assert r['title'] in reader.pages[r['page']-1].extract_text().replace('\n',' ') or all(w in reader.pages[r['page']-1].extract_text() for w in r['title'].split()),r
report={'records':len(rows),'distinct_images':len(set(m['image'] for m in manifest)),'pages':len(reader.pages),'bytes':OUT.stat().st_size,'minimum_effective_ppi':round(min(sizes)), 'plates':manifest}
(ROOT/'tmp/pdfs/catalog-manifest.json').write_text(json.dumps(report,indent=2))
shutil.copy2(OUT,ROOT/'downloads'/OUT.name)
# Refresh the published cover and file-size label alongside the PDF.
renderer=shutil.which('pdftoppm')
if not renderer:
 raise RuntimeError('Install Poppler (pdftoppm) to render the website cover.')
subprocess.run([renderer,'-f','1','-singlefile','-scale-to','1000','-jpeg',str(OUT),str(ROOT/'assets/catalog-cover')],check=True)
html=(ROOT/'index.html').read_text()
html=re.sub(r'<span data-catalog-size>.*?</span>',f'<span data-catalog-size>{len(reader.pages)} pages · PDF, {OUT.stat().st_size/1_000_000:.1f} MB</span>',html)
(ROOT/'index.html').write_text(html)
print(json.dumps({k:v for k,v in report.items() if k!='plates'},indent=2))

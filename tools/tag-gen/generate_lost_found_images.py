from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import hashlib
import random

WIDTH, HEIGHT = 1828, 848
OUT = Path(__file__).parent / "tag-images" / "Lost-And-Found-1828x848"
BUNDLE = OUT / "Lost-And-Found-1828x848.zip"

LABELS = [
    ("01-neon", "neon", "VERLOREN?", "GEFUNDEN!", "FINDER SERVICE"),
    ("02-metall", "metal", "LOST &", "FOUND", "MANAGEMENT"),
    ("03-pixel", "pixel", "SCANN", "MICH", "ZURÜCK!"),
    ("04-leder", "leather", "FUNDSTÜCK", "NACHWEIS", ""),
    ("05-comic", "comic", "OOPS!", "HIER", "GEFUNDEN!"),
    ("06-tech-schaltkreis", "tech", "SCANN CODE:", "ZUSTELLUNG", ""),
    ("07-vintage-papier", "vintage", "REISETAG:", "GEFUNDEN", ""),
    ("08-baustein", "bricks", "HILFE!", "ICH BIN", "VERLOREN!"),
    ("09-night-grid", "night", "LOST &", "FOUND", "SYSTEM"),
    ("10-warnstreifen", "hazard", "VERLOREN &", "GEFUNDEN", "SERVICE"),
    ("11-ozean", "ocean", "FUNDSTÜCK", "SICHER", "ZURÜCK"),
    ("12-berg", "mountain", "ICH GEHÖRE", "WIEDER", "NACH HAUSE"),
]

FONT_DIR = Path("C:/Windows/Fonts")
def font(name, size):
    candidates = {
        "bold": ["arialbd.ttf", "bahnschrift.ttf"],
        "black": ["arialbd.ttf", "impact.ttf"],
        "regular": ["arial.ttf", "calibri.ttf"],
        "mono": ["consola.ttf"],
    }[name]
    for candidate in candidates:
        p = FONT_DIR / candidate
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()

def rounded(draw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def centered(draw, box, value, fnt, fill, stroke=0, stroke_fill=None):
    bounds = draw.textbbox((0, 0), value, font=fnt, stroke_width=stroke)
    w, h = bounds[2] - bounds[0], bounds[3] - bounds[1]
    x = box[0] + (box[2] - box[0] - w) / 2
    y = box[1] + (box[3] - box[1] - h) / 2 - bounds[1]
    draw.text((x, y), value, font=fnt, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)

def gradient(top, bottom):
    image = Image.new("RGB", (WIDTH, HEIGHT))
    pixels = image.load()
    for y in range(HEIGHT):
        t = y / (HEIGHT - 1)
        color = tuple(round(top[i] * (1-t) + bottom[i] * t) for i in range(3))
        for x in range(WIDTH):
            pixels[x, y] = color
    return image

def style_background(style):
    rng = random.Random(style)
    if style == "neon":
        im = gradient((8, 13, 38), (19, 4, 30)); d = ImageDraw.Draw(im)
        for i in range(18):
            x, y = rng.randrange(WIDTH), rng.randrange(HEIGHT)
            r = rng.randrange(30, 140)
            d.ellipse((x-r, y-r, x+r, y+r), fill=(20, rng.randrange(10, 40), 55))
        d.rounded_rectangle((18,18,WIDTH-18,HEIGHT-18), radius=50, outline=(93,244,255), width=15)
        d.rounded_rectangle((38,38,WIDTH-38,HEIGHT-38), radius=40, outline=(250,74,240), width=9)
    elif style == "metal":
        im = gradient((75,82,83), (22,28,31)); d = ImageDraw.Draw(im)
        for y in range(0, HEIGHT, 8):
            d.line((0,y,WIDTH,y), fill=(120 if y % 16 else 38,)*3, width=2)
        for x in range(20, WIDTH, 90):
            d.line((x,0,x+120,HEIGHT), fill=(50,55,56), width=3)
        rounded(d,(18,18,WIDTH-18,HEIGHT-18),42,(0,0,0), (190,196,193), 13)
        rounded(d,(42,42,WIDTH-42,HEIGHT-42),30,None,(47,53,53),9)
    elif style == "pixel":
        im = Image.new("RGB",(WIDTH,HEIGHT),(23,41,40)); d=ImageDraw.Draw(im)
        for y in range(0,HEIGHT,34):
            for x in range(0,WIDTH,34):
                c=rng.choice([(18,55,53),(30,72,66),(12,35,36),(60,88,43)])
                d.rectangle((x,y,x+28,y+28),fill=c)
        rounded(d,(15,15,WIDTH-15,HEIGHT-15),22,None,(241,165,45),15)
    elif style == "leather":
        im = gradient((117,71,40),(57,28,16)); d=ImageDraw.Draw(im)
        for _ in range(3500):
            x,y=rng.randrange(WIDTH),rng.randrange(HEIGHT)
            c=rng.choice([(100,52,28),(145,91,52),(70,34,20),(170,112,65)])
            d.point((x,y),fill=c)
        rounded(d,(22,22,WIDTH-22,HEIGHT-22),38,None,(236,191,121),16)
        rounded(d,(48,48,WIDTH-48,HEIGHT-48),25,None,(71,35,18),6)
    elif style == "comic":
        im=Image.new("RGB",(WIDTH,HEIGHT),(245,245,232)); d=ImageDraw.Draw(im)
        for x in range(-HEIGHT,WIDTH,42): d.line((x,0,x+HEIGHT,HEIGHT),fill=(86,167,200),width=7)
        d.rectangle((18,18,WIDTH-18,HEIGHT-18),outline=(27,40,49),width=15)
        for _ in range(120):
            x,y=rng.randrange(WIDTH),rng.randrange(HEIGHT)
            d.ellipse((x,y,x+7,y+7), fill=(37,78,99))
    elif style == "tech":
        im=gradient((8,42,61),(2,13,28)); d=ImageDraw.Draw(im)
        for _ in range(60):
            x,y=rng.randrange(WIDTH),rng.randrange(HEIGHT)
            d.line((x,y,x+rng.randrange(40,190),y),fill=(31,153,192),width=4)
            d.line((x,y,x,y+rng.randrange(30,150)),fill=(31,153,192),width=4)
            d.ellipse((x-7,y-7,x+7,y+7),fill=(121,240,255))
        rounded(d,(18,18,WIDTH-18,HEIGHT-18),32,None,(83,225,252),12)
    elif style == "vintage":
        im=Image.new("RGB",(WIDTH,HEIGHT),(213,189,137)); d=ImageDraw.Draw(im)
        for _ in range(3500):
            x,y=rng.randrange(WIDTH),rng.randrange(HEIGHT)
            r=rng.randrange(1,4)
            d.ellipse((x-r,y-r,x+r,y+r),fill=rng.choice([(190,156,102),(238,217,165),(158,118,70)]))
        rounded(d,(16,16,WIDTH-16,HEIGHT-16),34,None,(106,68,36),15)
        d.line((35,80,WIDTH-35,80),fill=(126,81,43),width=5)
        d.line((35,HEIGHT-80,WIDTH-35,HEIGHT-80),fill=(126,81,43),width=5)
    elif style == "bricks":
        im=Image.new("RGB",(WIDTH,HEIGHT),(244,211,46)); d=ImageDraw.Draw(im)
        cols=[(229,67,51),(47,139,206),(58,172,95),(242,166,41)]
        size=80
        for row,y in enumerate(range(0,HEIGHT,size)):
            offset=0 if row%2==0 else -size//2
            for col,x in enumerate(range(offset,WIDTH,size)):
                c=cols[(row+col)%len(cols)]
                rounded(d,(x+4,y+4,x+size-4,y+size-4),12,c,(180,120,25),3)
                d.ellipse((x+size*.2,y+size*.2,x+size*.33,y+size*.33),fill=(255,239,130))
                d.ellipse((x+size*.67,y+size*.67,x+size*.8,y+size*.8),fill=(176,106,24))
    elif style == "night":
        im=gradient((30,42,54),(5,12,22)); d=ImageDraw.Draw(im)
        for x in range(0,WIDTH,55): d.line((x,0,x,HEIGHT),fill=(48,66,78),width=2)
        for y in range(0,HEIGHT,55): d.line((0,y,WIDTH,y),fill=(48,66,78),width=2)
        rounded(d,(18,18,WIDTH-18,HEIGHT-18),35,None,(151,177,186),12)
    elif style == "hazard":
        im=Image.new("RGB",(WIDTH,HEIGHT),(252,213,24)); d=ImageDraw.Draw(im)
        for x in range(-HEIGHT,WIDTH,75): d.polygon([(x,0),(x+38,0),(x+HEIGHT+38,HEIGHT),(x+HEIGHT,HEIGHT)],fill=(14,17,18))
        rounded(d,(40,62,WIDTH-40,HEIGHT-62),28,(246,218,39),(10,12,12),14)
    elif style == "ocean":
        im=gradient((10,152,185),(0,53,111)); d=ImageDraw.Draw(im)
        for y in range(30,HEIGHT,80):
            for x in range(0,WIDTH,140):
                d.arc((x,y,x+140,y+65),185,350,fill=(121,229,241),width=8)
        rounded(d,(18,18,WIDTH-18,HEIGHT-18),42,None,(205,251,253),14)
    else:
        im=gradient((132,190,227),(232,246,247)); d=ImageDraw.Draw(im)
        for x in range(0,WIDTH,240):
            d.polygon([(x,HEIGHT),(x+150,220),(x+320,HEIGHT)],fill=(55,116,143))
            d.polygon([(x+80,HEIGHT),(x+250,300),(x+420,HEIGHT)],fill=(35,85,110))
        rounded(d,(18,18,WIDTH-18,HEIGHT-18),40,None,(255,255,255),14)
    return im

def qr_placeholder(draw, left, top, style):
    box = 360
    rounded(draw, (left-16,top-16,left+box+16,top+box+16), 20, (246,246,240), (20,30,35), 10)
    module = 14
    seed = int(hashlib.sha256(style.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    for y in range(21):
        for x in range(21):
            is_finder = (x < 7 and y < 7) or (x >= 14 and y < 7) or (x < 7 and y >= 14)
            dark = rng.random() > .52
            if is_finder:
                localx, localy = x % 7, y % 7
                dark = localx in (0,6) or localy in (0,6) or (2 <= localx <= 4 and 2 <= localy <= 4)
            if dark: draw.rectangle((left+x*module,top+y*module,left+(x+1)*module,top+(y+1)*module), fill=(18,25,27))
    rounded(draw,(left+105,top+105,left+255,top+255), 75,(250,190,37),(30,37,38),6)
    centered(draw,(left+105,top+92,left+255,top+255),"?",font("black",120),(20,28,30))

def add_content(im, style, line1, line2, line3):
    d=ImageDraw.Draw(im)
    qr_placeholder(d,110,244,style)
    text_box=(560,135,1720,650)
    text_fill=(247,246,231) if style in ("neon","tech","night") else (24,29,28)
    accent=(255,195,45) if style in ("neon","tech","night","pixel") else (224,68,42)
    if style == "hazard": text_fill=(12,14,14)
    if style == "vintage": text_fill=(76,43,27)
    sizes=[118,128,76] if line3 else [122,112,0]
    lines=[line1,line2,line3]
    y=145
    for i,value in enumerate(lines):
        if not value: continue
        fnt=font("black",sizes[i])
        bounds=d.textbbox((0,0),value,font=fnt,stroke_width=0)
        max_w=text_box[2]-text_box[0]
        while bounds[2]-bounds[0] > max_w and sizes[i] > 34:
            sizes[i]-=2; fnt=font("black",sizes[i]); bounds=d.textbbox((0,0),value,font=fnt)
        centered(d,(text_box[0],y,text_box[2],y+sizes[i]+25),value,fnt,text_fill,stroke=3 if style in ("comic","hazard") else 0,stroke_fill=accent)
        y+=sizes[i]+20
    d.line((575,675,1660,675),fill=accent,width=8)
    footer=font("regular",35)
    d.text((1120,710),"powered by myqr24.com",font=footer,fill=text_fill)

def generate():
    OUT.mkdir(parents=True, exist_ok=True)
    created=[]
    for number, style, a, b, c in LABELS:
        base=style_background(style)
        blank=OUT / f"{number}-roh-template.png"
        base.save(blank, "PNG", optimize=True)
        created.append(blank)
        label=base.copy()
        add_content(label,style,a,b,c)
        content=OUT / f"{number}-lost-and-found-label.png"
        label.save(content, "PNG", optimize=True)
        created.append(content)
    with ZipFile(BUNDLE, "w", ZIP_DEFLATED) as archive:
        for path in created:
            archive.write(path, path.name)
    print(f"Created {len(created)} PNG files and {BUNDLE}")

if __name__ == "__main__":
    generate()

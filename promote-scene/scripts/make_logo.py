# Logo set for a scene's marketing kit (Pillow only). Copy to <scene>/promote/tools/make_logo.py.
#   python3 promote/tools/make_logo.py
# Reads game name, tagline and brand colours/fonts from promote/posts.json ("game", "tagline", "brand");
# anything set in the constants below wins. Writes into promote/logo/:
#   <slug>_wordmark.png        name with a hard drop shadow, transparent (used by compose_social.py)
#   <slug>_lockup_on_black.png wordmark + tagline + tear-line rule on the ink colour, ready to post
#   <slug>_icon_1024.png       square avatar/icon: short glyph with a glow over a dark tile pattern
import os, re, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(ROOT, 'promote')
OUT = os.path.join(P, 'logo')
os.makedirs(OUT, exist_ok=True)
KIT = json.load(open(os.path.join(P, 'posts.json')))
B = KIT.get('brand', {})

# ------------------------------------------------------------------ overrides (None = from posts.json)
NAME = None          # wordmark text; default: game name in upper case
TAGLINE = None       # default: posts.json "tagline" in upper case
ICON_TEXT = None     # 1-3 characters for the icon; default: brand.icon_text, else the name's initial
FONT = None          # display face; default: brand.font, else Impact
FONT_SMALL = None    # tagline / labels; default: brand.font_small, else DIN Condensed Bold

SUPP = '/System/Library/Fonts/Supplemental/'
NAME = NAME or B.get('wordmark') or KIT['game'].upper()
TAGLINE = TAGLINE or KIT.get('tagline', '').upper()
ICON_TEXT = ICON_TEXT or B.get('icon_text') or NAME[0]
FONT = FONT or B.get('font') or SUPP + 'Impact.ttf'
FONT_SMALL = FONT_SMALL or B.get('font_small') or SUPP + 'DIN Condensed Bold.ttf'
SLUG = re.sub(r'[^a-z0-9]+', '_', KIT['game'].lower()).strip('_')


def rgba(hex_, a=255):
    h = hex_.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


TEXT = rgba(B.get('text', '#F2F0E8'))     # main letter colour
INK = rgba(B.get('ink', '#0C0C0E'))       # shadow / background
ACCENT = rgba(B.get('accent', '#FF2618'))  # icon glyph, highlights


def wordmark(fill, shadow, width=2400, pad=60, tracking=-0.02):
    """Fit NAME to `width` px; `shadow` is a hard offset copy (4.5 % of the font size) or None."""
    probe = ImageFont.truetype(FONT, 400)
    total = sum(probe.getlength(c) for c in NAME) + 400 * tracking * (len(NAME) - 1)
    size = int(400 * (width - 2 * pad) / total)
    font = ImageFont.truetype(FONT, size)
    widths = [font.getlength(c) for c in NAME]
    track = size * tracking
    asc, desc = font.getmetrics()
    off = int(size * 0.045)
    im = Image.new('RGBA', (width + off, asc + desc + 2 * pad + off), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = pad
    for c, w in zip(NAME, widths):
        if shadow:
            d.text((x + off, pad + off), c, font=font, fill=shadow)
        d.text((x, pad), c, font=font, fill=fill)
        x += w + track
    return im.crop(im.getbbox())


def save(im, name):
    p = os.path.join(OUT, '%s_%s.png' % (SLUG, name))
    im.save(p)
    print('wrote', p, im.size)


# 1. wordmark, transparent
main = wordmark(TEXT, INK)
save(main, 'wordmark')

# 2. lockup with tagline, on the ink colour
W, H = main.width + 160, main.height + (260 if TAGLINE else 40)
lock = Image.new('RGBA', (W, H), (0, 0, 0, 0))
lock.alpha_composite(main, (80, 0))
if TAGLINE:
    d = ImageDraw.Draw(lock)
    size = 150
    tag_font = ImageFont.truetype(FONT_SMALL, size)
    while tag_font.getlength(TAGLINE) > W - 180 and size > 40:   # shrink long taglines to fit
        size -= 6
        tag_font = ImageFont.truetype(FONT_SMALL, size)
    tw = tag_font.getlength(TAGLINE)
    d.text(((W - tw) / 2, main.height + 70), TAGLINE, font=tag_font, fill=TEXT)
    y = main.height + 40
    for x in range(90, W - 90, 36):   # dashed rule
        d.rectangle((x, y, x + 18, y + 4), fill=TEXT[:3] + (140,))
bg = Image.new('RGBA', (W + 240, H + 240), INK)
bg.alpha_composite(lock, (120, 120))
save(bg.convert('RGB'), 'lockup_on_black')

# 3. square icon: glowing glyph on a dark checker of tiles
S, t = 1024, 64
icon = Image.new('RGBA', (S, S), INK)
d = ImageDraw.Draw(icon)
for yy in range(0, S, t):
    for xx in range(0, S, t):
        s = 22 + ((xx // t + yy // t) % 2) * 4
        d.rectangle((xx + 2, yy + 2, xx + t - 2, yy + t - 2), fill=(s, s - 2, max(0, s - 6), 255))
size = 560
glyph_font = ImageFont.truetype(FONT, size)
while glyph_font.getlength(ICON_TEXT) > S * 0.8 and size > 120:
    size -= 20
    glyph_font = ImageFont.truetype(FONT, size)
layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ld = ImageDraw.Draw(layer)
l, tp, r, b = ld.textbbox((0, 0), ICON_TEXT, font=glyph_font)
ld.text(((S - (r - l)) / 2 - l, (S - (b - tp)) / 2 - tp), ICON_TEXT, font=glyph_font, fill=ACCENT)
glow = layer.filter(ImageFilter.GaussianBlur(40))
icon = Image.alpha_composite(Image.alpha_composite(icon, glow), glow)
icon = Image.alpha_composite(icon, layer)
small = ImageFont.truetype(FONT_SMALL, 130)
d = ImageDraw.Draw(icon)
for label, y in ((B.get('icon_top'), 70), (B.get('icon_bottom'), S - 190)):   # optional labels
    if label:
        d.text(((S - small.getlength(label)) / 2, y), label, font=small, fill=TEXT)
save(icon.convert('RGB'), 'icon_1024')

# Ready-to-post images for a scene's marketing kit (Pillow only). Copy to <scene>/promote/tools/.
#   python3 promote/tools/compose_social.py
# Run after the renders and make_logo.py. Reads promote/posts.json:
#   "keyart": {"1920x1080": "images/keyart/hero_1920x1080.png", "1080x1080": "..."}
#       one text-free source per output size; a size with no entry is centre-cropped from the first one,
#       so a single good image (e.g. the scene's own thumbnail, if it has no text) is enough.
#   "quote_cards": [{"id": "quote_forever", "render": "images/renders/hero.png", "line": "Line one.\nLine two."}]
#   "brand": {"text", "accent", "font_small", "quote_tag"}   (see make_logo.py)
#   "keyart_logo_y": 0.42      vertical centre of the wordmark as a fraction of the height (0.25-0.75).
#                              Move it off the subject: a logo across the creature/hero ruins the shot.
#   "x_header_logo": "left"    side of the X header the wordmark goes on; pick the side without the subject.
#   "event_banners": false     true (or run with --events) also writes the Foundation's optional event-page
#                              banners: event_1340x670.jpg and event_716x1814.jpg, JPEG, each under 500 KB.
# Writes promote/images/social/: keyart_<size>.png (wordmark inside the central 60 %),
# x_header_1500x500.png, and one 1080 px card per quote.
import os, re, io, sys, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(ROOT, 'promote')
OUT = os.path.join(P, 'images', 'social')
os.makedirs(OUT, exist_ok=True)
KIT = json.load(open(os.path.join(P, 'posts.json')))
B = KIT.get('brand', {})
SLUG = re.sub(r'[^a-z0-9]+', '_', KIT['game'].lower()).strip('_')
FONT_SMALL = B.get('font_small') or '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf'
X_HEADER = True
EVENT_BANNERS = KIT.get('event_banners', False) or '--events' in sys.argv
EVENT_MAX_BYTES = 500 * 1000   # Foundation event pages: "max 500kb"


def rgba(hex_, a=255):
    h = hex_.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


TEXT = rgba(B.get('text', '#F2F0E8'))
ACCENT = rgba(B.get('accent', '#FF2618'))
wordmark = Image.open(os.path.join(P, 'logo', SLUG + '_wordmark.png')).convert('RGBA')


def fit_w(im, w):
    return im.resize((w, int(im.height * w / im.width)), Image.LANCZOS)


def cover(im, w, h):
    """Scale to fill w x h, centre-crop the overflow."""
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def save(im, name):
    p = os.path.join(OUT, name)
    im.convert('RGB').save(p)
    print('wrote', p, im.size)


def with_logo(im, frac, ypos):
    """Wordmark `frac` of the width wide, centred at `ypos` of the height, with a soft dark halo."""
    lg = fit_w(wordmark, int(im.width * frac))
    pos = ((im.width - lg.width) // 2, int(im.height * ypos - lg.height / 2))
    mask = Image.new('RGBA', lg.size, (0, 0, 0, 255))
    mask.putalpha(lg.split()[3].point(lambda v: int(v * 0.9)))
    halo = Image.new('RGBA', im.size, (0, 0, 0, 0))
    halo.alpha_composite(mask, pos)
    im.alpha_composite(halo.filter(ImageFilter.GaussianBlur(28)))
    im.alpha_composite(lg, pos)
    return im


# ---- key art. Keep the logo within the central 60 % so 16:9 / 1:1 / 4:5 / 9:16 crops keep it.
sources = KIT.get('keyart', {})
first = next(iter(sources.values()), None)
LOGO_Y = KIT.get('keyart_logo_y', 0.42)
LAYOUT = {'1920x1080': 0.58, '1080x1080': 0.80, '1080x1350': 0.80, '1080x1920': 0.84}   # logo width fraction
for size, frac in LAYOUT.items():
    ypos = min(max(LOGO_Y, 0.25), 0.75)
    src = sources.get(size) or (first if size in ('1920x1080', '1080x1080') else None)
    if not src:
        continue
    path = os.path.join(P, src)
    if not os.path.exists(path):
        print('missing', path); continue
    w, h = map(int, size.split('x'))
    save(with_logo(cover(Image.open(path).convert('RGBA'), w, h), frac, ypos), 'keyart_%s.png' % size)

# ---- X header 1500 x 500: middle band of the landscape source, wordmark on the left
land = sources.get('1920x1080') or first
if X_HEADER and land and os.path.exists(os.path.join(P, land)):
    band = cover(Image.open(os.path.join(P, land)).convert('RGBA'), 1500, 500)
    lg = fit_w(wordmark, 620)
    x = 70 if KIT.get('x_header_logo', 'left') == 'left' else 1500 - 70 - lg.width
    band.alpha_composite(lg, (x, (500 - lg.height) // 2))
    save(band, 'x_header_1500x500.png')

# ---- event-page banners (optional): JPEG, quality stepped down until the file is under 500 KB
def save_capped(im, name, cap=EVENT_MAX_BYTES):
    rgb = im.convert('RGB')
    for q in range(92, 34, -4):
        buf = io.BytesIO()
        rgb.save(buf, 'JPEG', quality=q, optimize=True, progressive=True)
        if buf.tell() <= cap:
            break
    else:
        print('WARNING: %s still %d bytes at quality %d' % (name, buf.tell(), q))
    open(os.path.join(OUT, name), 'wb').write(buf.getvalue())
    print('wrote', os.path.join(OUT, name), rgb.size, '%d KB q%d' % (buf.tell() // 1000, q))


if EVENT_BANNERS:
    square = sources.get('1080x1080') or first
    for w, h, src, frac in ((1340, 670, land, 0.58), (716, 1814, square, 0.84)):
        if not src or not os.path.exists(os.path.join(P, src)):
            print('missing key-art source for event banner %dx%d' % (w, h)); continue
        ypos = min(max(KIT.get('keyart_logo_y', 0.42), 0.25), 0.75)
        save_capped(with_logo(cover(Image.open(os.path.join(P, src)).convert('RGBA'), w, h), frac, ypos),
                    'event_%dx%d.jpg' % (w, h))

# ---- quote cards: render + bottom gradient + one in-game line + small wordmark
S = 1080
font = ImageFont.truetype(FONT_SMALL, 92)
tag_font = ImageFont.truetype(FONT_SMALL, 44)
small = fit_w(wordmark, 300)
TAG = B.get('quote_tag') or KIT['game'].upper()
for q in KIT.get('quote_cards', []):
    path = os.path.join(P, q['render'])
    if not os.path.exists(path):
        print('missing', path); continue
    im = cover(Image.open(path).convert('RGBA'), S, S)
    grad = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(S // 2, S):
        gd.line((0, y, S, y), fill=(0, 0, 0, int(230 * ((y - S // 2) / (S / 2)) ** 1.4)))
    im.alpha_composite(grad)
    d = ImageDraw.Draw(im)
    lines = q['line'].upper().split('\n')
    for l in lines:
        if font.getlength(l) > S - 96:
            print('WARNING: quote line too wide, add a \\n:', q['id'], repr(l))
    y = S - 110 - len(lines) * 104
    d.text((72, y - 56), TAG, font=tag_font, fill=ACCENT)
    for l in lines:
        d.text((72, y), l, font=font, fill=TEXT)
        y += 104
    im.alpha_composite(small, (S - small.width - 60, S - small.height - 56))
    save(im, q['id'] + '.png')

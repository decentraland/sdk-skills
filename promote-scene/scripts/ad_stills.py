#!/usr/bin/env python3
# promote-scene tool version: 2026-11-27
"""Ad stills for a paid campaign: one real gameplay frame -> every image size of the delivery spec, named for
check_ads.py. Copy to <scene>/promote/tools/ad_stills.py next to check_ads.py (the sizes live there).

  python3 promote/tools/ad_stills.py <game> <creative> --from <file>[@<seconds>] [--vertical-from <file>[@<seconds>]]
                                     [--focus X,Y] [--sizes 1x1,4x5,...] [--lang pt] [--png] [--out DIR]
  python3 promote/tools/ad_stills.py <game> --logo <official logo file> [--bg '#161518'] [--out DIR]

--from is a recording and the second to take (footage/visit.mp4@312.5) or an image (a render, a screenshot).
Pick that moment from the promise ledger: real first-session play, nothing the market rules out (see the
paid-ads reference). --vertical-from, when given, feeds the portrait sizes (4x5, 9x16) from a vertical take;
otherwise every size is cover-cropped from --from around --focus (percent, default 50,50; 50,100 keeps the
bottom and drops a top HUD bar). A crop that has to upscale more than 10 % is reported: capture that size
natively instead. JPG by default (quality lowered until under 3 MB, the 4x3 thumbnail under 500 KB); --png
for PNG. Writes <out>/<game>_<creative>_<size>[_<lang>].jpg, out = promote/ads/.
--logo puts the official mark (from the brand folder, never redrawn) centred on a 1200x1200 canvas:
<out>/<game>_brand_logo.png, the square logo Google PMax requires.
Needs Pillow, and ffmpeg for frames from a video.
"""
import io, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from check_ads import IMAGE, IMAGE_MAX, LOGO, THUMB_MAX  # noqa: E402  the one size table

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow is missing: python3 -c "import PIL" fails. Ask before installing it.')

PORTRAIT = ('4x5', '9x16')


def load(spec):
    """'file@seconds' (a video frame) or 'file' (an image) -> RGB image."""
    path, _, t = spec.rpartition('@') if re.search(r'@[0-9.]+$', spec) else (spec, '', '')
    if not os.path.exists(path):
        sys.exit('no file %s' % path)
    if not t:
        try:
            return Image.open(path).convert('RGB')
        except OSError:
            sys.exit('%s is not an image; for a video give the second to take: %s@12.5' % (path, path))
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg not found on PATH: install it (https://ffmpeg.org) to take frames from %s' % path)
    tmp = tempfile.mkdtemp(prefix='adstill-')
    try:
        out = os.path.join(tmp, 'f.png')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', t, '-i', path, '-frames:v', '1', out], check=True)
        if not os.path.exists(out):
            sys.exit('no frame at %s s in %s (past the end?)' % (t, path))
        return Image.open(out).convert('RGB')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def cover(img, w, h, focus):
    """Crop img to the w:h aspect around focus (percent), then resize to w x h. Returns (image, upscale factor)."""
    sw, sh = img.size
    if sw / sh > w / h:
        cw, ch = round(sh * w / h), sh
    else:
        cw, ch = sw, round(sw * h / w)
    x = round((sw - cw) * focus[0] / 100)
    y = round((sh - ch) * focus[1] / 100)
    return img.crop((x, y, x + cw, y + ch)).resize((w, h), Image.LANCZOS), w / cw


def save(img, path, limit, png):
    if png:
        img.save(path, optimize=True)
        if os.path.getsize(path) >= limit:
            print('  over the limit as PNG (%d KB): drop --png' % (os.path.getsize(path) // 1024))
        return
    for q in range(92, 39, -4):
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=q, optimize=True, progressive=True)
        if buf.tell() < limit:
            break
    open(path, 'wb').write(buf.getvalue())
    if buf.tell() >= limit:
        print('  still %d KB at quality 40, limit %d KB' % (buf.tell() // 1024, limit // 1024))


def logo(game, src, bg, out):
    mark = Image.open(src).convert('RGBA')
    box = round(LOGO[0] * 0.72)   # clear space around the mark
    k = min(box / mark.width, box / mark.height)
    mark = mark.resize((max(1, round(mark.width * k)), max(1, round(mark.height * k))), Image.LANCZOS)
    canvas = Image.new('RGBA', LOGO, bg)
    canvas.alpha_composite(mark, ((LOGO[0] - mark.width) // 2, (LOGO[1] - mark.height) // 2))
    path = os.path.join(out, '%s_brand_logo.png' % game)
    canvas.convert('RGB').save(path, optimize=True)
    print('wrote', path, '(%dx%d, %d KB)' % (*LOGO, os.path.getsize(path) // 1024))


def main(argv):
    opts, pos, i = {}, [], 0
    valued = ('from', 'vertical-from', 'focus', 'sizes', 'lang', 'out', 'logo', 'bg')
    while i < len(argv):
        a = argv[i]; i += 1
        if a.startswith('--'):
            k, eq, v = a[2:].partition('=')
            if k == 'png':
                opts[k] = True; continue
            if k not in valued:
                sys.exit(__doc__)
            if not eq:
                if i >= len(argv): sys.exit('--%s needs a value' % k)
                v = argv[i]; i += 1
            opts[k] = v
        else:
            pos.append(a)
    out = opts.get('out') or os.path.join(os.path.dirname(HERE), 'ads')
    os.makedirs(out, exist_ok=True)
    if not pos or not re.match(r'^[a-z0-9]+$', pos[0]):
        sys.exit('the first argument is the game slug, lower-case letters and digits (claimbite)\n\n' + __doc__)
    game = pos[0]
    if 'logo' in opts:
        return logo(game, opts['logo'], opts.get('bg', '#161518'), out)
    if len(pos) < 2 or not re.match(r'^[A-Za-z0-9]+$', pos[1]) or 'from' not in opts:
        sys.exit(__doc__)
    creative, lang = pos[1], opts.get('lang')
    if lang and not re.match(r'^[a-z]{2,3}(-[A-Za-z]{2})?$', lang):
        sys.exit('--lang is a code like pt or pt-BR')
    try:
        focus = tuple(float(x) for x in opts.get('focus', '50,50').split(','))
        assert len(focus) == 2
    except (ValueError, AssertionError):
        sys.exit('--focus takes X,Y in percent, e.g. 50,100')
    sizes = opts.get('sizes', ','.join(IMAGE)).split(',')
    bad = [s for s in sizes if s not in IMAGE]
    if bad:
        sys.exit('unknown size(s) %s; sizes: %s' % (', '.join(bad), ', '.join(IMAGE)))
    main_img = load(opts['from'])
    vert_img = load(opts['vertical-from']) if 'vertical-from' in opts else None
    for s in sizes:
        w, h = IMAGE[s][0]
        src = vert_img if (vert_img is not None and s in PORTRAIT) else main_img
        img, up = cover(src, w, h, focus)
        ext = 'png' if opts.get('png') else 'jpg'
        path = os.path.join(out, '%s_%s_%s%s.%s' % (game, creative, s, '_' + lang if lang else '', ext))
        save(img, path, THUMB_MAX if s == '4x3' else IMAGE_MAX, opts.get('png'))
        note = '  upscaled %.2fx: soft; capture this size natively' % up if up > 1.1 else ''
        print('wrote %s (%dx%d, %d KB)%s' % (path, w, h, os.path.getsize(path) // 1024, note))
    print('next: python3 %s %s' % (os.path.join(os.path.relpath(HERE), 'check_ads.py'), out))


if __name__ == '__main__':
    main(sys.argv[1:])

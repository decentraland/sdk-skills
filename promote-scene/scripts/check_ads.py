#!/usr/bin/env python3
# promote-scene tool version: 2026-11-27
"""Delivery check for paid-ad creatives: every file in promote/ads/ against the campaign spec, PASS or FAIL.
Copy to <scene>/promote/tools/check_ads.py (ad_stills.py imports its size table).

  python3 promote/tools/check_ads.py [<ads dir>] [--partial]

File names: <game>_<creative>_<size>[_<lang>].<ext>, e.g. claimbite_C01_9x16.mp4, claimbite_C01_1x1_pt.jpg,
claimbite_brand_logo.png (the PMax square logo, one per game). game is lower-case letters and digits; creative is
letters and digits (C01); lang is a code like pt or pt-BR.

Checked per file: the name; videos are MP4 / H.264 / yuv420p, the exact size for their ratio, 15-30 s, under
500 MB; images are JPG or PNG matching their extension, an exact size for their token, under 3 MB (the 4x3
thumbnail under 500 KB); frame 0 of a video, and every image but the logo, is not dark (mean luma; black is 16).
Checked per creative (and language): every video size and every still is there, in the spec's priority order,
and the game has its brand logo. A still without a language (a clean frame, no text in it) serves every
language of its creative, so a pt/en test needs one set of clean stills, not one per language. Missing pieces fail unless --partial (a first round that ships 9:16 only).
Exit code 1 when anything fails. Needs ffmpeg and ffprobe.
"""
import json, os, re, shutil, subprocess, sys

# The campaign team's delivery spec (2026-11-27), priority order. A buyer with another spec edits these tables.
VIDEO = {'9x16': (1080, 1920), '1x1': (1080, 1080), '4x5': (1080, 1350), '16x9': (1920, 1080)}
IMAGE = {'1x1': [(1200, 1200)], '4x5': [(1080, 1350), (960, 1200)], '9x16': [(1080, 1920)],
         '191x1': [(1200, 628)], '4x3': [(400, 300)]}
LOGO = (1200, 1200)
VIDEO_SECONDS = (15.0, 30.0)
VIDEO_MAX = 500 * 1024 * 1024
IMAGE_MAX = 3 * 1024 * 1024
THUMB_MAX = 500 * 1024
MIN_LUMA = 40   # frame 0 / image mean luma (16 = black); bright gameplay reads around 100

NAME = re.compile(r'^(?P<game>[a-z0-9]+)_(?P<creative>[A-Za-z0-9]+)_(?P<size>[0-9a-z]+)'
                  r'(?:_(?P<lang>[a-z]{2,3}(?:-[A-Za-z]{2})?))?\.(?P<ext>mp4|jpg|jpeg|png)$')
HERE = os.path.dirname(os.path.abspath(__file__))


def ffprobe(*args):
    r = subprocess.run(['ffprobe', '-v', 'error', *args], capture_output=True, text=True)
    return r.stdout


def luma(path, video):
    """Mean luma of the first frame (16 = black). The file is a plain -i input, never part of a filter string,
    so a Windows path (C:\\...) or a folder name with ':' or ',' needs no escaping."""
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-frames:v', '1', '-vf',
                        'signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'],
                       capture_output=True, text=True)
    m = re.search(r'lavfi\.signalstats\.YAVG=([0-9.]+)', r.stdout)
    return float(m.group(1)) if m else None


def check_file(path):
    """(problems, facts, parsed name or None) for one file."""
    name = os.path.basename(path)
    m = NAME.match(name)
    if not m:
        return ['name is not <game>_<creative>_<size>[_<lang>].mp4|jpg|png'], '', None
    g = m.groupdict()
    video = g['ext'] == 'mp4'
    probs = []
    d = json.loads(ffprobe('-show_entries', 'stream=codec_type,codec_name,width,height,pix_fmt:format=format_name,duration,size',
                           '-of', 'json', path) or '{}')
    v = next((s for s in d.get('streams', []) if s.get('codec_type') == 'video'), None)
    if not v:
        return ['no picture stream (not a video or image ffprobe can read)'], '', g
    w, h, size = v.get('width'), v.get('height'), os.path.getsize(path)
    fmt = d.get('format', {})
    facts = '%dx%d %s' % (w, h, '%.1f MB' % (size / 1048576) if size >= 1048576 else '%d KB' % (size // 1024))
    if video:
        if g['size'] not in VIDEO:
            probs.append('video size token %r is not one of %s' % (g['size'], ', '.join(VIDEO)))
        elif (w, h) != VIDEO[g['size']]:
            probs.append('%dx%d, expected %dx%d for %s' % (w, h, *VIDEO[g['size']], g['size']))
        if 'mp4' not in fmt.get('format_name', ''):
            probs.append('container is %s, not MP4' % fmt.get('format_name'))
        if v.get('codec_name') != 'h264':
            probs.append('codec is %s, not H.264' % v.get('codec_name'))
        if v.get('pix_fmt') != 'yuv420p':
            probs.append('pixel format %s; yuv420p plays everywhere' % v.get('pix_fmt'))
        secs = float(fmt.get('duration') or 0)
        facts += ' %.1f s' % secs
        if not VIDEO_SECONDS[0] - 0.05 <= secs <= VIDEO_SECONDS[1] + 0.05:
            probs.append('%.1f s, outside %g-%g s' % (secs, *VIDEO_SECONDS))
        if size >= VIDEO_MAX:
            probs.append('%.0f MB, limit 500 MB' % (size / 1048576))
    else:
        real = {'png_pipe': 'png', 'png': 'png', 'mjpeg': 'jpg'}.get(v.get('codec_name'), v.get('codec_name'))
        if real != ('jpg' if g['ext'] in ('jpg', 'jpeg') else 'png'):
            probs.append('content is %s but the extension is .%s' % (real, g['ext']))
        if g['size'] == 'logo':
            if (w, h) != LOGO:
                probs.append('%dx%d, the logo is %dx%d' % (w, h, *LOGO))
        elif g['size'] not in IMAGE:
            probs.append('image size token %r is not one of %s, logo' % (g['size'], ', '.join(IMAGE)))
        elif (w, h) not in IMAGE[g['size']]:
            probs.append('%dx%d, expected %s for %s' % (w, h, ' or '.join('%dx%d' % s for s in IMAGE[g['size']]), g['size']))
        limit = THUMB_MAX if g['size'] == '4x3' else IMAGE_MAX
        if size >= limit:
            probs.append('%.0f KB, limit %d KB' % (size / 1024, limit // 1024))
    if g['size'] != 'logo':
        y = luma(path, video)
        if y is None:
            probs.append('could not measure brightness')
        else:
            facts += ' %s luma %.0f' % ('frame-0' if video else 'mean', y)
            if y < MIN_LUMA:
                probs.append('%s is dark (luma %.0f, black is 16): open on bright gameplay' % ('frame 0' if video else 'image', y))
    return probs, facts, g


def main(argv):
    partial = '--partial' in argv
    args = [a for a in argv if not a.startswith('--')]
    if [a for a in argv if a.startswith('--') and a != '--partial']:
        sys.exit(__doc__)
    folder = args[0] if args else os.path.join(os.path.dirname(HERE), 'ads')
    if not (shutil.which('ffprobe') and shutil.which('ffmpeg')):
        sys.exit('ffmpeg and ffprobe must be on PATH: install ffmpeg (https://ffmpeg.org)')
    if not os.path.isdir(folder):
        sys.exit('no folder %s' % folder)
    files = sorted(f for f in os.listdir(folder) if not f.startswith('.') and os.path.isfile(os.path.join(folder, f)))
    fails, groups, logos = 0, {}, set()
    for f in files:
        probs, facts, g = check_file(os.path.join(folder, f))
        print('%s %s  %s%s' % ('FAIL' if probs else 'PASS', f, facts, ''.join('\n     - ' + p for p in probs)))
        fails += bool(probs)
        if g:
            if g['size'] == 'logo':
                logos.add(g['game'])
            else:
                kind = 'video' if g['ext'] == 'mp4' else 'image'
                groups.setdefault((g['game'], g['creative'], g['lang'] or ''), {'video': set(), 'image': set()})[kind].add(g['size'])
    missing = 0
    for (game, creative, lang), have in sorted(groups.items()):
        langs = {k[2] for k in groups if k[:2] == (game, creative) and k[2]}
        if not lang and langs:   # only untagged stills, shared by the language groups below: checked there
            continue
        shared = groups.get((game, creative, ''), {}).get('image', set()) if lang else set()
        images = have['image'] | shared
        label = '%s_%s%s' % (game, creative, '_' + lang if lang else '')
        lacks = ['%s.mp4' % s for s in VIDEO if s not in have['video']] + ['%s still' % s for s in IMAGE if s not in images]
        if lacks:
            missing += 1
            print('%s %s: missing %s' % ('NOTE' if partial else 'MISSING', label, ', '.join(lacks)))
    for game in sorted({k[0] for k in groups} - logos):
        missing += 1
        print('%s %s_brand_logo.png (1200x1200, required for Google PMax)' % ('NOTE' if partial else 'MISSING', game))
    print('\n%d files: %d pass, %d fail%s' % (len(files), len(files) - fails, fails,
          '; %d incomplete set(s)%s' % (missing, ' (allowed by --partial)' if partial else '') if missing else ''))
    sys.exit(1 if fails or (missing and not partial) else 0)


if __name__ == '__main__':
    main(sys.argv[1:])

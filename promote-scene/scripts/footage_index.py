#!/usr/bin/env python3
# promote-scene tool version: 2026-11-27
"""Footage inventory: index every recording the kit could cut from, so a video starts from real playthroughs.
Copy to <scene>/promote/tools/footage_index.py.

  python3 promote/tools/footage_index.py [<dir or file>...] [--out DIR] [--every N]

Without arguments it scans promote/footage/ and the capture folder ($CAPTURE_OUT, default <scene>/../capture/;
its _raw/ and _frames/ are skipped). For each video (.mp4 .mov .mkv .webm .m4v) it reads resolution, frame
rate, length, size and date with ffprobe, and writes one contact sheet per minute of footage: a frame every
N seconds (default 1), 10 per row, each labelled with its timestamp, so a moment is found by reading the
sheets instead of scrubbing. Output (default promote/footage/_index/):
  INDEX.md      one table row per recording, then its sheets; the "notes" column is kept across re-runs
  index.json    the same data; edit "notes" here or in INDEX.md (what it shows, first-session or not, who played)
  <name>_<id>_<mm>.jpg  the sheets (sheet 00 is 0:00-0:59; <id> tells apart recordings with the same name)
Re-running only re-reads files that changed (size or modification time); sheets of unchanged files are kept.

The output folder is inside the scene: do not run this while an Explorer preview of the scene is up (any write
under the scene folder restarts the scene), or pass --out to a folder outside it.
Needs ffmpeg and ffprobe on PATH and Pillow.
"""
import hashlib, json, os, re, shutil, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
PROMOTE = os.path.dirname(HERE)
CAPTURE = os.environ.get('CAPTURE_OUT') or os.path.join(os.path.dirname(os.path.dirname(PROMOTE)), 'capture')
EXTS = ('.mp4', '.mov', '.mkv', '.webm', '.m4v')
SKIP_DIRS = {'_raw', '_frames', '_index', 'node_modules'}
COLS, THUMB_W = 10, 256

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit('Pillow is missing: python3 -c "import PIL" fails. Ask before installing it.')


def font(size):
    for f in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc',
              'C:\\Windows\\Fonts\\arialbd.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                        'stream=width,height,r_frame_rate:format=duration,size', '-of', 'json', path],
                       capture_output=True, text=True)
    try:
        d = json.loads(r.stdout)
        s, f = d['streams'][0], d['format']
    except (ValueError, KeyError, IndexError):
        return None
    num, _, den = s.get('r_frame_rate', '0/1').partition('/')
    fps = float(num) / float(den or 1) if float(den or 1) else 0
    return {'w': s.get('width'), 'h': s.get('height'), 'fps': round(fps, 2),
            'seconds': round(float(f.get('duration') or 0), 1), 'mb': round(int(f.get('size') or 0) / 1e6, 1)}


def md_cell(note):
    """A note as it appears in INDEX.md's table (one line, no pipes)."""
    return note.replace('|', '/').replace('\n', ' ').strip()


def hms(t):
    return '%d:%02d' % (t // 60, t % 60) if t < 3600 else '%d:%02d:%02d' % (t // 3600, t % 3600 // 60, t % 60)


def sheets(path, stem, out, every):
    """1 frame per `every` s -> sheets of 60 frames (10x6) with timestamps; returns the sheet file names."""
    tmp = tempfile.mkdtemp(prefix='fidx-')
    try:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-vf', 'fps=1/%g,scale=%d:-2' % (every, THUMB_W),
                        os.path.join(tmp, 'f-%05d.jpg')], check=True)
        frames = sorted(f for f in os.listdir(tmp) if f.endswith('.jpg'))
        names, per = [], COLS * 6
        lab = font(18)
        for k in range(0, len(frames), per):
            chunk = frames[k:k + per]
            first = Image.open(os.path.join(tmp, chunk[0]))
            tw, th = first.size
            rows = (len(chunk) + COLS - 1) // COLS
            sheet = Image.new('RGB', (COLS * tw, rows * th), (0, 0, 0))
            d = ImageDraw.Draw(sheet)
            for i, f in enumerate(chunk):
                x, y = (i % COLS) * tw, (i // COLS) * th
                sheet.paste(Image.open(os.path.join(tmp, f)).convert('RGB'), (x, y))
                t = hms((k + i) * every)
                d.rectangle([x, y, x + 12 + 11 * len(t), y + 24], fill=(0, 0, 0))
                d.text((x + 6, y + 3), t, font=lab, fill=(255, 255, 255))
            name = '%s_%02d.jpg' % (stem, k // per)
            sheet.save(os.path.join(out, name), quality=82)
            names.append(name)
        return names
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def find(paths):
    for p in paths:
        if os.path.isfile(p) and p.lower().endswith(EXTS):
            yield os.path.abspath(p)
        elif os.path.isdir(p):
            for root, dirs, files in os.walk(p):
                dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith('.'))
                for f in sorted(files):
                    if f.lower().endswith(EXTS):
                        yield os.path.abspath(os.path.join(root, f))


def main(argv):
    out, every, paths, i = os.path.join(PROMOTE, 'footage', '_index'), 1.0, [], 0
    while i < len(argv):
        a = argv[i]; i += 1
        if a in ('--out', '--every'):
            if i >= len(argv): sys.exit('%s needs a value' % a)
            v = argv[i]; i += 1
            if a == '--out': out = os.path.abspath(v)
            else: every = float(v)
        elif a.startswith('--'):
            sys.exit(__doc__)
        else:
            paths.append(a)
    for tool in ('ffmpeg', 'ffprobe'):
        if not shutil.which(tool):
            sys.exit('%s not found on PATH: install ffmpeg (https://ffmpeg.org)' % tool)
    paths = paths or [p for p in (os.path.join(PROMOTE, 'footage'), CAPTURE) if os.path.isdir(p)]
    if not paths:
        sys.exit('nothing to scan: no promote/footage/ or capture folder; pass the folders that hold recordings')
    os.makedirs(out, exist_ok=True)
    jpath = os.path.join(out, 'index.json')
    old = {e['file']: e for e in json.load(open(jpath, encoding='utf-8'))} if os.path.exists(jpath) else {}
    mpath = os.path.join(out, 'INDEX.md')
    # Notes can be edited in either file. Each entry remembers the note as last written ("written"); whichever
    # file now differs from it was edited. INDEX.md wins when both were.
    for e in old.values():
        e.setdefault('written', e.get('notes', ''))
    if os.path.exists(mpath):
        for line in open(mpath, encoding='utf-8'):
            m = re.match(r'\| \d+ \| `([^`]+)` \|.*\| ([^|]*) \|\s*$', line)
            if m and m.group(1) in old and m.group(2).strip() != md_cell(old[m.group(1)]['written']):
                old[m.group(1)]['notes'] = m.group(2).strip()
    entries = []
    for path in find(paths):
        st = os.stat(path)
        prev = old.get(path, {})
        # the path's hash keeps two recordings with the same name (two sessions' visit.mp4) from sharing sheets
        stem = '%s_%s' % (re.sub(r'[^A-Za-z0-9_-]+', '_', os.path.splitext(os.path.basename(path))[0]),
                          hashlib.sha1(path.encode('utf-8')).hexdigest()[:6])
        e = {'file': path, 'stem': stem, 'notes': prev.get('notes', ''), 'bytes': st.st_size, 'mtime': int(st.st_mtime),
             'date': time.strftime('%Y-%m-%d %H:%M', time.localtime(st.st_mtime))}
        fresh = prev.get('bytes') == st.st_size and prev.get('mtime') == int(st.st_mtime) and prev.get('every') == every \
            and all(os.path.exists(os.path.join(out, s)) for s in prev.get('sheets', []))
        if fresh:
            e.update({k: prev[k] for k in ('w', 'h', 'fps', 'seconds', 'mb', 'sheets', 'every', 'stem')})
            print('kept   ', path)
        else:
            info = probe(path)
            if not info:
                print('SKIP   %s (ffprobe found no video stream)' % path); continue
            for s in prev.get('sheets', []):
                try: os.remove(os.path.join(out, s))
                except OSError: pass
            e.update(info, every=every, sheets=sheets(path, stem, out, every))
            print('indexed %s (%dx%d, %s, %d sheets)' % (path, e['w'], e['h'], hms(int(e['seconds'])), len(e['sheets'])))
        entries.append(e)
    for e in entries:
        e['written'] = e['notes']
    json.dump(entries, open(jpath, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    total = sum(e['seconds'] for e in entries)
    md = ['# Footage index', '', '%d recordings, %s in all. Generated by footage_index.py; edit only the notes '
          '(here or in index.json), they are kept on re-runs.' % (len(entries), hms(int(total))), '',
          '| # | file | size | shape | length | fps | date | notes |', '|---|---|---|---|---|---|---|---|']
    for n, e in enumerate(entries, 1):
        shape = 'vertical' if e['h'] > e['w'] else 'square' if e['h'] == e['w'] else 'horizontal'
        md.append('| %d | `%s` | %dx%d | %s | %s | %g | %s | %s |' % (n, e['file'], e['w'], e['h'], shape,
                  hms(int(e['seconds'])), e['fps'], e['date'], md_cell(e['notes'])))
    for n, e in enumerate(entries, 1):
        md += ['', '## %d. %s' % (n, os.path.basename(e['file'])), '']
        md += ['![%s %s](%s)' % (e['stem'], s[-6:-4], s) for s in e['sheets']]
    open(mpath, 'w', encoding='utf-8').write('\n'.join(md) + '\n')
    print('wrote %s (%d recordings, %s)' % (mpath, len(entries), hms(int(total))))


if __name__ == '__main__':
    main(sys.argv[1:])

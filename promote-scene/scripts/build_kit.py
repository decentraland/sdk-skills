# Builds the marketing kit's data file and plain-text copies from promote/posts.json.
# Copy to <scene>/promote/tools/build_kit.py; re-run after every edit to posts.json or any image.
#   python3 promote/tools/build_kit.py
# Writes:
#   promote/kit-data.js          window.KIT = {...}: posts + images and logos embedded as data URIs
#                                (downscaled), so index.html works from file:// and "Copy image" works
#                                (fetch() and canvas reads of local files are blocked on file://).
#   promote/copy.md              listing copy (short/long description, handles, events) + every post as
#                                plain text, {LINK} filled in when the game is published
#   promote/footage-shotlist.md  what to record: the Foundation's screenshot/trailer asks (DEFAULT_TIPS),
#                                the scene's own tips, then one entry per footage post
# Videos: a post video rendered to promote/videos/<post id>.mp4 (and an optional <post id>-9x16.mp4) is picked
# up by file name and embedded on the page (<video> plays sibling files on file://; nothing is inlined).
# A post can also name its file explicitly with "video": "videos/<file>.mp4" in posts.json.
# While a post's video is being made, a marker file promote/videos/<post id>.rendering (content: the UTC start
# time) makes the page show a spinner on that card; delete it when the video is in place. The page re-reads
# kit-data.js every 30 s, so run this script when the marker is written and again when the video lands.
import os, re, json, base64, io, subprocess, shutil, time
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(ROOT, 'promote')
data = json.load(open(os.path.join(P, 'posts.json')))
MAXW = 1200        # preview width for embedded images; Download always uses the full-size file
LOGO_MAXW = 900
# Decentraland Foundation "New Experience: Marketing Requirements" asks that need in-world capture
# (avatars cannot be rendered). Always written first in the shot list.
# https://app.notion.com/p/decentraland/New-Experience-Marketing-Requirements-38b5f41146a580f1bd93c86f8f1ca96d
DEFAULT_TIPS = [
    'Required: one clean in-world 16:9 screenshot, 1920x1080 or larger, with no UI and no text, just gameplay with people playing.',
    'Recommended: 2-4 more 16:9 gameplay stills, at least 1920x1080, for social posts, the newsletter and press.',
    'Optional trailer: under 30 s, 16:9 1920x1080, with people in motion in the first three seconds.',
    'Trailer vertical cut: 9:16 1080x1920, under 30 s, for mobile and social.',
    'Trailer captions or on-screen text so it works with the sound off.',
]
KINDS = {'launch': 'Launch posts (with link)', 'soon': 'Coming soon', 'footage': 'Footage posts (placeholders)',
         'quote': 'Quote cards', 'bts': 'Behind the scenes'}
VIDEO_MAX_SECONDS = 30   # the Foundation's trailer limit; footage posts are shorter still


def probe_video(path):
    """Width, height, seconds and bytes of a video via ffprobe (None for the first three without it)."""
    info = {'file': os.path.relpath(path, P), 'bytes': os.path.getsize(path), 'w': None, 'h': None, 'seconds': None}
    if shutil.which('ffprobe'):
        try:
            out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                  'stream=width,height:format=duration', '-of', 'json', path],
                                 capture_output=True, text=True, timeout=30).stdout
            j = json.loads(out)
            st = (j.get('streams') or [{}])[0]
            info['w'], info['h'] = st.get('width'), st.get('height')
            info['seconds'] = round(float(j['format']['duration']), 1)
        except Exception as ex:   # a broken file is reported below, not fatal
            problems.append('ffprobe failed on %s: %s' % (info['file'], ex))
    return info


def embed(path, maxw):
    im = Image.open(path)
    w, h = im.size
    if im.width > maxw:
        im = im.resize((maxw, int(im.height * maxw / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    if im.mode in ('RGBA', 'LA') and im.getchannel('A').getextrema()[0] < 255:
        im.save(buf, 'PNG', optimize=True); mime = 'image/png'          # keep real transparency
    else:
        im.convert('RGB').save(buf, 'JPEG', quality=82, optimize=True); mime = 'image/jpeg'
    return w, h, 'data:%s;base64,%s' % (mime, base64.b64encode(buf.getvalue()).decode())


problems = []
images = {}
for key, meta in data['images'].items():
    path = os.path.join(P, meta['file'])
    if not os.path.exists(path):
        problems.append('missing image %s (%s)' % (key, meta['file']))
        images[key] = {**meta, 'missing': True}
        continue
    w, h, src = embed(path, MAXW)
    images[key] = {**meta, 'w': w, 'h': h, 'src': src}

logos = []
logo_dir = os.path.join(P, 'logo')
for f in sorted(os.listdir(logo_dir)) if os.path.isdir(logo_dir) else []:
    if f.endswith('.png'):
        w, h, src = embed(os.path.join(logo_dir, f), LOGO_MAXW)
        logos.append({'file': 'logo/' + f, 'w': w, 'h': h, 'src': src})

listing = data.get('listing') or {}
SHORT_MAX = 160   # the Foundation asks for ~140 characters / 1-3 sentences
if not listing.get('short'):
    problems.append('no listing.short (the ~140-character "what you do" description)')
elif len(listing['short']) > SHORT_MAX:
    problems.append('listing.short is %d characters; aim for ~140' % len(listing['short']))
if not listing.get('long'):
    problems.append('no listing.long (max two short paragraphs)')
data['shotlist_tips'] = DEFAULT_TIPS + [t for t in data.get('shotlist_tips', []) if t not in DEFAULT_TIPS]

videos = []   # every video in promote/videos/, for the page's Videos section
vdir = os.path.join(P, 'videos')
for f in sorted(os.listdir(vdir)) if os.path.isdir(vdir) else []:
    if f.lower().endswith(('.mp4', '.webm', '.mov')):
        videos.append(probe_video(os.path.join(vdir, f)))
by_file = {v['file']: v for v in videos}
rendering = {}   # post id -> start time, from videos/<post id>.rendering markers
for f in sorted(os.listdir(vdir)) if os.path.isdir(vdir) else []:
    if f.endswith('.rendering'):
        path = os.path.join(vdir, f)
        since = open(path).read().strip() or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(os.path.getmtime(path)))
        rendering[f[:-len('.rendering')]] = since
        if time.time() - os.path.getmtime(path) > 3 * 3600:
            problems.append('videos/%s is over 3 hours old: delete it if nothing is rendering' % f)

link_for_count = data.get('link') or 'https://decentraland.org/jump/?realm=example.dcl.eth'   # a placeholder link still costs 23
for p in data['posts']:
    for k in ('image', 'ig_image'):
        if p.get(k) and p[k] not in data['images']:
            problems.append('post %s: unknown image key %r' % (p['id'], p[k]))
    if p['kind'] not in KINDS:
        problems.append('post %s: unknown kind %r' % (p['id'], p['kind']))
    x_len = len(re.sub(r'https?://\S+', 'x' * 23, p['text'].replace('{LINK}', link_for_count)))   # every URL counts 23 on X
    if x_len > 280:
        problems.append('post %s: %d characters on X (over 280 with the link counted as 23); shorten it' % (p['id'], x_len))
    if p['kind'] == 'footage' and not p.get('footage'):
        problems.append('post %s: footage post without a "footage" note' % p['id'])
    # a rendered video for this post: explicit "video" key, else videos/<id>.mp4 (+ videos/<id>-9x16.mp4)
    vfile = p.get('video') or ('videos/%s.mp4' % p['id'] if 'videos/%s.mp4' % p['id'] in by_file else None)
    if vfile:
        if vfile not in by_file:
            problems.append('post %s: video %s not found' % (p['id'], vfile))
            p.pop('video', None)
        else:
            v = dict(by_file[vfile])
            tall = 'videos/%s-9x16.mp4' % p['id']
            if tall in by_file:
                v['vertical'] = by_file[tall]
            p['video'] = v
            if v['seconds'] and v['seconds'] > VIDEO_MAX_SECONDS:
                problems.append('post %s: video is %.0f s; the Foundation asks for under %d' % (p['id'], v['seconds'], VIDEO_MAX_SECONDS))
            if v['w'] and (v['w'], v['h']) != (1920, 1080):
                problems.append('post %s: video is %dx%d, not 1920x1080' % (p['id'], v['w'], v['h']))
    elif p.get('video'):
        p.pop('video', None)
    if p['id'] in rendering:   # with a video already there this is a redo: the page keeps playing the old one and says so
        p['video_status'] = {'state': 'rendering', 'since': rendering[p['id']]}
    else:
        p.pop('video_status', None)

out = {k: v for k, v in data.items() if k not in ('images', 'quote_cards', 'keyart')}
out['images'] = images
out['logos'] = logos
out['videos'] = videos
out['built_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
wm = next((l for l in logos if l['file'].endswith('_wordmark.png')), None)
out['wordmark'] = wm['src'] if wm else ''
js = 'window.KIT = ' + json.dumps(out) + ';\n'
open(os.path.join(P, 'kit-data.js'), 'w').write(js)
print('kit-data.js', len(js) // 1024, 'KB')

link = data.get('link') or '{LINK}'
game = data['game']

md = ['# %s: social copy' % game, '',
      'Link to the game: %s' % (data.get('link') or '`{LINK}` (not published yet: fill in after deploying)'), '',
      'Hashtags: %s' % ' '.join(data['hashtags']['core'] + data['hashtags'].get('extra', [])), '',
      'Placeholders: `{LINK}` is the game link; `{N}` and `{DATE}` are yours; `[FOOTAGE]` marks where a clip goes.', '']
if listing:
    md += ['## Listing copy', '', 'For the Places card (`display.description`), profiles, press and the Foundation marketing package.', '']
    if listing.get('short'):
        md += ['### Short description (%d characters)' % len(listing['short']), '', listing['short'], '']
    if listing.get('long'):
        md += ['### Long description', '', listing['long'], '']
    if listing.get('handles'):
        md += ['### Handles', ''] + ['- %s: %s' % (k, v) for k, v in listing['handles'].items()] + ['']
    if listing.get('events'):
        md += ['### Recurring moments (UTC)', '', listing['events'], '']
for kind, title in KINDS.items():
    posts = [p for p in data['posts'] if p['kind'] == kind]
    if not posts:
        continue
    md += ['## ' + title, '']
    for p in posts:
        md += ['### %s  (`%s`)' % (p['title'], p['id']), '']
        md += [('> ' + l).rstrip() for l in p['text'].replace('{LINK}', link).split('\n')]
        md += ['', 'Image: `%s`' % data['images'].get(p['image'], {}).get('file', p['image'])]
        if p.get('footage'):
            md += ['', 'Footage: ' + p['footage']]
        if p.get('video'):
            v = p['video']
            md += ['', 'Video: `%s`%s%s' % (v['file'], ' (%.0f s)' % v['seconds'] if v['seconds'] else '',
                                              ' + vertical `%s`' % v['vertical']['file'] if v.get('vertical') else '')]
        md += ['']
open(os.path.join(P, 'copy.md'), 'w').write('\n'.join(md))

sl = ['# %s: footage shot list' % game, '', 'What to record in the Explorer for the footage posts, and how.', '',
      '## Tips', ''] + ['- ' + t for t in data.get('shotlist_tips', [])] + ['', '## Shots', '']
for p in data['posts']:
    if p.get('footage'):
        sl += ['### %s  (`%s`)' % (p['title'], p['id']), '', p['footage'], '',
               'Caption: ' + p['text'].replace('\n', ' ').replace('{LINK}', link), '']
        if p.get('video'):
            sl += ['Video in the kit: `%s`. A recording from the Explorer still beats it: drop one in `promote/footage/` and ask for the video again.' % p['video']['file'], '']
open(os.path.join(P, 'footage-shotlist.md'), 'w').write('\n'.join(sl))
print('copy.md and footage-shotlist.md written')
if rendering:
    print('rendering markers:', ', '.join('%s (since %s)' % kv for kv in rendering.items()))
if videos:
    print('videos:', ', '.join('%s (%s)' % (v['file'], '%.0f s' % v['seconds'] if v['seconds'] else '?') for v in videos))
for pr in problems:
    print('WARNING:', pr)

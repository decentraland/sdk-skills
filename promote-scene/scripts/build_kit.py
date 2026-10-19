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
import os, json, base64, io
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

for p in data['posts']:
    for k in ('image', 'ig_image'):
        if p.get(k) and p[k] not in data['images']:
            problems.append('post %s: unknown image key %r' % (p['id'], p[k]))
    if p['kind'] not in KINDS:
        problems.append('post %s: unknown kind %r' % (p['id'], p['kind']))
    if p['kind'] == 'footage' and not p.get('footage'):
        problems.append('post %s: footage post without a "footage" note' % p['id'])

out = {k: v for k, v in data.items() if k not in ('images', 'quote_cards', 'keyart')}
out['images'] = images
out['logos'] = logos
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
        md += ['']
open(os.path.join(P, 'copy.md'), 'w').write('\n'.join(md))

sl = ['# %s: footage shot list' % game, '', 'What to record in the Explorer for the footage posts, and how.', '',
      '## Tips', ''] + ['- ' + t for t in data.get('shotlist_tips', [])] + ['', '## Shots', '']
for p in data['posts']:
    if p.get('footage'):
        sl += ['### %s  (`%s`)' % (p['title'], p['id']), '', p['footage'], '',
               'Caption: ' + p['text'].replace('\n', ' ').replace('{LINK}', link), '']
open(os.path.join(P, 'footage-shotlist.md'), 'w').write('\n'.join(sl))
print('copy.md and footage-shotlist.md written')
for pr in problems:
    print('WARNING:', pr)

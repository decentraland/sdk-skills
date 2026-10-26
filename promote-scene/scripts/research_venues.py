#!/usr/bin/env python3
# Venue research helper for the audience step (references/audience-and-venues.md). No API keys.
#   python3 research_venues.py reddit LiminalSpace IndieDev        top posts of the year per subreddit (title + URL)
#   python3 research_venues.py reddit-new LiminalSpace              what they posted this week
#   python3 research_venues.py shorts "liminal horror game"          YouTube Shorts for a query (title, URL, views)
#   python3 research_venues.py videos "how to market a game"          regular YouTube results (title, URL, views, length)
# What works and what does not (measured 2026-10-22):
#   - reddit.com/r/<sub>/about.json and /about/rules.json answer with a block page without auth: no member counts or
#     rules from here. Read the rules from the live sidebar (ask the creator) or a third-party mirror such as
#     subriff.com/subreddit/<sub> or gummysearch.com/r/<sub>/, and record the URL and the date.
#   - reddit.com/r/<sub>/top/.rss?t=year works, but back-to-back requests get rate-limited (an empty body): this
#     script waits between subreddits and retries once. Titles are the evidence for "modelled_on".
#   - youtube.com/results works: the page carries ytInitialData with titles, ids and view counts.
#   - Web-search tools generally cannot read reddit.com; use them for the mirrors, not for the sub itself.
# Everything printed is evidence to cite, never to invent: copy title + URL into posts.json as found.
import sys, re, json, time, shutil, subprocess, urllib.request, urllib.parse, xml.etree.ElementTree as ET

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'


def fetch(url):
    """curl first (python.org builds on macOS often lack root certificates for urllib), urllib as the fallback."""
    if shutil.which('curl'):
        r = subprocess.run(['curl', '-sL', '-A', UA, '-H', 'Accept-Language: en-US,en;q=0.8', '--max-time', '30', url],
                           capture_output=True, timeout=45)
        if r.stdout.strip():
            return r.stdout
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.8'})
    return urllib.request.urlopen(req, timeout=30).read()


def get(url, tries=2, pause=12):
    for i in range(tries):
        try:
            body = fetch(url)
            if body.strip():
                return body
        except Exception as ex:
            print('  (%s)' % ex, file=sys.stderr)
        if i + 1 < tries:
            print('  empty answer, waiting %ds before retrying' % pause, file=sys.stderr)
            time.sleep(pause)
    return b''


def reddit(sub, listing='top', t='year', limit=15):
    url = 'https://www.reddit.com/r/%s/%s/.rss?%s' % (sub, listing, urllib.parse.urlencode({'t': t, 'limit': limit}))
    body = get(url)
    if b'<feed' not in body[:3000]:
        print('r/%s: no feed (blocked or rate-limited); open %s in a browser' % (sub, url.replace('/.rss', '')))
        return []
    ns = {'a': 'http://www.w3.org/2005/Atom'}
    out = []
    for e in ET.fromstring(body).findall('a:entry', ns):
        out.append((e.find('a:title', ns).text or '', e.find('a:link', ns).get('href'), (e.find('a:updated', ns).text or '')[:10]))
    return out


def youtube(query, shorts=True, limit=25):
    params = {'search_query': query}
    if shorts:
        params['sp'] = 'EgIYAQ=='   # type: video; Shorts show up as shortsLockupViewModel
    body = get('https://www.youtube.com/results?' + urllib.parse.urlencode(params), tries=1)
    m = re.search(rb'var ytInitialData = (\{.*?\});</script>', body, re.S)
    if not m:
        print('youtube: no ytInitialData in the answer')
        return []
    out = []

    def walk(o):
        if isinstance(o, dict):
            v = o.get('shortsLockupViewModel')
            if v:
                try:
                    out.append((v['overlayMetadata']['primaryText']['content'],
                                'https://www.youtube.com/shorts/' + v['onTap']['innertubeCommand']['reelWatchEndpoint']['videoId'],
                                v['overlayMetadata']['secondaryText']['content'], 'short'))
                except Exception:
                    pass
            v = o.get('videoRenderer')
            if v:
                title = ''.join(r.get('text', '') for r in v.get('title', {}).get('runs', []))
                views = v.get('viewCountText', {}).get('simpleText') or ''
                out.append((title, 'https://www.youtube.com/watch?v=' + v.get('videoId', ''), views, v.get('lengthText', {}).get('simpleText', '')))
            for x in o.values():
                walk(x)
        elif isinstance(o, list):
            for x in o:
                walk(x)
    walk(json.loads(m.group(1)))
    return out[:limit]


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__ or open(__file__).read().split('import sys')[0]); sys.exit(1)
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd in ('reddit', 'reddit-new'):
        for i, sub in enumerate(args):
            if i:
                time.sleep(12)   # the feed rate-limits quick successive requests
            rows = reddit(sub, 'new', 'all', 12) if cmd == 'reddit-new' else reddit(sub)
            print('== r/%s (%s)' % (sub, 'newest' if cmd == 'reddit-new' else 'top of the year'))
            for title, link, date in rows:
                print('  - %s | %s | %s' % (title[:110], link, date))
    elif cmd in ('shorts', 'videos'):
        for title, link, views, extra in youtube(' '.join(args), shorts=(cmd == 'shorts')):
            print('  - %s | %s | %s | %s' % (title[:95], link, views, extra))
    else:
        print('unknown command', cmd); sys.exit(1)

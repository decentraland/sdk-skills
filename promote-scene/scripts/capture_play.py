#!/usr/bin/env python3
# Records real gameplay for footage posts by driving the Decentraland Explorer through its MCP server
# (the one `npm run start -- --mcp` turns on) and grabbing frames with its screenshot tool.
# Copy to <scene>/promote/tools/capture_play.py next to a takes.py that describes the scene's shots.
#
#   python3 promote/tools/capture_play.py probe             scene/player state and the frame rate the screenshot tool gives
#   python3 promote/tools/capture_play.py take <name>...    run takes from takes.py (all, in order, when no name is given)
#   python3 promote/tools/capture_play.py assemble <frames dir> <out.mp4> [--smooth]
#
# takes.py defines TAKES = {"woods-apparition": fn, ...}; each fn(ex, rec) moves the player with `ex` and
# wraps the stretch to record in `with rec.take("woods-apparition"):`. Frames land in promote/footage/_frames/<take>/
# and the assembled clip in promote/footage/<take>.mp4 (1920x1080, 30 fps, H.264), ready for edits.ts
# as { video: "footage/<take>.mp4" }.
#
# RECORD OUTSIDE THE SCENE FOLDER. The dev server rebuilds and restarts the scene whenever any file under
# it changes, promote/ included (.dclignore does not stop the watcher), and a restart mid-take puts the title
# card back and locks the player. So frames and clips go to $CAPTURE_OUT (default: a capture/ folder next to
# the scene folder); copy the finished clips into promote/footage/ once all takes are done. The same goes for
# editing takes.py while the Explorer is up: edit a copy elsewhere, or expect a restart.
#
# Why frames and not a screen recording: the Explorer's screenshot tool is the one capture that needs no
# OS permission. It serialises captures, so expect 3-6 frames/s; the assembler keeps each frame for the
# time it really took, so motion stays in real time. --smooth adds motion interpolation (slow pans look
# good, fast cuts smear: try both). A real screen recording at 60 fps beats it whenever you can grant
# Screen Recording to the terminal (macOS: screencapture -V <seconds> <file>).
import base64, json, os, subprocess, sys, threading, time, urllib.request

PORT = int(os.environ.get('MCP_PORT', '8123'))
URL = 'http://127.0.0.1:%d/unity-explorer-mcp' % PORT
HERE = os.path.dirname(os.path.abspath(__file__))
PROMOTE = os.path.dirname(HERE)
FOOTAGE = os.path.join(PROMOTE, 'footage')
OUT = os.environ.get('CAPTURE_OUT') or os.path.join(os.path.dirname(os.path.dirname(PROMOTE)), 'capture')
FRAME_WIDTH = 1920


def rpc(method, params=None, timeout=60):
    body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params or {}}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'})
    raw = urllib.request.urlopen(req, timeout=timeout).read().decode('utf-8', 'replace')
    try:
        resp = json.loads(raw)
    except json.JSONDecodeError:   # SSE framing: data: lines
        resp = json.loads(''.join(l[5:].strip() for l in raw.splitlines() if l.startswith('data:')))
    if resp.get('error'):
        raise RuntimeError('MCP error %s: %s' % (resp['error'].get('code'), resp['error'].get('message')))
    return resp.get('result') or {}


class Explorer:
    """One call per MCP tool. Results are the tool's JSON payload (parsed) or its text."""

    def __init__(self):
        try:
            rpc('initialize', {'protocolVersion': '2025-06-18', 'capabilities': {},
                               'clientInfo': {'name': 'capture_play', 'version': '1'}}, timeout=10)
        except Exception:
            pass   # the screenshot script works without it; so does tools/call

    def call(self, name, **args):
        result = rpc('tools/call', {'name': name, 'arguments': args})
        text = ''.join(c.get('text', '') for c in result.get('content', []) if c.get('type') == 'text')
        if result.get('isError'):
            raise RuntimeError('%s failed: %s' % (name, text[:400]))
        try:
            return json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return text

    # thin helpers (argument names as the tools document them)
    def scene_state(self): return self.call('get_scene_state')
    def player(self): return self.call('get_player_state')
    def logs(self, **a): return self.call('get_scene_logs', **a)
    def move_to(self, x, y, z, look=None):
        a = {'x': x, 'y': y, 'z': z}
        if look: a.update({'lookAtX': look[0], 'lookAtY': look[1], 'lookAtZ': look[2]})
        return self.call('move_to', **a)
    def look_at(self, x, y, z): return self.call('look_at', x=x, y=y, z=z)
    def walk(self, seconds, dx=0, dy=1, kind='jog'): return self.call('walk', directionX=dx, directionY=dy, seconds=seconds, kind=kind)
    def press(self, action, **a): return self.call('press_input', action=action, **a)
    def camera_mode(self, mode): return self.call('set_camera_mode', mode=mode)

    def wait_ready(self, timeout=300):
        t0 = time.time()
        while time.time() - t0 < timeout:
            try:
                s = self.scene_state()
                if isinstance(s, dict) and (s.get('isReady') or (s.get('scene') or {}).get('isReady')):
                    return s
            except Exception as ex:
                err = ex
            time.sleep(2)
        raise RuntimeError('scene not ready after %ds' % timeout)

    def pos(self):
        p = self.player()
        pp = p.get('position') or p.get('player', {}).get('position') or {}
        return pp.get('x'), pp.get('y'), pp.get('z')


class Recorder:
    """Background frame grabber. `with rec.take(name):` records until the block ends."""

    def __init__(self, ex, width=FRAME_WIDTH, world_only=True):
        self.ex, self.width, self.world_only = ex, width, world_only
        self.dir = None; self.stamps = []; self.thread = None; self.stop = False

    def _loop(self):
        n = 0
        while not self.stop:
            t = time.monotonic()
            try:
                r = rpc('tools/call', {'name': 'screenshot', 'arguments': {'maxWidth': self.width, 'quality': 'jpg', 'worldOnly': self.world_only}}, timeout=30)
                img = next((c for c in r.get('content', []) if c.get('type') == 'image'), None)
                if img:
                    n += 1
                    open(os.path.join(self.dir, 'f-%05d.jpg' % n), 'wb').write(base64.b64decode(img['data']))
                    self.stamps.append(t)
            except Exception as ex:
                print('  frame error:', str(ex)[:120])
                time.sleep(0.3)

    def take(self, name):
        rec = self

        class Take:
            def __enter__(self_):
                rec.dir = os.path.join(OUT, '_frames', name)
                os.makedirs(rec.dir, exist_ok=True)
                for f in os.listdir(rec.dir): os.remove(os.path.join(rec.dir, f))
                rec.stamps = []; rec.stop = False
                rec.thread = threading.Thread(target=rec._loop, daemon=True); rec.thread.start()
                print('REC', name)
            def __exit__(self_, *a):
                rec.stop = True; rec.thread.join(timeout=40)
                secs = (rec.stamps[-1] - rec.stamps[0]) if len(rec.stamps) > 1 else 0
                json.dump(rec.stamps, open(os.path.join(rec.dir, 'stamps.json'), 'w'))
                print('STOP %s: %d frames over %.1f s (%.1f fps)' % (name, len(rec.stamps), secs, len(rec.stamps) / secs if secs else 0))
                if len(rec.stamps) > 2:
                    assemble(rec.dir, os.path.join(OUT, name + '.mp4'))
        return Take()


def assemble(frames_dir, out, smooth=False):
    """Frames + their timestamps -> 1920x1080 30 fps H.264 (centre-cropped if the window is not 16:9)."""
    stamps = json.load(open(os.path.join(frames_dir, 'stamps.json')))
    frames = sorted(f for f in os.listdir(frames_dir) if f.endswith('.jpg'))
    lst = os.path.join(frames_dir, 'list.txt')
    with open(lst, 'w') as f:
        for i, name in enumerate(frames):
            dur = (stamps[i + 1] - stamps[i]) if i + 1 < len(stamps) else (stamps[-1] - stamps[-2] if len(stamps) > 1 else 0.2)
            f.write("file '%s'\nduration %.4f\n" % (name, max(dur, 0.01)))
        f.write("file '%s'\n" % frames[-1])
    vf = 'scale=1920:-2:flags=lanczos,crop=1920:1080,setsar=1,'
    vf += ('minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1' if smooth else 'fps=30')
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-vf', vf,
           '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out]
    subprocess.run(cmd, check=True)
    print('wrote', out, '(%d frames%s)' % (len(frames), ', smoothed' if smooth else ''))


def probe():
    ex = Explorer()
    s = ex.scene_state(); print('scene:', json.dumps(s)[:600])
    p = ex.player(); print('player:', json.dumps(p)[:600])
    t = time.monotonic(); n = 0
    while time.monotonic() - t < 4:
        r = rpc('tools/call', {'name': 'screenshot', 'arguments': {'maxWidth': FRAME_WIDTH, 'quality': 'jpg', 'worldOnly': True}})
        n += 1
    cap = ''.join(c.get('text', '') for c in r.get('content', []) if c.get('type') == 'text')
    print('screenshot: %.1f frames/s, %s' % (n / (time.monotonic() - t), cap))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'probe'
    if cmd == 'probe':
        probe()
    elif cmd == 'assemble':
        assemble(sys.argv[2], sys.argv[3], smooth='--smooth' in sys.argv)
    elif cmd == 'take':
        sys.path.insert(0, HERE)
        import takes
        ex = Explorer(); rec = Recorder(ex)
        names = [a for a in sys.argv[2:] if not a.startswith('--')] or list(takes.TAKES)
        for name in names:
            print('== take', name); t0 = time.time()
            try:
                takes.TAKES[name](ex, rec)
            except Exception as e:
                print('FAILED', name, ':', str(e)[:300])
            print('   %.0f s' % (time.time() - t0))
    else:
        sys.exit(__doc__)

#!/usr/bin/env python3
"""Records real gameplay for footage posts by driving the Decentraland Explorer through its MCP server
(the one `npm run start -- --mcp` turns on). Two frame sources, same takes:
  --screen   macOS screen recording of one display (smooth, the display's own frame rate). Preferred.
  (default)  bursts of the Explorer's screenshot tool (12-14 frames/s, stepped). Needs no OS permission.
Copy to <scene>/promote/tools/capture_play.py next to a takes.py that describes the scene's shots.

  python3 promote/tools/capture_play.py probe [--screen [--display N]]   scene/player state and the frame rate
  python3 promote/tools/capture_play.py take [<name>...] [--screen [--display N] [--audio-device UID]] [--no-begin]
  python3 promote/tools/capture_play.py assemble <frames dir> <out.mp4> [--smooth]

takes.py defines TAKES = {"woods-apparition": fn, ...}; each fn(ex, rec) moves the player with `ex` and
wraps the stretch to record in `with rec.take("woods-apparition"):`. `take` with no name runs them all, in
order. An optional begin(ex) in takes.py runs once before the first take (title card away, cheats, overlay
off); `--no-begin` skips it. Every take ends as $CAPTURE_OUT/<take>.mp4 (1920x1080, constant 30 fps, H.264,
no audio); copy the clips you keep into promote/footage/, ready for edits.ts as { video: "footage/<take>.mp4" }.
Raw material stays beside it: $CAPTURE_OUT/_raw/<take>.mov (screen) or $CAPTURE_OUT/_frames/<take>/ (frames).
Needs ffmpeg on PATH (the clip is encoded at the end of every take).

RECORD OUTSIDE THE SCENE FOLDER. The dev server rebuilds and restarts the scene whenever any file under
it changes, promote/ included (.dclignore does not stop the watcher), and a restart mid-take puts the title
card back and locks the player. So raw files and clips go to $CAPTURE_OUT (default: a capture/ folder next
to the scene folder). The same goes for editing takes.py while the Explorer is up: edit a copy elsewhere, or
expect a restart.

SCREEN MODE (macOS only; elsewhere record the takes with OBS while the script drives them). `screencapture`
records the whole display N (1 = main; menu bar, other windows and the Explorer's HUD included) at its
native pixel size, so put the Explorer full-screen on a 1920x1080 display and pass that display; a Retina
display records larger and is scaled and centre-cropped to 1920x1080. `probe --screen --display N` saves one frame of display N to
$CAPTURE_OUT/_raw/probe-display<N>.jpg (read it to confirm the display) and prints the recorded frame rate.
The recording is variable frame rate (a frame only when the screen changes); the encode makes it constant.
Needs the Screen & System Audio Recording permission for the app the shell runs in (Terminal, iTerm,
VS Code, Cursor...): the creator turns it on in System Settings > Privacy & Security, then quits and reopens
that app. Without it screencapture writes nothing; the script checks with a 1 s recording first and stops.
PRIVACY: everything on that display is recorded. Before recording, turn on Do Not Disturb (Focus) and move
chats, mail and other private windows off it. The permission stays on for that app (and everything later
run from it) until the creator turns it off in the same pane.
Audio is off by default (the footage is used muted). --audio-device takes a CoreAudio device UID (e.g.
BlackHole2ch_UID for the BlackHole loopback driver, which only hears the game when the system output is a
Multi-Output Device that includes it); screencapture's -g would record the microphone, not the game.

FRAMES MODE (the fallback when the permission is not granted): the screenshot tool serialises captures,
12-14 frames/s at 1920 wide, world-only (no HUD), measured on Apple Silicon (fewer on slower machines;
`probe` prints the real rate). The assembler keeps each frame for the time it really took, so motion stays
in real time but steps. `assemble ... --smooth` adds motion interpolation (slow pans look good, fast cuts
smear: try both).
"""
import base64, json, os, shutil, signal, subprocess, sys, threading, time, urllib.request

PORT = int(os.environ.get('MCP_PORT', '8123'))
URL = 'http://127.0.0.1:%d/unity-explorer-mcp' % PORT
HERE = os.path.dirname(os.path.abspath(__file__))
PROMOTE = os.path.dirname(HERE)
FOOTAGE = os.path.join(PROMOTE, 'footage')
OUT = os.environ.get('CAPTURE_OUT') or os.path.join(os.path.dirname(os.path.dirname(PROMOTE)), 'capture')
RAW = os.path.join(OUT, '_raw')
FRAME_WIDTH = 1920
SETTINGS_PANE = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
SCREEN_LEAD_IN = 0.5   # s between starting screencapture and handing control back to the take


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
    def camera_pose(self, x, y, z, look=None):
        a = {'x': x, 'y': y, 'z': z}
        if look: a.update({'lookAtX': look[0], 'lookAtY': look[1], 'lookAtZ': look[2]})
        return self.call('set_camera_pose', **a)

    def back_to_player(self, mode='third_person', timeout=6):
        """Leave a free-camera pose and confirm the mode took: set_camera_mode can answer without the
        camera returning, and the next take is then recorded from the stale pose."""
        norm = lambda m: str(m or '').replace('_', '').lower()   # 'third_person' / 'ThirdPerson'
        self.camera_mode(mode)
        t0 = time.time()
        while time.time() - t0 < timeout:
            p = self.player()
            if isinstance(p, dict) and norm((p.get('camera') or {}).get('mode')) == norm(mode):
                return p
            time.sleep(0.5)
        raise RuntimeError('camera still not %s after %ds; fix it before the next take' % (mode, timeout))

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
    """`with rec.take(name):` records until the block ends: a screen recording of display `screen` when
    it is set, otherwise a background frame grabber on the screenshot tool."""

    def __init__(self, ex, width=FRAME_WIDTH, world_only=True, screen=None, audio_device=None):
        self.ex, self.width, self.world_only = ex, width, world_only
        self.dir = None; self.stamps = []; self.thread = None; self.stop = False
        self.screen, self.audio_device, self.proc, self.raw = screen, audio_device, None, None

    def _start_screen(self, name):
        os.makedirs(RAW, exist_ok=True)
        self.raw = os.path.join(RAW, name + '.mov')
        if os.path.exists(self.raw): os.remove(self.raw)
        # -v records until SIGINT; stdin from /dev/null does not stop it (checked 2026-11-19)
        self.proc = subprocess.Popen(screencapture_cmd(self.screen, self.audio_device, '-v', self.raw),
                                     stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        time.sleep(SCREEN_LEAD_IN)
        if self.proc.poll() is not None:
            err = self.proc.communicate()[1]
            raise RuntimeError('screencapture stopped at once (exit %s): %s' % (self.proc.returncode, err.strip()[:300]))

    def _stop_screen(self, name):
        p, self.proc = self.proc, None
        p.send_signal(signal.SIGINT)   # SIGINT finalises the .mov; SIGTERM leaves no file at all
        try:
            err = p.communicate(timeout=15)[1]
        except subprocess.TimeoutExpired:
            p.kill(); p.communicate()
            raise RuntimeError('screencapture did not stop within 15 s; %s is probably unusable' % self.raw)
        if not os.path.exists(self.raw) or os.path.getsize(self.raw) == 0:
            raise RuntimeError('screencapture left no file for %s (exit %s): %s' % (name, p.returncode, (err or '').strip()[:300]))
        n, secs, size = probe_video(self.raw)
        if n:
            print('STOP %s: %d frames over %.1f s (%.1f fps average, %s)' % (name, n, secs, n / secs if secs else 0, size))
        normalize(self.raw, os.path.join(OUT, name + '.mp4'), audio=bool(self.audio_device))

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

        class ScreenTake:
            def __enter__(self_):
                rec._start_screen(name)
                print('REC', name, '(screen, display %s)' % rec.screen)
            def __exit__(self_, exc_type, exc, tb):
                if exc_type is None:
                    rec._stop_screen(name)
                    return
                try:   # the take failed: still finalise the recording, but never hide the take's own error
                    rec._stop_screen(name)
                except Exception as cleanup:
                    print('  (screen recording cleanup also failed: %s)' % str(cleanup)[:200])

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
                json.dump(rec.stamps, open(os.path.join(rec.dir, 'stamps.json'), 'w', encoding='utf-8'))
                print('STOP %s: %d frames over %.1f s (%.1f fps)' % (name, len(rec.stamps), secs, len(rec.stamps) / secs if secs else 0))
                if len(rec.stamps) > 2:
                    assemble(rec.dir, os.path.join(OUT, name + '.mp4'))
        return ScreenTake() if rec.screen is not None else Take()


def assemble(frames_dir, out, smooth=False):
    """Frames + their timestamps -> 1920x1080 30 fps H.264 (centre-cropped if the window is not 16:9)."""
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg not found on PATH: install it (https://ffmpeg.org) to assemble the frames in %s' % frames_dir)
    stamps = json.load(open(os.path.join(frames_dir, 'stamps.json'), encoding='utf-8'))
    frames = sorted(f for f in os.listdir(frames_dir) if f.endswith('.jpg'))
    lst = os.path.join(frames_dir, 'list.txt')
    with open(lst, 'w', encoding='utf-8') as f:
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


def normalize(raw, out, audio=False):
    """Variable-rate screen recording -> 1920x1080 constant 30 fps H.264 (scaled to cover, centre-cropped)."""
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg not found on PATH: install it (https://ffmpeg.org) to encode %s' % raw)
    vf = 'scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1,fps=30'
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-vf', vf, '-r', '30',
           '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium']
    cmd += ['-c:a', 'aac', '-b:a', '192k'] if audio else ['-an']
    subprocess.run(cmd + ['-movflags', '+faststart', out], check=True)
    print('wrote', out, '(screen recording, 1920x1080 30 fps%s)' % (', with audio' if audio else ''))


def probe_video(path):
    """(video frames, seconds between first and last, 'WxH') from ffprobe; (0, 0, '') without ffprobe."""
    if not shutil.which('ffprobe'):
        return 0, 0, ''
    run = lambda *a: subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', *a, '-of', 'csv=p=0', path],
                                    capture_output=True, text=True).stdout.split()
    pts = sorted(float(t.strip(',')) for t in run('-show_entries', 'packet=pts_time') if t.strip(',') not in ('', 'N/A'))
    wh = run('-show_entries', 'stream=width,height')
    return len(pts), (pts[-1] - pts[0]) if len(pts) > 1 else 0, (wh[0].strip(',').replace(',', 'x') if wh else '')


def screencapture_cmd(display, audio_device, *tail):
    """The one place the screencapture command line is built: silent, display N, optional audio device UID."""
    return ['screencapture', '-x', '-D', str(display)] + (['-G', audio_device] if audio_device else []) + list(tail)


def record_fixed(display, seconds, path, audio_device=None):
    """Fixed-length recording (the permission check and the probe). Any failure exits with the fix, not a traceback."""
    if os.path.exists(path): os.remove(path)
    try:
        r = subprocess.run(screencapture_cmd(display, audio_device, '-V', str(seconds), path),
                           capture_output=True, text=True, timeout=seconds + 30)
        err, code = r.stderr.strip(), r.returncode
    except subprocess.TimeoutExpired:
        err, code = 'no answer after %d s' % (seconds + 30), 'timeout'
    if 'Invalid display' in err:
        sys.exit('display %s: %s' % (display, err[:200]))
    if 'audio device' in err:
        sys.exit('%s\n--audio-device takes the CoreAudio device UID (e.g. BlackHole2ch_UID), not its display name.' % err[:200])
    if code != 0 or not os.path.exists(path) or os.path.getsize(path) == 0:
        sys.exit('screencapture recorded nothing from display %s (exit %s%s).\n'
                 'Usually the Screen & System Audio Recording permission is off for the app this shell runs in.\n'
                 'Open the pane with:  open "%s"\n'
                 'turn that app on (Terminal, iTerm, VS Code, Cursor...), quit and reopen it, then run this again.\n'
                 'Without --screen, takes record frames and need no permission.'
                 % (display, code, (': ' + err[:200]) if err else '', SETTINGS_PANE))
    return path


def screen_check(display, audio_device=None):
    """1 s test recording of the display. Exits with the fix when nothing is written (permission missing)."""
    if sys.platform != 'darwin':
        sys.exit('--screen uses macOS screencapture. On Windows or Linux, record the display with OBS '
                 '(https://obsproject.com) while `take` drives the Explorer, or drop --screen to record frames.')
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg not found on PATH: install it (https://ffmpeg.org); every screen take is encoded with it')
    os.makedirs(RAW, exist_ok=True)
    os.remove(record_fixed(display, 1, os.path.join(RAW, '_screen-check.mov'), audio_device))


def probe(screen=None):
    ex = Explorer()
    s = ex.scene_state(); print('scene:', json.dumps(s)[:600])
    p = ex.player(); print('player:', json.dumps(p)[:600])
    t = time.monotonic(); n = 0
    while time.monotonic() - t < 4:
        r = rpc('tools/call', {'name': 'screenshot', 'arguments': {'maxWidth': FRAME_WIDTH, 'quality': 'jpg', 'worldOnly': True}})
        n += 1
    cap = ''.join(c.get('text', '') for c in r.get('content', []) if c.get('type') == 'text')
    print('screenshot: %.1f frames/s, %s' % (n / (time.monotonic() - t), cap))
    if screen is not None:
        screen_check(screen)
        mov = record_fixed(screen, 3, os.path.join(RAW, 'probe-display%s.mov' % screen))
        jpg = os.path.join(RAW, 'probe-display%s.jpg' % screen)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mov, '-frames:v', '1', jpg], check=True)
        n, secs, size = probe_video(mov)
        os.remove(mov)
        print('screen: display %s records %s, %d frames over %.1f s (%.1f fps; variable: a still screen gives fewer)'
              % (screen, size or '?', n, secs, n / secs if secs else 0) if n else 'screen: recorded (ffprobe missing, no rate)')
        print('screen: one frame of display %s is in %s; read it to confirm the Explorer fills it' % (screen, jpg))


OPTIONS = {'probe': ('screen', 'display'), 'take': ('screen', 'display', 'audio-device', 'no-begin'),
           'assemble': ('smooth',)}


def split_args(cmd, argv, valued=('display', 'audio-device')):
    """argv -> (positional args, {option: value or True}); takes --opt v and --opt=v for valued options.
    Exits on an option `cmd` does not take, so a typo (--Screen, --no-begn) is not silently ignored."""
    pos, opts, i = [], {}, 0
    while i < len(argv):
        a = argv[i]; i += 1
        if not a.startswith('--'):
            pos.append(a); continue
        k, eq, v = a[2:].partition('=')
        if k not in OPTIONS[cmd]:
            sys.exit('%s: unknown option --%s (takes: %s)' % (cmd, k, ', '.join('--' + o for o in OPTIONS[cmd])))
        if k in valued and not eq:
            if i >= len(argv): sys.exit('--%s needs a value' % k)
            v = argv[i]; i += 1
        opts[k] = v if (eq or k in valued) else True
    return pos, opts


def screen_display(opts):
    """Display number (1 or more) when --screen (or --display / --audio-device) is given, else None."""
    if not any(k in opts for k in ('screen', 'display', 'audio-device')):
        return None
    try:
        n = int(opts.get('display', 1))
    except ValueError:
        n = 0
    if n < 1:
        sys.exit('--display takes a display number from 1 (1 = main display)')
    return n


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'probe'
    if cmd == 'probe':
        probe(screen_display(split_args(cmd, sys.argv[2:])[1]))
    elif cmd == 'assemble':
        args, opts = split_args(cmd, sys.argv[2:])
        if len(args) != 2:
            sys.exit('usage: capture_play.py assemble <frames dir> <out.mp4> [--smooth]')
        assemble(args[0], args[1], smooth='smooth' in opts)
    elif cmd == 'take':
        sys.path.insert(0, HERE)
        import takes
        args, opts = split_args(cmd, sys.argv[2:])
        names = args or list(takes.TAKES)
        unknown = [n for n in names if n not in takes.TAKES]
        if unknown:
            sys.exit('unknown take(s) %s; takes.py defines: %s' % (', '.join(unknown), ', '.join(takes.TAKES)))
        display = screen_display(opts)
        if display is not None:
            screen_check(display, opts.get('audio-device'))
        ex = Explorer(); rec = Recorder(ex, screen=display, audio_device=opts.get('audio-device'))
        if hasattr(takes, 'begin') and 'no-begin' not in opts:
            print('== begin'); takes.begin(ex)
        for name in names:
            print('== take', name); t0 = time.time()
            try:
                takes.TAKES[name](ex, rec)
            except Exception as e:
                print('FAILED', name, ':', str(e)[:300])
            print('   %.0f s' % (time.time() - t0))
    else:
        print('unknown command %r\n' % cmd); print(__doc__); sys.exit(1)

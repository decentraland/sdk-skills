# Example takes for capture_play.py, from The Horseman's Night (a fixed-camera action game). Copy to
# promote/tools/takes.py and rewrite for the scene: read its source for the trigger rectangles, NPC spots,
# input actions and debug keys; the numbers below are that scene's. Edit this file OUTSIDE the scene folder
# while the Explorer is up (any write under the scene restarts the scene and locks the player mid-take).
# Record the takes that use the scene's own camera before any free-camera shot (ex.camera_pose), and end
# every free-camera take with ex.back_to_player(): set_camera_mode alone once left the camera on the free
# pose and the next take was recorded from it.
#
# What each pattern is for:
#   begin()            every scene restart: title card away (a root click), cheat on, debug overlay off
#   village_walk()     the trailer's "a person in motion from the first frame": teleport, record, walk
#   talk()             an NPC conversation: E (primary) within its radius, then one click per line
#   woods_apparition() a scripted event: walk into its trigger rectangle, then wait it out on camera
#   graveyard_omen()   a parry on a telegraphed projectile: keep swinging while it arrives
#   fight()            a room of enemies that come to the player: rotate the facing, slash; a long take to cut from
#   seal_skip()        the scene's own debug key when the honest path is not scriptable (same cutscene)
import time

FLOOR = 8
AIM = dict(x=0, y=0, z=0)   # an aim point with nothing clickable at it: the press reaches the scene root
# The scene's camera looks north-east (yaw 45), and `walk` is camera-relative: forward (dy=1) is north-east.
DIRS = {'north': (-1, 1), 'east': (1, 1), 'south': (1, -1), 'west': (-1, -1)}


def go(ex, heading, seconds, kind='jog'):
    dx, dy = DIRS[heading]
    return ex.walk(seconds, dx=dx, dy=dy, kind=kind)


def slash(ex): return ex.press('pointer', **AIM)     # left click = slash in this scene
def dash(ex): return ex.press('jump', **AIM)         # space = dash
def key(ex, action): return ex.press(action, **AIM)  # action_3..6 = keys 1..4


def face(ex, x, z, tx, tz):
    """Put the player at (x, z) facing (tx, tz): move_to's lookAt turns the avatar even under a scene camera."""
    return ex.move_to(x, FLOOR, z, look=(tx, FLOOR + 1, tz))


def begin(ex):
    ex.wait_ready(); time.sleep(2)
    ex.press('pointer', **AIM); time.sleep(5.5)   # "Click to begin": the card fades, the camera glides down
    key(ex, 'action_5'); time.sleep(0.3)           # cheat: one-hit kills, no damage (needs the overlay on)
    key(ex, 'action_3'); time.sleep(0.3)           # debug overlay off: its shapes would show in the footage


def village_walk(ex, rec):
    face(ex, 76, 42, 72, 32); time.sleep(1.5)
    with rec.take('village-walk'):
        time.sleep(0.3)
        ex.walk(4.5, dx=0.42, dy=-1, kind='walk')   # toward the well
        time.sleep(0.4)


def talk(ex, x, z, gx, gz, lines):
    face(ex, x, z, gx, gz); time.sleep(1.2)
    key(ex, 'primary'); time.sleep(1.8)            # E within the NPC's radius
    for _ in range(lines * 2):                     # a click finishes the line, the next shows the next one
        ex.press('pointer', **AIM); time.sleep(1.3)
    time.sleep(2)


def gravekeeper_intro(ex, rec):
    face(ex, 67, 46.5, 62.5, 48.5); time.sleep(1.5)
    with rec.take('gravekeeper-intro'):
        time.sleep(0.3); ex.walk(0.7, dx=-1, dy=-0.38); time.sleep(0.6)
        key(ex, 'primary'); time.sleep(1.8)
        for _ in range(8):
            ex.press('pointer', **AIM); time.sleep(1.4)
        time.sleep(7)                              # the cutscene his last line starts


def woods_apparition(ex, rec):
    face(ex, 59, 50, 59, 70); time.sleep(1.5)
    with rec.take('woods-apparition'):
        time.sleep(0.3)
        go(ex, 'north', 2.4)                       # across the bridge into the trigger (z 60.5..64.5)
        time.sleep(15)                             # the cinematic plays out and the camera returns


def graveyard_omen(ex, rec):
    face(ex, 94, 25, 110, 25); time.sleep(1.2)
    with rec.take('graveyard-omen-parry'):
        time.sleep(0.3); go(ex, 'east', 1.6); time.sleep(3.5)
        t0 = time.time()
        while time.time() - t0 < 11:               # any bolt within 2 m of a swing is sent back
            slash(ex); time.sleep(0.35)
        time.sleep(4)


def fight(ex, seconds):
    t0 = time.time(); i = 0; headings = list(DIRS)
    while time.time() - t0 < seconds:
        go(ex, headings[i % 4], 0.12, kind='walk'); i += 1   # a nudge re-aims the slash
        slash(ex); time.sleep(0.55); slash(ex); time.sleep(0.5)


def woods_fight(ex, rec):
    face(ex, 59, 61.5, 59, 80); time.sleep(1.0)
    with rec.take('woods-fight'):
        time.sleep(0.3); go(ex, 'north', 1.3); time.sleep(1.5)
        fight(ex, 110)


def seal_skip(ex, rec):
    key(ex, 'action_3'); time.sleep(0.3)           # overlay on: key 4 only works with it
    with rec.take('seal-break'):
        time.sleep(0.5); key(ex, 'action_6'); time.sleep(12)
    key(ex, 'action_3'); time.sleep(0.3)


TAKES = {
    'village-walk': village_walk,
    'gravekeeper-intro': gravekeeper_intro,
    'woods-apparition': woods_apparition,
    'woods-fight': woods_fight,
    'seal-break': seal_skip,
    'graveyard-omen-parry': graveyard_omen,
}

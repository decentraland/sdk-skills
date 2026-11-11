# Ambience and cue design at runtime

How to wire beds, stingers and creature cues so a scene sounds alive without fatiguing the player. Builds on SKILL.md: distance gating for room-local beds (*Spatial falloff*), `playSound` retriggering, pitch variation, one clip per `AudioSource`, and volume easing in place of a fade API. From a horror scene whose creator approved the result (2026-11); the numbers are that scene's tuning, a starting point for yours.

## Structure

- **Decouple game and audio.** Game systems write a small shared state each frame (threat distance, threat awake, scripted scene running, player indoors, seconds since the creature's last cue); one audio system reads it and owns every bed, lull and stinger. The audio module imports nothing from the game.
- **Throttle writes**: change `volume`/`playing` only when the value moves by more than ~0.01 (LWW dedup makes identical writes pointless).

## Sparse opening

Start with one or two layers and bring the rest in over the first minute. All layers at once at spawn read as "too much at once" (owner note). One timeline that worked: wind at ~half level and one distant cue for the first 25 s; the night/insect bed fades in from 25 s to 60 s; no stingers before ~110 s, no lulls before ~120 s. Restart the timeline on death or reset.

## Silence as a tool

- Pick one bed as the **living** bed (insects, night chorus). It ducks; the wind under it stays (at about half).
- Duck it when the threat is near, during scripted scenes, and in occasional **random lulls** (14–26 s, every 1–2 min). Quiet points the player cannot explain are the scariest.
- Ease asymmetrically: out within ~2 s, back over ~10 s.

```typescript
const want = threatNear || scripted || lull > 0 ? 1 : 0
hush += (want - hush) * Math.min(1, dt * (want > hush ? 1.2 : 0.12)) // fast out, slow back
const bedVolume = BED * opening * (1 - hush)
```

## Stingers

- **Place them inside the silences**: after ~4 s of full hush, a small chance per second (~7 %). With the bed alive, a far one every 60–120 s at most.
- **Gate every stinger**: a cooldown (~16 s between stingers), none during scripted scenes, none within ~4 s of the creature's own cue, none indoors or in the opening.
- **Far** ones (distance baked into the file: `sound-design.md` → *Recipes*) play 16–22 m from the player at a random bearing, clamped inside the scene bounds. **Close** ones play ~5 m behind the camera and a little to one side, so the player has to turn round.
- Play them from a small round-robin pool of emitter entities; vary pitch; avoid the same file twice running.

## Emitters: where a sound lives

- **A loop parented to the camera or player is heard everywhere, at constant level.** Glass ticks inside a moth-flutter loop on the flashlight read as "a drip heard everywhere". Keep camera-attached loops free of place-specific elements; put drips, room tone and machinery on fixed emitters with distance gating (SKILL.md → *Spatial falloff*).
- **Biome zones** (frogs at a pond, a stream, a generator yard): a group of fixed emitters gated by distance from the zone centre (e.g. full within 12 m, silent by 45 m), and the global living bed ducked while inside (−60 % at the pond). Start emitters that share a clip at different `currentTime` offsets so they never line up.
- **Continuous tonal loops at the listener's head fatigue.** A high-pitched electrical whine loop on the camera, and an electrical sound on every light flicker, were both rejected. Keep tonal loops on fixed emitters in their place, at low level, and keep repeated one-shots sparse.

## One-shots synced to animation

Footsteps, wingbeats and impacts land on the animation's frames when the scene fires them from a per-clip table of event times (read them from the clip in Blender or the GLB):

```typescript
const EVENTS: Record<string, number[]> = { fly: [0.155, 0.688, 1.221], land: [0.26, 0.62] } // s within the clip
let clipTime = 0 // reset to 0 wherever the clip is started
function tickEvents(clip: string, duration: number, loop: boolean, dt: number) {
  const before = clipTime, after = clipTime + dt
  clipTime = after
  const beats = EVENTS[clip]
  if (beats === undefined || (!loop && before >= duration)) return
  const base = Math.floor(before / duration) * duration
  for (const b of beats) {
    const at = base + b
    if ((at > before && at <= after) || (loop && at + duration > before && at + duration <= after)) {
      AudioSource.getMutable(flapEmitter).pitch = 0.93 + Math.random() * 0.12
      AudioSource.playSound(flapEmitter, 'assets/audio/flap.ogg')
      return
    }
  }
}
```

Keep the table in step with the GLB when clips change, and gate on the character being visible.

## Creature voice pool

```typescript
let lastVoice = ''
function say(pool: string[], volume = 1) {
  let name = pool[Math.floor(Math.random() * pool.length)]
  if (name === lastVoice) name = pool.find((n) => n !== name) ?? name // no immediate repeat
  lastVoice = name
  const a = AudioSource.getMutable(voiceEmitter) // its own entity, parented to the creature
  a.volume = volume
  a.pitch = 0.94 + Math.random() * 0.1
  AudioSource.playSound(voiceEmitter, `assets/audio/${name}.ogg`)
  shared.sinceCue = 0 // ambient stingers keep clear of it
}
```

- The voice gets **its own emitter**, so it never cuts the creature's other loops (hum, wings) or a stinger.
- Pools by situation: attention cues (far, out of view), close-and-in-sight cues every 5–10 s, one cue per action (landing, take-off, lunge wind-up).

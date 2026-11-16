# Sound recipes from real recordings

Layer recipes a creator approved for a horror scene, several called "excellent" (2026-11). Every layer is a real field recording (sources: `free-audio-sources.md`). Rates are **varispeed**: pitch and speed change together (`ffmpeg` `asetrate`, or a REAPER item `PLAYRATE` with preserve-pitch off; `sound-design.md` → *Processing*).

| Sound | Made from |
|---|---|
| Creature scream | red fox screams at 0.7–0.8×, around an elk bugle's rising squeal, light saturation |
| Creature call | raven croaks at ~0.6× |
| Deep rolling croak | sandhill crane bugle at 0.5×, over a grizzly roar at 0.8× |
| Close threat | grizzly jaw pops at 0.7×, a breath after |
| Roar / chest rumble | grizzly roar at 0.85× |
| Moans | elk chorus at 0.25× |
| Drone | steam vent at 0.35×, long vast reverb |
| Breath | fumarole steam burst at 0.6×, shaped fades |
| Electrical hum | 50 Hz mains-hum recording at 1.2× = 60 Hz |
| Wingbeat | short shaped bursts of real wind at 0.55× over a slowed thud |
| Far one-shot (scream, knock, creak) | distance baked in: band-limited (no highs, e.g. HP 350 Hz / LP 3.5 kHz) and heavy reverb |
| Tree groan | a door-hinge creak at 0.5× |
| Drip | single glass ticks at 1.5–2.0×, irregular spacing, bright concrete reverb |

The animals and vents above are all in the NPS Yellowstone sound library; the foley (thud, hinge creak, glass ticks, mains hum) came from Wikimedia Commons.

## Notes

- **Steep high-pass on every field recording** (two cascaded filters) to remove wind and traffic rumble.
- **One reverb bus per space**, fed by sends from each layer: open night (long, dark, pre-delay), wooden room (short), vast (for a voice), concrete bunker (bright, ringing). REAPER settings that worked: `reaper-rpp.md` → *Stock FX state*.
- **Slow animals to make monsters.** Each halving of the speed drops the pitch an octave and doubles the length; the deepest settings above (0.25×–0.35×) became drones and moans rather than calls.
- **Hear it, don't narrate it.** Where a caption says something is happening (a dog howling, something moving in the trees), the creator wanted the sound instead of the text.

# Emote props and bone particles

A scene emote (`triggerSceneEmote`) can carry an animated prop, a racket, a flame jet, smoke, alongside the avatar clip. Other players see the prop together with the avatar animation, so it is also the only way for a **smart wearable** to show a visual effect to everyone (its scene entities and `ParticleSystem`s are visible only to the wearer; see **smart-wearables**). Author the avatar half (rig, posing, keys, area checks, 30 fps, loops) per `{baseDir}/SKILL.md` first; this file only covers what changes once a prop is added.

## Layout (Emotes 2.0, works with `triggerSceneEmote`)

One `*_emote.glb` containing:

| Object | Clip name must contain | Notes |
| --- | --- | --- |
| `Armature` (avatar rig, unchanged) | `_Avatar` e.g. `Jetpack_Avatar` | exactly as authored per `SKILL.md` |
| `Armature_Prop` | `_Prop` e.g. `Jetpack_Prop` | ≤ 62 bones, deform bones only |
| Prop mesh(es) | — | skinned to `Armature_Prop`, ≤ 3k tris total, ≤ 2 materials, ≤ 2 textures |

- Both clips **exactly the same length**, ≤ 300 frames, 30 fps.
- Only bone animation. Object (transform) animation isn't allowed and Blender particle systems don't export.
- Everything stays inside the 4 × 4 × 4 m animation area (props included).
- The Explorer parents the emote prefab to the **avatar root**, not to a body bone. A prop that should ride on the body must follow it explicitly (see below).
- File size: a 1 s loop with 26 prop bones and ~1.3k prop tris exported at ~150 KB.

Source: [Props and sounds](https://docs.decentraland.org/creator/wearables-and-emotes/emotes/props-and-sounds/), Explorer emote loader (`main`, 2026-10).

## Particles = meshes driven by bones

Each "particle" is a small mesh (ico-sphere puff, cone flame, spark) skinned **100% to its own prop bone**. Animate bone location and scale: grow, drift, shrink to 0 to hide, then reappear at the emitter for a loop. A deterministic pseudo-random per bone (`sin(n * 12.9898 + k * 78.233) * 43758.5453 % 1`) gives varied but loop-safe motion. Stagger each bone's phase (`t = (frame_phase + k / N) % 1`) so the effect looks continuous. Make the last frame equal the first.

The official route from a Blender particle system is the [particles-to-bones add-on](https://docs.decentraland.org/creator/wearables-and-emotes/emotes/particles-in-emotes/), then merging the generated armature into `Armature_Prop` (a file may only have two armatures and two clips). Generating bones and keys directly from a script, as below, skips that merge.

Materials: an emissive material with a small gradient texture (e.g. 64 × 4 px, sampled by U along the flame) for fire; a plain rough grey material for smoke. Two materials total.

## Making a prop follow the body

Because the prefab sits at the avatar root, a prop bone keyed in world space stays put while the torso bends. Two options:

- **Child Of constraint** on the prop bone targeting an avatar bone (the docs' method for a racket in a hand), then bake.
- **Bake per frame from the avatar bone** (what the jetpack did for nozzles on the back): for every frame, `scene.frame_set(f)` to evaluate the avatar clip, compute the emitter's world position as `pose_matrix(Avatar_Spine2) @ rest_matrix(Avatar_Spine2).inverted() @ emitter_rest_position`, place the prop bone there, key it. The emitter rest position comes from the wearable GLB (e.g. nozzle tips measured when building the wearable and written to a JSON file the emote script reads).

With either method, emitters on a wearable line up only if the wearable and the emote use the same rest pose for that bone. Build both from the official files.

## Export: NLA tracks, not active actions

`SKILL.md` exports armature-only with `ACTIVE_ACTIONS`, which keeps one clip. With a prop you need two clips in one file:

```python
for obj, act in ((avatar_arm, act_avatar), (prop_arm, act_prop)):
    ad = obj.animation_data
    track = ad.nla_tracks.new(); track.name = act.name
    strip = track.strips.new(act.name, FIRST_FRAME, act)
    strip.action_slot = act.slots[0]          # Blender 4.4+/5 slotted actions
    ad.action = None                           # nothing left active
# also remove the rig's 'Starting_Pose' action and every object except Armature, Armature_Prop, prop meshes
bpy.ops.export_scene.gltf(
    filepath=path, export_format='GLB', use_selection=True,
    export_def_bones=True, export_force_sampling=True, export_frame_step=1,
    export_animation_mode='NLA_TRACKS', export_animations=True, export_anim_slide_to_zero=True,
    export_skins=True, export_materials='EXPORT',
    export_cameras=False, export_lights=False, export_yup=True, export_apply=False,
)
```

Verify the GLB: exactly **2 animations** named `*_Avatar` and `*_Prop` with equal duration, ≤ 2 materials, prop meshes skinned.

## Blender gotchas

- `bmesh.ops.create_icosphere` with `subdivisions > 1` reallocates vertices, so `BMVert` references you held become stale and point at the wrong vertices. Build each puff, then tag its vertices through an int vertex layer (`bm.verts.layers.int.new('bone')`), and build vertex groups from the layer after `index_update()`.
- Prop bones that should point "along the flame" need their rest orientation set so the bone's Y axis is that direction. Then scale on local Y stretches the flame and scale on X/Z sets its width.

## Playing it

For an effect tied to an ability the player uses while moving (a jetpack), play it masked (`AvatarMask.AM_UPPER_BODY`) so it survives jumps and falls (props still play, and the mask is replicated to other players), looping while the ability is active, `stopEmote({})` to end. Keep it on for a minimum time (~0.4 s) so a quick tap is still visible to onlookers.

Scene emotes play **no sound**. A Builder emote ships its sound as a separate `.mp3`/`.ogg` file next to the GLB, and the Explorer finds it by scanning the emote entity's `content` list (`LoadEmotesByPointersSystem.TryCreateAudioClipPromises`). `triggerSceneEmote` loads only the main GLB and never creates an audio request (`LoadSceneEmotesSystem`). Audio embedded in the GLB itself (`KHR_audio_emitter`) is ignored too. Pair a scene emote with an `AudioSource` (see **audio-video**); for a smart wearable only the wearer hears it.

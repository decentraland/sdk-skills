# Worked example: jetpack smart wearable

An `upper_body` suit with a twin-rocket pack. Hold **F** to fly; fuel drains while thrusting and the thrusters lock when it runs dry until it refills to 25%. Built, packed (~1.4 MB uncompressed) and uploaded to the Builder.

```
wearable.json                         # upper_body, BaseMale + BaseFemale representations
scene.json                            # isPortableExperience: true
thumbnail.png                         # 256 px, transparent
models/male/jetpack_suit.glb          # ~270 KB each, ~1,260 tris, 2 materials, JPEG textures
models/female/jetpack_suit.glb
assets/emotes/jetpack_thrust_emote.glb   # Jetpack_Avatar + Jetpack_Prop, 1 s loop, flames/smoke/sparks as bone props
assets/sounds/jetpack_thrust.mp3      # 1 s loop, wearer-only
src/index.ts  src/jetpack.ts  src/ui.tsx
blender/                              # build scripts + .blend files, in .dclignore
```

`src/index.ts` calls `setupJetpack()` and `setupUi()` from `main()`. The UI is a React-ECS bar bound to `jetpack.fuel / FUEL_SECONDS`, red while `jetpack.overheated` (see **build-ui**).

## `src/jetpack.ts`

```typescript
import {
  AssetLoad, assetLoadLoadingStateSystem, AudioSource, AvatarAnchorPointType, AvatarAttach, AvatarMask,
  engine, Entity, InputAction, inputSystem, LoadingState, Physics, Transform
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { stopEmote, triggerSceneEmote } from '~system/RestrictedActions'

// Character mass is 1, so an impulse magnitude is the velocity change in m/s.
export const FUEL_SECONDS = 3
const REFILL_SECONDS = 4
const REFILL_DELAY = 0.6        // pause after release before refilling
const OVERHEAT_UNLOCK = 0.25    // after running dry, locked until the tank is back at this fraction
const LAUNCH_IMPULSE = 6        // kick on each new press
const LAUNCH_FUEL_COST = 0.3    // so tapping F isn't free
const SUSTAIN_IMPULSE = 0.8     // every SUSTAIN_INTERVAL while held: settles into a ~4-5 m/s climb
const SUSTAIN_INTERVAL = 0.1
const MIN_BURN_SECONDS = 0.4    // keep the emote up so a quick tap still reads to onlookers

const EMOTE_SRC = 'assets/emotes/jetpack_thrust_emote.glb'
const SOUND_SRC = 'assets/sounds/jetpack_thrust.mp3' // scene emotes can't carry sound: wearer-only AudioSource

export const jetpack = { fuel: FUEL_SECONDS, overheated: false, thrusting: false }

let burning = false, burnTime = 0, sustainTimer = 0, sinceRelease = REFILL_DELAY
let soundEntity: Entity

function startBurn() {
  burning = true
  burnTime = 0
  triggerSceneEmote({ src: EMOTE_SRC, loop: true, mask: AvatarMask.AM_UPPER_BODY }).catch(console.error)
  AudioSource.getMutable(soundEntity).playing = true
}

function stopBurn() {
  burning = false
  stopEmote({}).catch(console.error)
  AudioSource.getMutable(soundEntity).playing = false
}

function jetpackSystem(dt: number) {
  const held = inputSystem.isPressed(InputAction.IA_SECONDARY) // F
  if (held && !jetpack.overheated && jetpack.fuel > 0) {
    if (!jetpack.thrusting) {
      jetpack.thrusting = true
      jetpack.fuel = Math.max(0, jetpack.fuel - LAUNCH_FUEL_COST)
      sustainTimer = 0
      Physics.applyImpulseToPlayer(Vector3.Up(), LAUNCH_IMPULSE)
      if (!burning) startBurn()
    }
    jetpack.fuel = Math.max(0, jetpack.fuel - dt)
    sustainTimer += dt
    while (sustainTimer >= SUSTAIN_INTERVAL) {
      sustainTimer -= SUSTAIN_INTERVAL
      Physics.applyImpulseToPlayer(Vector3.Up(), SUSTAIN_IMPULSE)
    }
    sinceRelease = 0
    if (jetpack.fuel <= 0) { jetpack.overheated = true; jetpack.thrusting = false }
  } else {
    jetpack.thrusting = false
    sinceRelease += dt
    if (sinceRelease >= REFILL_DELAY) {
      jetpack.fuel = Math.min(FUEL_SECONDS, jetpack.fuel + (dt * FUEL_SECONDS) / REFILL_SECONDS)
    }
    if (jetpack.overheated && jetpack.fuel >= FUEL_SECONDS * OVERHEAT_UNLOCK) jetpack.overheated = false
  }
  if (burning) {
    burnTime += dt
    if (!jetpack.thrusting && burnTime >= MIN_BURN_SECONDS) stopBurn()
  }
}

export function setupJetpack() {
  const preloader = engine.addEntity()
  AssetLoad.create(preloader, { assets: [EMOTE_SRC, SOUND_SRC] })
  assetLoadLoadingStateSystem.registerAssetLoadLoadingStateEntity(preloader, ({ asset, currentState }) => {
    if (currentState === LoadingState.FINISHED_WITH_ERROR || currentState === LoadingState.NOT_FOUND) {
      console.error('failed to preload', asset, currentState)
    }
  })

  soundEntity = engine.addEntity()
  Transform.create(soundEntity)
  AvatarAttach.create(soundEntity, { anchorPointId: AvatarAnchorPointType.AAPT_POSITION })
  AudioSource.create(soundEntity, { audioClipUrl: SOUND_SRC, loop: true, playing: false, volume: 0.8 })

  engine.addSystem(jetpackSystem)
}
```

## Design notes

- **Emote pose:** arms out and slightly back, fists closed, a slight **forward** lean. An arched-back "superhero" pose read as falling backwards and the owner rejected it. Small rumble keys (every 5 frames) sell the thrust. Masked, so the legs keep the jump/fall animation.
- **Emitters:** nozzle positions measured on the wearable build and passed to the emote build as JSON, then carried through `Avatar_Spine2` per frame (**avatar-animations** → `references/emote-props.md`). The pack's front face sits at y = 0.129 m on both builds (3.8–3.9 mm clear of either suit), so the male build's nozzle JSON is valid for the female one too.
- **Fists:** fingers curl on local **Z**, not X (**avatar-animations** → "Elbows and knees hinge on local X — fingers curl on local Z"). The first build curled on X and the fingers folded sideways.
- **Tell the user** that host scenes can disable the wearable (`featureToggles.portableExperiences`), and that only the wearer hears the thrust.

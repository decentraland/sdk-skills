---
name: script-components
description: "Writing .ts script files for the Creator Hub Script component — self-contained classes attached to individual entities. Use when the user wants to create a custom smart item, a reusable scripted entity, or write code that runs on a Creator Hub Script component. Do NOT use for regular scene index.ts code or global systems (see scene-runtime, add-interactivity)."
---

# Writing Script Components for Creator Hub

This document explains how to write `.tsx` files that are used inside a **Script component** on an entity in a Creator Hub scene. These scripts run as self-contained classes attached to individual entities.

## Where script files must live

Script files referenced by a Script component MUST live **inside the `assets/` folder** — use `assets/scripts/` (e.g. `assets/scripts/MyScript.ts`). Do NOT place them in a root-level `scripts/` folder.

Why: the scene's `tsconfig.json` only includes `src/**/*` and `assets/**/*`:

```json
"include": ["src/**/*.ts", "src/**/*.tsx", "assets/**/*.ts", "assets/**/*.tsx"]
```

A file in a root-level `scripts/` folder falls outside these globs, so the TypeScript type checker (and the build's type-check step) won't cover it. The Script component's `path` field is resolved relative to the project root, so it must match the real file location — e.g. `"path": "assets/scripts/SitChair.ts"`.

## Script structure

Every script is a single exported class with:

- A **constructor** that receives configurable parameters (exposed in the Creator Hub UI).
- An optional **`start()`** method, called once when the scene loads.
- An optional **`update(dt: number)`** method, called every frame (see "When scripts run" below for ordering — by default scripts update *after* all regular systems).

The first two constructor parameters must always be `public src: string` and `public entity: Entity` — do not remove or reorder them.

```ts
import { engine, Entity, Transform } from '@dcl/sdk/ecs'

export class MyScript {
  constructor(
    public src: string,
    public entity: Entity,
    public speed: number = 1
  ) {}

  start() {
    console.log('Script started on entity:', this.entity)
  }

  update(dt: number) {
    const transform = Transform.getMutable(this.entity)
    transform.rotation.y += this.speed * dt
  }
}
```

## When scripts run — the `priority` field (IMPORTANT)

The Creator Hub Script component has a `priority` field (separate from constructor params — it's set in the component UI, not in your class). It **defaults to `0`**, and this has non-obvious consequences:

- **Default priority `0` = scripts run LAST each frame.** At build time `@dcl/sdk-commands` groups all scripts by their `priority` value and registers ONE engine system per group via `engine.addSystem(updateLoop, Number(priority))`. Because engine systems run **highest-priority-first** (regular systems use `100000`, UI uses `100000`), priority `0` runs after everything else.
- **All scripts sharing the same `priority` share ONE system callback** and run **sequentially** inside it. A single heavy script's `update()` therefore delays every other script in the same priority group that frame.
- **To run a script's `update()` before regular systems**, raise its `priority` (e.g. `1000000`) in the Script component. This also gives it its own dedicated system. This is how you'd step a physics library (cannon.js) inside `update(dt)` ahead of systems that read the result — there is no separate physics loop.

> Higher `priority` number = earlier execution — the OPPOSITE of the "priority 1 = first" assumption. See the `scene-runtime` skill's "System Execution Order & Priority" section for the underlying engine rule.

## Constructor parameters

Parameters declared in the constructor are exposed in the Creator Hub UI and can be configured per-entity. Allowed types:

- `string`
- `number`
- `boolean`
- `Entity` (lets the user pick another entity from the scene)

Both `public` and `private` parameters are exposed to Creator Hub. Use `this.<paramName>` to access values in your code.

### Default values

Provide default values so the script works out of the box:

```ts
constructor(
  public src: string,
  public entity: Entity,
  public radius: number = 5,
  public label: string = 'Hello',
  public enabled: boolean = true,
) {}
```

### Optional parameters

Use `?` for parameters that may be left empty by the user:

```ts
constructor(
  public src: string,
  public entity: Entity,
  public targetEntity?: Entity,
  public message?: string,
) {}
```

### Parameter tooltips

Add `@param` annotations in a JSDoc comment block directly before the constructor to show tooltips in the Creator Hub UI:

```ts
/**
 * @param startDate - The start date of the campaign in YYYY-MM-DD format
 * @param endDate - The end date of the campaign in YYYY-MM-DD format
 * @param wearableYOffset - How many meters above the ground the wearable should be displayed
 */
constructor(
  public src: string,
  public entity: Entity,
  public startDate?: string,
  public endDate?: string,
  public wearableYOffset: number = 0.5,
) {}
```

## Referencing assets with `this.src`

If your script uses additional assets that are only loaded via code (sound files, textures, models, etc.), they won't be automatically included in the custom item folder. You must add those files manually.

Always use `this.src` to build the path to bundled asset files, because the actual file location may differ when the item is used in another scene:

```ts
import { AudioSource } from '@dcl/sdk/ecs'

start() {
  AudioSource.create(this.entity, {
    audioClipUrl: this.src + '/sounds/click.mp3',
    playing: false
  })
}
```

## Referencing child entities

Do **not** pass entities that belong to the same custom item as `Entity` input parameters. Entity IDs are not stable across scenes — an entity ID that is valid in your development scene may not exist in a user's scene.

Instead, find child entities at runtime by iterating over the entity hierarchy and matching their `Name` component value with a **substring** match (e.g. `.startsWith(...)` or `.includes(...)`).

**Best practice: match a substring of the child's name, not an exact name, and not a per-instance constructor parameter.** When a user duplicates a smart item or drops multiple copies into a scene, the Creator Hub editor auto-numbers the duplicated child entities — e.g. `"Sit Spot"`, `"Sit Spot 2"`, `"Sit Spot 3"`, … A substring match (`name.includes('Sit Spot')`) finds the matching child in every copy automatically, with zero per-instance configuration.

- **Exact-name match** fails on every duplicate after the first, because their names are auto-suffixed.
- **A constructor `string`/`Entity` parameter for the child name** forces the user to manually rename or rewire each copy, which defeats the purpose of a reusable scripted item.

The example below uses `.startsWith('Needle')` — a substring-style match — for exactly this reason.

```ts
import { engine, Entity, Transform, Name } from '@dcl/sdk/ecs'

export class ClapMeter {
  private needleEntities: Entity[] = []

  constructor(
    public src: string,
    public entity: Entity,
  ) {}

  start() {
    for (const [childEntity, transform] of engine.getEntitiesWith(Transform)) {
      if (transform.parent === this.entity) {
        const nameComponent = Name.getOrNull(childEntity)
        if (nameComponent && nameComponent.value.startsWith('Needle')) {
          this.needleEntities.push(childEntity)
        }
      }
    }
  }
}
```

This pattern keeps the script portable: as long as the child entities have names containing the expected substring, it works in any scene and across any number of duplicated copies.

## Defining actions (`@action`)

If your script has functions that could be useful to call from other items in the scene, mark them by adding a JSDoc comment block (`/** ... */`) with an `@action` tag directly before the method. Then add an **Action** component to the entity and define a corresponding action. This lets other smart items (e.g. a button) pick and trigger this action.

**CRITICAL: Use ONLY the `@action` JSDoc tag — NEVER decorator syntax (`@action()` above the method). The Creator Hub parser has no decorators plugin, so a decorator makes parsing fail and ALL params and actions silently disappear from the UI.**

An optional description line before the `@action` tag becomes the action's description shown in the Creator Hub UI.

```ts
import { engine, Entity } from '@dcl/sdk/ecs'

export class TreasureChest {
  private isOpen = false

  constructor(
    public src: string,
    public entity: Entity,
  ) {}

  /**
   * Opens the chest
   * @action
   */
  open() {
    if (this.isOpen) return
    this.isOpen = true
    console.log('Chest opened!')
  }

  /**
   * Closes the chest
   * @action
   */
  close() {
    if (!this.isOpen) return
    this.isOpen = false
    console.log('Chest closed!')
  }
}
```

With the `@action` JSDoc tag, `open` and `close` become available in the Actions component dropdown and can be triggered by other smart items or scripts.

## ActionCallback parameters

Use the `ActionCallback` type from `~sdk/script-utils` to let users wire up editor-configured actions as callbacks on your script. The user can then assign any action (from any item) to that callback in the Creator Hub UI.

```ts
import { Entity } from '@dcl/sdk/ecs'
import type { ActionCallback } from '~sdk/script-utils'

export class Padlock {
  constructor(
    public src: string,
    public entity: Entity,
    public onUnlock: ActionCallback,
  ) {}

  /**
   * @action
   */
  solve() {
    this.onUnlock()
  }
}
```

## Calling other scripts from code

Use the runtime utilities in `~sdk/script-utils` to call methods on other Script component instances:

```ts
import {
  callScriptMethod,
  getScriptInstance,
  getAllScriptInstances,
  getScriptInstancesByPath
} from '~sdk/script-utils'

callScriptMethod(entity, 'assets/scripts/Padlock.ts', 'solve', 123)

const instance = getScriptInstance(entity, 'assets/scripts/Padlock.ts')
const allOnEntity = getAllScriptInstances(entity)
const allByPath = getScriptInstancesByPath('assets/scripts/Padlock.ts')
```

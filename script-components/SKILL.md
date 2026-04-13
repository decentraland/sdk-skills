---
name: script-components
description: Writing .ts script files for the Creator Hub Script component — self-contained classes attached to individual entities. Covers constructor parameters exposed in the Creator Hub UI (string/number/boolean/Entity, defaults, optional, @param JSDoc tooltips), the required `public src: string` and `public entity: Entity` parameters, start()/update(dt) lifecycle, @action() decorators to expose methods as triggerable actions, ActionCallback params for user-wired callbacks, referencing bundled assets via `this.src`, finding child entities by name at runtime (instead of passing them as Entity params), and calling other scripts via `~sdk/script-utils` (callScriptMethod, getScriptInstance). Use when the user wants to create a custom smart item, a reusable scripted entity, or write code that runs on a Creator Hub Script component. Do NOT use for regular scene index.ts code or global systems (see scene-runtime, add-interactivity).
---

# Writing Script Components for Creator Hub

This document explains how to write `.tsx` files that are used inside a **Script component** on an entity in a Creator Hub scene. These scripts run as self-contained classes attached to individual entities.

## Script structure

Every script is a single exported class with:

- A **constructor** that receives configurable parameters (exposed in the Creator Hub UI).
- An optional **`start()`** method, called once when the scene loads.
- An optional **`update(dt: number)`** method, called every frame.

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

Instead, find child entities at runtime by iterating over the entity hierarchy and matching by name:

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

This pattern keeps the script portable: as long as the child entities have the expected names, it works in any scene.

## Defining actions (`@action`)

If your script has functions that could be useful to call from other items in the scene, mark them with the `@action` decorator. Then add an **Action** component to the entity and define a corresponding action. This lets other smart items (e.g. a button) pick and trigger this action.

```ts
import { engine, Entity } from '@dcl/sdk/ecs'

export class TreasureChest {
  private isOpen = false

  constructor(
    public src: string,
    public entity: Entity,
  ) {}

  @action()
  open() {
    if (this.isOpen) return
    this.isOpen = true
    console.log('Chest opened!')
  }

  @action()
  close() {
    if (!this.isOpen) return
    this.isOpen = false
    console.log('Chest closed!')
  }
}
```

With the `@action` decorator, `open` and `close` become available in the Actions component dropdown and can be triggered by other smart items or scripts.

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

  @action()
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

callScriptMethod(entity, 'scripts/Padlock.ts', 'solve', 123)

const instance = getScriptInstance(entity, 'scripts/Padlock.ts')
const allOnEntity = getAllScriptInstances(entity)
const allByPath = getScriptInstancesByPath('scripts/Padlock.ts')
```

## Key rules summary

1. Never remove `public src: string` and `public entity: Entity` from the constructor.
2. Use `this.src + '/filename'` for any bundled asset paths.
3. Do not pass child entities of the same custom item as `Entity` constructor parameters — find them by name at runtime instead.
4. Use `@action()` on methods you want to expose as triggerable actions.
5. Use `ActionCallback` for parameters that should let users wire up editor actions.
6. Add `@param` JSDoc comments before the constructor for UI tooltips.
7. Manually include any code-only assets (sounds, textures) in the custom item folder.

# Scene tests (`@dcl/sdk/testing`)

Companion to **scene-runtime** → *Testing Framework*.

Scenes can ship unit tests using `@dcl/sdk/testing`. Tests are generators — yielding pauses until the next frame so you can observe engine state across ticks.

```typescript
import { test } from "@dcl/sdk/testing";
import {
  assertComponentValue,
  assertEquals,
} from "@dcl/sdk/testing/assert";
import { engine, Transform, MeshRenderer } from "@dcl/sdk/ecs";
import { Vector3, Quaternion } from "@dcl/sdk/math";

test("transform is applied after one frame", function* () {
  const entity = engine.addEntity();
  Transform.create(entity, { position: Vector3.One() });

  // Let the engine run for a frame before asserting
  yield;

  assertComponentValue(entity, Transform, {
    position: Vector3.One(),
    scale: Vector3.One(),
    rotation: Quaternion.Identity(),
    parent: 0 as any,
  });
});

test("five meshes are present", function* () {
  yield;
  assertEquals(1 + 1, 2, "basic math");
  // No count assertion exists — count via getEntitiesWith + Array.from
  assertEquals(
    Array.from(engine.getEntitiesWith(MeshRenderer)).length,
    5,
    "should have 5 meshes"
  );
});
```

**Available assertions** (`@dcl/sdk/testing/assert`) — exactly these four:

- `assertEquals(actual, expected, message?)` — deep-equals check
- `assert(condition, message?)` — truthiness check
- `assertComponentValue(entity, Component, expected)` — full component value comparison
- `deepCloseTo(actual, expected, options?)` — deep numeric comparison with tolerance (for floats)

There is NO count assertion — count entities with `assertEquals(Array.from(engine.getEntitiesWith(Comp)).length, n)`.

**Running tests**: there is no CLI test command (`npx @dcl/sdk-commands test` does not exist). Tests execute only when the hosting runtime exposes the `~system/Testing` module — CI test runners or test-enabled explorers. In a normal preview the test runner is a no-op that just logs, and it's guarded behind DEBUG in production builds. Tests run inside the same QuickJS runtime as the scene, so the same restrictions apply (no Node.js APIs, use SDK timers, etc.).

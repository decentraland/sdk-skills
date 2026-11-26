# Script params: nested shapes, colours, editor tags and file params

Read this when a script needs grouped or list configuration, colour pickers, a narrowed entity or action picker, a wallet or file-picker field, fields that lock behind a checkbox, or files of its own. The editor reads all of it from the constructor's type annotations and JSDoc (`packages/inspector/src/lib/sdk/script-params/parser.ts` in the Creator Hub); the runtime still receives plain values, so none of it needs a newer SDK than the script itself.

## Nested params: inline objects and lists

```ts
constructor(
  public src: string, // DO NOT REMOVE
  public entity: Entity, // DO NOT REMOVE
  public spawn: { x: number; y: number; z: number } = { x: 8, y: 0, z: 8 },
  public waypoints: Array<{ position: { x: number; y: number; z: number }; wait: number }> = [],
  public tags: string[] = [],
) {}
```

- **Inline object type literal** (`{ x: number; y: number }`) → a collapsible group, closed by default, one field per member. Members recurse (objects inside objects, lists inside objects); a `?` member is optional.
- **`T[]` or `Array<T>`** → rows with **Add** and a trash button per row; a new row is seeded from the element type's default.
- **Named interfaces and type aliases are not resolved** (the parser is Babel, not a type checker). `public spawn: Vec3` renders as a plain text field holding `''`. Write every nested shape inline, as `AdminTools.ts` does.
- **Defaults may be nested literals**, as above. Labels are the names split into words and capitalised (`kickCoordinates` → "Kick Coordinates", `snake_case` and `kebab-case` too).
- The constructor receives the plain object / array. An `ActionCallback` is resolved to a function only as a top-level param, not inside an object or list.

## Colour params

A param typed `Color3` or `Color4` (or one with no type whose default is a `Color3.*` / `Color4.*` call, such as `Color3.fromHexString('#508EB4')` or `Color4.Red()`) gets a colour picker: swatch plus hex code. The layout stores the plain `{ r, g, b }` (`a` too for a `Color4`), so the constructor receives a usable colour. The picker is RGB only: a `Color4` keeps the alpha it was declared with.

```ts
import { Color3 } from '@dcl/sdk/math'

constructor(
  public src: string, // DO NOT REMOVE
  public entity: Entity, // DO NOT REMOVE
  public glowColor: Color3 = Color3.fromHexString('#FFECAF'),
) {}
```

Sliders (`Slider<Min, Max, Step>`) show as many decimals as their step, so `Slider<0, 1, 0.0001>` keeps `0.0005`.

## JSDoc editor tags

Put the tag in a `/** … */` comment directly before the param or object member. On a list, the tag applies to each element (except `@enabledIf`).

| Tag | On | Effect |
| --- | --- | --- |
| `@components <name> …` | an `Entity` | The picker offers only entities carrying one of the named components (full ECS names, space- or comma-separated, e.g. `asset-packs::Actions`). |
| `@actionsOf <siblingKey>` | a `string` member of an object | A dropdown of the actions on the entity held by the sibling field `<siblingKey>`. Placeholders: *"Select an item first"* (no entity yet), *"Select an action"*, *"This item has no actions."*; a stale value shows *"\"<x>\" is not one of this item's actions."* |
| `@format wallet` | a `string` (or `string[]`) | An Ethereum address field. |
| `@format image` / `audio` / `video` / `model` | a `string` | The file field of the Material texture: a dropdown of the scene's files of that kind (`.png`/`.jpg`/`.jpeg`, `.mp3`/`.wav`/`.ogg`, `.mp4`, `.glb`/`.gltf`) with a **None** entry that stores `''`, a folder button to import one, and drag and drop from the file tree. A stored file missing from the scene, or of the wrong kind, shows a warning. |
| `@enabledIf <key>` / `@enabledIf !<key>` | any param | Greys out and locks the field unless the sibling param `<key>` is truthy (with `!`: while it is falsy). Works with a checkbox or any value, e.g. `@enabledIf !skyboxTexture` locks a field while a file is picked. A `<key>` with no matching sibling leaves the field enabled. The script still receives the locked field's value. On a list it locks the whole list. Put each checkbox before the fields it unlocks. |

```ts
public smartItems: Array<{
  /** @components asset-packs::Actions */
  entity: Entity;
  customName: string;
  /** @actionsOf entity */
  defaultAction: string;
}> = [],
```

Other JSDoc tags on scripts (`@param` tooltips, `@action`, `@event`): SKILL.md.

## File params

A script reads its own files as `` `${this.src}/${param}` ``, so a string param that names a file is a path **relative to the script's folder** (`'open.mp3'`, `'sounds/hit.mp3'`, not `'assets/…'` and never `'../…'`: the explorer's content lookup does not resolve `..`).

The inspector treats a string param as a file when it has no `:`, is already a clean path (forward slashes only, no `./` or empty segments, no leading `/`) and ends in a known asset extension, case-insensitively. URLs and plain text are never treated as files. For those values:

- **Missing file:** the field shows `"<value>" is missing` when the resolved file is not in the scene (matched ignoring case, like the explorer).
- **Rename or move inside the script's folder** (Local Assets) rewrites the param to the new relative path; deleting the file shows the usual "used by" warning.
- **Move out of the script's folder:** the param is left as it was and the move reports that some scene references could not be updated. Move the file back or fix the param.

The same rules cover file names inside object and list params.

**`@format image|audio|video|model` params hold a different path**: the field stores the path the scene's file list uses, from the scene root (`assets/images/sky.jpg`), the same value a Material texture holds. Pass it to components as is, never prefixed with `this.src`. **Clean Assets** reads Script param values, so a file picked in any param counts as used.

## How these appear in `layout`

Hand-written layouts (rarely needed; prefer `attach_script`): an object param is `{"type":"object","value":{…plain values…},"fields":{…per-member param…}}`, a list is `{"type":"array","value":[…],"item":{…element param…}}`; a colour is `{"type":"color","value":{"r":1,"g":0.5,"b":0}}`; tags add `components: string[]`, `actionsOf: string`, `format: "wallet"|"image"|"audio"|"video"|"model"` or `enabledIf: "key"|"!key"` to the member param. Only `value` reaches the constructor. Full shape: [`script-layout.md`](script-layout.md).

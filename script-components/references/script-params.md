# Script params: nested shapes, editor tags and file params

Read this when a script needs grouped or list configuration, a narrowed entity or action picker, a wallet field, or files of its own. The editor reads all of it from the constructor's type annotations and JSDoc (`ScriptInspector/parser.ts` in the creator-hub inspector); the runtime still receives plain values, so none of it needs a newer SDK than the script itself.

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

## JSDoc editor tags

Put the tag in a `/** … */` comment directly before the param or object member. On a list, the tag applies to each element.

| Tag | On | Effect |
| --- | --- | --- |
| `@components <name> …` | an `Entity` | The picker offers only entities carrying one of the named components (full ECS names, space- or comma-separated, e.g. `asset-packs::Actions`). |
| `@actionsOf <siblingKey>` | a `string` member of an object | A dropdown of the actions on the entity held by the sibling field `<siblingKey>`. Placeholders: *"Select an item first"* (no entity yet), *"Select an action"*, *"This item has no actions."*; a stale value shows *"\"<x>\" is not one of this item's actions."* |
| `@format wallet` | a `string` (or `string[]`) | An Ethereum address field. |

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

## How these appear in `layout`

Hand-written layouts (rarely needed; prefer `attach_script`): an object param is `{"type":"object","value":{…plain values…},"fields":{…per-member param…}}`, a list is `{"type":"array","value":[…],"item":{…element param…}}`; tags add `components: string[]`, `actionsOf: string` or `format: "wallet"` to the member param. Only `value` reaches the constructor. Full shape: [`script-layout.md`](script-layout.md).

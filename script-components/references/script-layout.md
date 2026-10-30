# The `asset-packs::Script` `layout` field

Read this only when setting `asset-packs::Script` by hand (MCP `set_component` or editing `main.composite`). When the scene is open in the Creator Hub, its MCP `attach_script` tool builds the component from the script path instead (**creator-hub-mcp**).

## Shape

The component value is `{ value: [{ path: string, priority: number, layout?: string }] }`. `layout` is a JSON string:

```json
{"params":{"paramName":{"type":"string|number|boolean|action","value":<value>}}}
```

`layout` also carries `actions` (from `@action` methods) and `events` (from `@event` tags), plus an `error` string when parsing failed. Only `params` feeds the constructor; the other keys drive editor features (the action dropdown, the Reactions section), so spread the existing layout and overwrite only the param you change.

## How params reach the constructor

At runtime `@dcl/sdk-commands` (`runtime-script.js`):

1. `JSON.parse(layout)` to get a `ScriptLayout` object.
2. `Object.values(layout.params)` extracts param values **in insertion order**.
3. The values are spread **positionally**: `new ScriptClass(src, entity, ...params)`.

**Params are positional, not named.** The key order in `params` must match the constructor parameter order after `src` and `entity`, and every param up to the last one you set must be present.

Params with `type: "action"` have `value: {entity: Entity, action: string}` and become `ActionCallback` functions via `createActionCallback`, which calls `getActionEvents(entity).emit(action, {})` when invoked.

## Example

Layout for a script with 14 constructor params after `src`/`entity`:

```json
{"params":{"colorA":{"type":"string","value":"#ff33e6"},"colorB":{"type":"string","value":"#33e6ff"},"rate":{"type":"number","value":35},"lifetime":{"type":"number","value":2.5},"sizeMin":{"type":"number","value":0.3},"sizeMax":{"type":"number","value":0.6},"speedMin":{"type":"number","value":2.5},"speedMax":{"type":"number","value":4},"gravity":{"type":"number","value":-0.3},"spin":{"type":"number","value":0},"shape":{"type":"string","value":"sphere"},"shapeSize":{"type":"number","value":0.4},"maxParticles":{"type":"number","value":150},"startPlaying":{"type":"boolean","value":true}}}
```

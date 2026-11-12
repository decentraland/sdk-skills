# Preview options

Read when choosing how to run a preview: CLI flags for `npx @dcl/sdk-commands start`, their Creator Hub **Play Options** equivalents, and the Creator Hub's experimental Bevy editor renderer.

## Preview CLI flags (`npx @dcl/sdk-commands start`)

| Flag                         | Type        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--web` (alias `--bevy-web`) | boolean     | Open the preview in the Bevy Web browser client at `decentraland.org/bevy-web/` instead of the Desktop Explorer. Chromium 142+ requires Local Network Access permission for the page to reach the localhost preview server -- when the browser asks to access apps on your device, click "Allow".                                                                                                                                                                 |
| `--mcp`                      | boolean     | Enable the MCP server in the Explorer (forwarded as a deep-link parameter)                                                                                                                                                                                                                                                                                                                                                                                        |
| `--mcp-port`                 | number      | Port for the MCP server in the Explorer                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `--multi-instance`           | boolean     | Allow running multiple Explorer instances simultaneously                                                                                                                                                                                                                                                                                                                                                                                                          |
| `--no-client`                | boolean     | Suppress auto-launch (desktop deeplink, browser, mobile QR); the file watcher still notifies a desktop Explorer if it connects on its own                                                                                                                                                                                                                                                                                                                         |
| `--no-server`                | boolean     | `@dcl/sdk@auth-server` builds only: do not spawn the Multiplayer Server; use when another preview of this project already runs one (**authoritative-server** → _Running locally_)                                                                                                                                                                                                                                                                                 |
| `--asset-bundles`            | boolean     | Accepted, no effect: the Desktop Explorer always converts the scene's models and `.ttf` fonts to optimized asset bundles locally (first run may take minutes on large scenes; results are cached). Forwarded into the deep link as `local-ab=true`, which the Explorer ignores. To preview raw GLTFs instead, pass `--lsd-raw-gltf` through (`-- --lsd-raw-gltf`; Creator Hub: **Load Raw GLTFs**, below). See **optimize-scene** ("Local Asset Bundle Preview"). |
| `-- <args>`                  | passthrough | Arguments after a standalone `--` are forwarded verbatim into the Explorer deep link as query params (`--key=value`, `--key value`, bare `--key` = true)                                                                                                                                                                                                                                                                                                          |

`--web3` and `--no-debug` (alias `-d`) are no-ops; leave them out.

## Creator Hub Play Options

Equivalent to the CLI flags above. The editor header's split button is labelled **Play** (play icon + "Play"); its dropdown arrow opens the **Play Options** popover. It lists two client rows, picked with a radio:

- **Desktop Client** (default) -- the Unity Desktop Explorer. Hovering this row opens a side flyout with the desktop-only toggles below.
- **Web (Bevy)** -- the Bevy web client; equivalent to `--web`. No toggles of its own.

Desktop Client flyout toggles:

- **Enable Landscape Terrains**: shows the surrounding landscape. Disabled (and forced off) when the scene's own `landscapeTerrain: false` hides it.
- **Multi-Instance Preview**: equivalent to `--multi-instance`. Lets a second Explorer window run alongside the first (testing recipe: **multiplayer-sync** → _Multiplayer Testing_). Only shown when the project is on **`@dcl/sdk` 7.20.4 or later**.
- **Enable MCP Server**: launches with the MCP automation server -- equivalent to `--mcp`. Only shown when the project is on **`@dcl/sdk` 7.25.0 or later**. See the **unity-explorer-mcp** skill.

Below a divider, **Show QR Code for Mobile** is a button (not a checkbox) that opens the mobile preview QR.

**App Preferences → EDITOR → Play Options** holds the persistent preview settings: **Open Debug Console** (on by default), **Enable Landscape Terrains**, and **Load Raw GLTFs** (off by default). The Desktop Explorer previews with locally converted asset bundles; **Load Raw GLTFs** opts out, passing `-- --lsd-raw-gltf` (deep-link param `lsd-raw-gltf`) so models load as raw GLTFs. The Explorer reads it only at startup, so changing it restarts a running preview on the next Play. It needs a scene `@dcl/sdk-commands` with `--` passthrough (7.26.0+; older ones drop the flag silently), and the Web (Bevy) client, mobile and the Creator Hub MCP's `launch_preview` ignore it. **Skip Auth Screen** has no checkbox; it stays on unless `--multi-instance` forces a per-window login.

## Bevy editor renderer

Settings > "Scene renderer" dropdown — **"Babylon (default)"** / **"Bevy (experimental)"**; the toggle reads **"Enable Bevy Scene Renderer"**. It lives in **Settings > Experimental**, which contains only this toggle (the AI Assistant has its own Settings > AI tab; the UI Editor has no setting). The Bevy editor supports gizmos, multi-select, free-fly camera, spawn point visualization, drag-drop assets, animation clip dropdown, lock/hide entities, screenshots, and hot-reload. It also loads **custom items** and shows **hover hints** (the entity's `PointerEvents` `hoverText`, e.g. "Press E") in the viewport.

Bevy editor behaviour that differs from normal Bevy use: every scene opens **muted** (viewport speaker toggle; scene audio, video and footsteps silent until unmuted, not remembered across opens); in the **Free** camera no avatar is shown and WASD / Space / E / Q fly the camera, the mouse wheel or trackpad zooms, and the camera cannot go below Y = 0.1 (the avatar appears on **Play** or in the **Player** camera); holding **Shift** during a gizmo drag toggles snapping, as in Babylon.

Bevy editor limitations to know before recommending it:

- **The Metrics tab is disabled** ("Scene metrics are only available with the Babylon renderer"). Run the scene preview to view the metrics.
- **`editor_screenshot` (Creator Hub MCP) errors under Bevy.**
- **Opening the UI Editor's 2D mode freezes the scene** (see **build-ui**).

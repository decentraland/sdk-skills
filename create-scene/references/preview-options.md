# Preview options

Read when choosing how to run a preview: CLI flags for `npx @dcl/sdk-commands start`, their Creator Hub **Play Options** equivalents, and the Creator Hub's experimental Bevy editor renderer.

## Preview CLI flags (`npx @dcl/sdk-commands start`)

| Flag                         | Type        | Description                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--web` (alias `--bevy-web`) | boolean     | Open the preview in the Bevy Web browser client at `decentraland.org/bevy-web/` instead of the Desktop Explorer. Chromium 142+ requires Local Network Access permission for the page to reach the localhost preview server -- when the browser asks to access apps on your device, click "Allow". |
| `--mcp`                      | boolean     | Enable the MCP server in the Explorer (forwarded as a deep-link parameter)                                                                                                                                                                                                                        |
| `--mcp-port`                 | number      | Port for the MCP server in the Explorer                                                                                                                                                                                                                                                           |
| `--multi-instance`           | boolean     | Allow running multiple Explorer instances simultaneously                                                                                                                                                                                                                                          |
| `--no-client`                | boolean     | Suppress auto-launch (desktop deeplink, browser, mobile QR); the file watcher still notifies a desktop Explorer if it connects on its own                                                                                                                                                         |
| `--asset-bundles`            | boolean     | Convert the scene's 3D models to optimized asset bundles locally in the Desktop Explorer, matching production rendering after asset-bundle conversion. First run may take several minutes on large scenes; converted models are cached. Forwarded into the deep link as `local-ab=true` -- `--local-ab` is the deep-link param, **not** a CLI flag. See **optimize-scene** ("Local Asset Bundle Preview").    |
| `-- <args>`                  | passthrough | Arguments after a standalone `--` are forwarded verbatim into the Explorer deep link as query params (`--key=value`, `--key value`, bare `--key` = true)                                                                                                                                          |

`--web3` and `--no-debug` (alias `-d`) are no-ops; leave them out.

## Creator Hub Play Options

Equivalent to the CLI flags above. The editor header's split button is labelled **Play** (play icon + "Play"); its dropdown arrow opens the **Play Options** popover. It lists two client rows, picked with a radio:

- **Desktop Client** (default) -- the Unity Desktop Explorer. Hovering this row opens a side flyout with the desktop-only toggles below.
- **Web (Bevy)** -- the Bevy web client; equivalent to `--web`. No toggles of its own.

Desktop Client flyout toggles:

- **Enable Landscape Terrains**: shows the surrounding landscape. Disabled (and forced off) when the scene's own `landscapeTerrain: false` hides it.
- **Multi-Instance Preview**: equivalent to `--multi-instance`. Lets a second Explorer window run alongside the first (testing recipe: **multiplayer-sync** → *Multiplayer Testing*). Only shown when the project is on **`@dcl/sdk` 7.20.4 or later**.
- **Enable MCP Server**: launches with the MCP automation server -- equivalent to `--mcp`. Only shown when the project is on **`@dcl/sdk` 7.25.0 or later**. See the **unity-explorer-mcp** skill.
- **Compress Assets**: previews with assets compressed the way they are in production -- equivalent to `--asset-bundles`. First run may be slow; results are cached. Hidden on Linux (no Unity desktop client ships there) and for scenes whose `@dcl/sdk-commands` predates 7.26.0 (update the SDK to get it).

Below a divider, **Show QR Code for Mobile** is a button (not a checkbox) that opens the mobile preview QR.

The debug console is on by default, with no checkbox in the popover. **Skip Auth Screen** is not in the popover either; it stays on unless `--multi-instance` forces a per-window login.

## Bevy editor renderer

Settings > "Scene renderer" dropdown — **"Babylon (default)"** / **"Bevy (experimental)"**; the toggle reads **"Enable Bevy Scene Renderer"**. It lives in **Settings > Experimental**, which contains only this toggle (the AI Assistant has its own Settings > AI tab; the UI Editor has no setting). The Bevy editor supports gizmos, multi-select, free-fly camera, spawn point visualization, drag-drop assets, animation clip dropdown, lock/hide entities, screenshots, and hot-reload. It also loads **custom items** and shows **hover hints** (the entity's `PointerEvents` `hoverText`, e.g. "Press E") in the viewport.

Bevy editor limitations to know before recommending it:

- **The Metrics tab is disabled** ("Scene metrics are only available with the Babylon renderer"). Run the scene preview to view the metrics.
- **`editor_screenshot` (Creator Hub MCP) errors under Bevy.**
- **Opening the UI Editor's 2D mode freezes the scene** (see **build-ui**).

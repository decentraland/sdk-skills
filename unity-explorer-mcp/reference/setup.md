# Setup branches

The paths a minority of sessions take, reached from Setup steps 1 and 2.

## Launch flags and errors

`npm run start -- --mcp --skip-auth-screen true` takes these extra flags:

- `--mcp-port <port>` — MCP server port (implies `--mcp`); adjust the 8123 URLs in Setup steps 1 and 2 to match.
- `--port <port>` — dev-server port; the launched client follows it automatically.
- `--position x,y` — spawn parcel. Defaults to `scene.base` from `scene.json`; leave it out unless you need another parcel of the scene. A position outside `scene.parcels` can leave the Explorer looping on the loading screen.
- `--multi-instance` — allow concurrent Explorer instances; this is what gives you a second process. `-n` is not a substitute: it adds `open-deeplink-in-new-instance` to the deep link, which is not on the Explorer's deep-link allowlist (so it raises an unsafe-parameters dialog), and the single-instance lock checks only `multi-instance`.
- **Windows appends `/` to the last deep-link value**, and the Explorer strips it only from `realm` (`ApplicationParametersParser`). `mcp-port=8124/` fails integer parsing and silently falls back to 8123. Put a harmless parameter last (e.g. `-- --hub true`) so it absorbs the suffix, then probe the port you asked for before assuming it applied. Graphics and window flags forwarded through the deep link did not apply on this path in a 2026-10 Windows session; when they matter, launch `Decentraland.exe` directly with them (below). Verify the effective MCP port, scene readiness, cached identity and quality preset as **separate** checks — they fail independently.
- Anything after a second standalone `--` is forwarded verbatim into the Explorer launch as extra parameters, e.g. `npm run start -- --mcp --skip-auth-screen true -- --windowed-mode --resolution 1280x720` (npm consumes the first `--`).

Two launch errors:

- **`--mcp` rejected as an unknown option**: the scene's `@dcl/sdk-commands` predates the flag and the MCP server does not exist yet. Update from the scene folder with `npm install @dcl/sdk@latest` and retry, or launch a specific build by hand (below).
- **"Please download & install the Decentraland Desktop Client"**: the dev server is fine but no client is installed — install one, or launch a specific build by hand (below).

The Creator Hub's **Enable MCP Server** checkbox (**Play Options** — the dropdown arrow on the editor header's **Play** button — then hover **Desktop Client**) passes `--mcp` to this same process, and appears only when the scene's `@dcl/sdk-commands` supports the flag — a missing checkbox is the first error above in another guise.

## Running a second stack alongside an existing one

When the user wants to keep the already-running scene server and its Explorer untouched, start a second stack on its own ports — a different dev-server port, a different MCP port, and `--multi-instance` so a second Explorer instance can run concurrently:

```bash
npm install && npm run start -- --port 8666 --multi-instance --mcp-port 8124 --skip-auth-screen true
```

From here on use the chosen ports instead of 8000/8123 — including registration, which needs a distinct server name, e.g. `explorer2` at `http://127.0.0.1:8124/unity-explorer-mcp` (in Claude Code: `claude mcp add --transport http --scope user explorer2 http://127.0.0.1:8124/unity-explorer-mcp`, and the tools surface as `mcp__explorer2__*`; other clients: the shapes below with the new name and port).

## Launching a specific Explorer build manually

Only when the user points you at their own build instead of the installed client. Serve with `npm run start -- --no-client`, then launch at the scene's base parcel. Read `scene.base` from `scene.json` on every launch; never reuse the position from an earlier launch, since the owner may have moved the scene:

```bash
# macOS — replace <base> with scene.base, e.g. 52,-14
open /path/to/Decentraland.app --args \
  --realm http://127.0.0.1:8000 --local-scene true --position <base> \
  --debug --skip-auth-screen --skip-version-check true \
  --mcp --windowed-mode --resolution 1280x720
```

On Windows call `Decentraland.exe` with the same arguments. Add `--disable-hud --skybox-time-enabled false --landscape-terrain-enabled false` when you want deterministic screenshots without HUD noise.

## The Explorer running inside the Unity Editor

A developer may run the client in Unity Editor play mode (`--mcp` in `Main Scene Loader → Debug Settings → App Parameters`) instead of an installed build. The MCP endpoint is the same, but the server belongs to the `Unity` process: the Setup probe answers, `pgrep` for the Explorer app finds nothing, and launching, killing or relaunching is the user's — never run the recipes in [`recovery.md`](recovery.md) against the Editor. In-session, the Game view is unfocused whenever you type in a terminal, so the device-path UI tools refuse and the OS cursor sits off the Game view; both are covered in [`interaction.md`](interaction.md) (the device path, and `get_reticle`'s `cursor.onScreen`).

## Registering in other clients

Claude Code registers with the command in SKILL.md Setup step 2. Every other client takes these connection details in its own config format. After registering, reload or restart the client, or start a new session, so it connects. The Explorer must already be running at that point (see the bind gate).

| Field | Value |
|---|---|
| Transport | Streamable HTTP (**not** stdio — nothing to spawn; the server is embedded in the running Explorer) |
| URL | `http://127.0.0.1:8123/unity-explorer-mcp` (`--mcp-port <port>` changes the port) |
| Auth | none |
| Name | `explorer` |

**Codex CLI** (≥ 0.148 speaks HTTP MCP natively):

```toml
# ~/.codex/config.toml
[mcp_servers.explorer]
url = "http://127.0.0.1:8123/unity-explorer-mcp"
```

**Cursor**, in `.cursor/mcp.json` at the scene root (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "explorer": { "url": "http://127.0.0.1:8123/unity-explorer-mcp" }
  }
}
```

**Gemini CLI**, in `.gemini/settings.json` at the scene root or `~/.gemini/settings.json`. The key is `httpUrl`, not `url`:

```json
{ "mcpServers": { "explorer": { "httpUrl": "http://127.0.0.1:8123/unity-explorer-mcp" } } }
```

**VS Code with GitHub Copilot**, in `.vscode/mcp.json`. The top-level key is `servers`, not `mcpServers`:

```json
{
  "servers": {
    "explorer": { "type": "http", "url": "http://127.0.0.1:8123/unity-explorer-mcp" }
  }
}
```

**Any other client** (Cline, Windsurf, a custom SDK harness): most take the common `mcpServers` shape above, sometimes with `"type": "http"` or a client-specific transport name. Check the client's docs for the exact keys.

If the client cannot do Streamable HTTP at all, skip registration and drive the endpoint over HTTP instead — see [`curl-fallback.md`](curl-fallback.md).

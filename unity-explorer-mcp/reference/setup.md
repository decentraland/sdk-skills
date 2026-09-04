# Setup branches

The paths a minority of sessions take, reached from Setup steps 1 and 2.

## Running a second stack alongside an existing one

When the user wants to keep the already-running scene server and its Explorer untouched, start a second stack on its own ports — a different dev-server port (`--port`; the launched client follows it automatically), a different MCP port (`--mcp-port`, implies `--mcp`), and `--multi-instance` so a second Explorer instance can run concurrently:

```bash
npm install && npm run start -- --port 8666 --multi-instance --mcp-port 8124 --skip-auth-screen true
```

From here on use the chosen ports instead of 8000/8123 — including registration, which needs a distinct server name (e.g. `claude mcp add --transport http --scope user explorer2 http://127.0.0.1:8124/unity-explorer-mcp`; the tools then surface as `mcp__explorer2__*`).

## Launching a specific Explorer build manually

Only when the user points you at their own build instead of the installed client. Serve with `npm run start -- --no-client`, then:

```bash
# macOS
open /path/to/Decentraland.app --args \
  --realm http://127.0.0.1:8000 --local-scene true --position 0,0 \
  --debug --skip-auth-screen --skip-version-check true \
  --mcp --windowed-mode --resolution 1280x720
```

On Windows call `Decentraland.exe` with the same arguments. Add `--disable-hud --skybox-time-enabled false --landscape-terrain-enabled false` when you want deterministic screenshots without HUD noise.

## Registering in a client other than Claude Code

`claude mcp add` / `/mcp` are Claude Code commands. This section is **not** for the Claude Code VS Code extension or the Creator Hub's embedded chat — those are Claude Code and use SKILL.md step 2 (see the bind gate for their `/mcp reconnect` and new-tab differences). In any genuinely different MCP client (Cursor, Cline, a custom SDK harness), register the server the way that client documents, using these connection details — then reload/restart the client so it picks the server up:

| Field | Value |
|---|---|
| Transport | Streamable HTTP (**not** stdio; no command to spawn — the server is embedded in the already-running Explorer) |
| URL | `http://127.0.0.1:8123/unity-explorer-mcp` (`--mcp-port <port>` changes the port) |
| Auth | none |
| Suggested name | `explorer` (tool prefix follows your client's convention) |

A common JSON shape, for clients that configure servers in a file (`.cursor/mcp.json`, `mcp.json`, etc. — key names vary, check your client's docs):

```json
{
  "mcpServers": {
    "explorer": { "type": "http", "url": "http://127.0.0.1:8123/unity-explorer-mcp" }
  }
}
```

If the client cannot do Streamable HTTP at all, skip registration and drive the endpoint over HTTP instead — see [`curl-fallback.md`](curl-fallback.md).

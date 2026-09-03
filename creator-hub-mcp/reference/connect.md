# Connecting an external agent to the Creator Hub MCP

For sessions that are **not** the Creator Hub's own AI assistant (that one is pre-wired). Any MCP client that speaks Streamable HTTP with a custom header can connect.

## Where the connection details come from

The server is localhost-only and gated by a bearer token. Both the **port and the token are random and change every time the Creator Hub starts**, so they are never something you can hard-code — the user copies them from the app:

1. Creator Hub → **Settings > Experimental** → tick **Expose AI assistant MCP server**.
2. A read-only JSON snippet appears with a **Copy configuration** button. It has this shape:

```json
{
  "mcpServers": {
    "creator-hub": {
      "type": "http",
      "url": "http://127.0.0.1:<PORT>/mcp",
      "headers": { "Authorization": "Bearer <TOKEN>" }
    }
  }
}
```

The same snippet is offered in the AI assistant panel under *"No CLI? Connect a tool you already use"* when no `claude`/`codex` CLI is detected.

| Field | Value |
| --- | --- |
| Transport | Streamable HTTP (stateful, one session per `Mcp-Session-Id`). Not stdio — nothing to spawn; the server lives inside the running Creator Hub. |
| URL | `http://127.0.0.1:<PORT>/mcp` — port chosen at app start |
| Auth | `Authorization: Bearer <TOKEN>` — token generated at app start; wrong or stale → `401 Unauthorized` |
| Server name | `creator-hub` (tools surface as `mcp__creator-hub__*` in Claude Code) |
| Scope | The scene currently open in the editor window |

Ticking the setting (or opening the AI panel) is what starts the server; a Creator Hub that has never shown the snippet has nothing listening.

## Register it in your client

Paste the snippet where your client keeps MCP servers, then reload so it binds. Because the values rotate, prefer a **project-local** config you can overwrite each session over a global one — and don't commit it (the token only opens the local editor, but it is still a secret for that session).

**Claude Code** — either drop the snippet into `.mcp.json` at the scene root (project scope), or register from the shell (`--header` is repeatable):

```bash
claude mcp add --transport http --scope local creator-hub http://127.0.0.1:<PORT>/mcp \
  --header "Authorization: Bearer <TOKEN>"
```

Claude Code binds MCP servers at session start. After adding one mid-session, `/mcp reconnect creator-hub` (VS Code extension / embedded panels) or the `/mcp` menu (terminal), or start a new session — same bind rules as the **unity-explorer-mcp** skill describes. "already exists" on re-add means an older entry is there: `claude mcp remove creator-hub` first, since the old URL/token are dead anyway.

**Codex CLI** (≥ 0.148 speaks HTTP MCP natively) — the token goes through an env var so it stays out of `ps`:

```toml
# ~/.codex/config.toml (or -c overrides on the command line)
[mcp_servers.creator-hub]
url = "http://127.0.0.1:<PORT>/mcp"
bearer_token_env_var = "CREATOR_HUB_MCP_TOKEN"
```

```bash
export CREATOR_HUB_MCP_TOKEN=<TOKEN>
```

**Cursor / Claude Desktop / other JSON-configured clients** — the snippet is already in the common `mcpServers` shape; paste it into the client's MCP file (`.cursor/mcp.json`, `claude_desktop_config.json`, …; key names vary, check the client's docs) and restart the client.

## Probe

```bash
curl -s -m 2 http://127.0.0.1:<PORT>/mcp -X POST \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}'
```

| Result | Meaning |
| --- | --- |
| `serverInfo` with `"name":"creator-hub"` | Up; register/reconnect your client. |
| `401 Unauthorized` | Token is stale (Creator Hub restarted) or mistyped — re-copy the snippet. |
| connection refused | Creator Hub not running, restarted on a new port, or the server was never started (tick the setting). |
| Tools bind but mutations return `No editor window is open.` | The user is on the scene list — ask them to open the scene. |

The probe is only for diagnosing a connection. Drive the scene through the bound MCP tools, not over curl.

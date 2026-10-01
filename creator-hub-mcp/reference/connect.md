# Connecting an external agent to the Creator Hub MCP

For sessions that are **not** the Creator Hub's own AI assistant (that one is pre-wired). Any MCP client that speaks Streamable HTTP with a custom header can connect.

Connecting the MCP gives the agent the **tools**, not the **skills**. The Creator Hub links `decentraland/sdk-skills` into a scene only for its own embedded assistant (and those links are only present in the scene folder while the app has it open). From an external client, install the skills yourself with `npx skills add decentraland/sdk-skills --all` unless your session already runs inside a scene folder the Creator Hub has open — details in the main skill under *Where the skills come from*.

## Where the connection details come from

The server is localhost-only and gated by a bearer token. Both the **port and the token are random and change every time the Creator Hub starts**, so they are never something you can hard-code — the user copies them from the app:

1. Creator Hub → **Settings > AI** → expand **Expose AI assistant MCP server** (help text: *"Let an AI agent running outside Creator Hub control the open scene. Paste this into the agent's MCP configuration."*). The section only appears when **Enable AI Assistant** is on, which it is by default since Creator Hub 0.50.0. (Before 0.50.0 all of this lived under Settings > Experimental — update any instruction still saying that.)
2. A read-only JSON snippet appears with a **Copy configuration** button, under the note *"Localhost only. The URL and token change each time Creator Hub restarts."* It has this shape:

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

The same snippet is offered in the AI assistant panel when no provider CLI is detected.

### Settings > AI (labels as of creator-hub `e9ba6357`, Creator Hub 0.50.0)

The AI Assistant left Experimental and now has its own **AI** tab. These are the current strings, in case a user reads you a different one:

| Control | Note |
| --- | --- |
| **Enable AI Assistant** | The master switch for the embedded assistant, now **on by default**. Help text: *"Runs your installed Claude, Codex, Cursor, or Gemini CLI with full access to your machine, the same reach it has in your terminal."* The toggle is kept (unlike the UI Editor's) precisely so it can be turned off. |
| **Bill this to an API key instead** | Nested under the switch, off by default. Uses `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `CURSOR_API_KEY` / `GEMINI_API_KEY` from the environment rather than the signed-in subscription. |
| **Connect** (accordion) | One row per detected provider: **Connected**, or **Sign in** / **Sign out**. A **Via Terminal** section gives the install and sign-in commands. Gemini has no scriptable login subcommand, so it shows no in-app Sign in button. |
| **Expose AI assistant MCP server** | The accordion described above; expanding it turns the server on. Only shown while **Enable AI Assistant** is on. |

**Settings > Experimental now holds only the Bevy renderer toggle.** The **Enable UI Editor** row is gone — the UI Editor is stable and always on (see **editable-ui**), gated only by the scene's SDK version.

**Out-of-date CLI warning.** The assistant refuses to use newer models behind an old CLI and shows: *"Your Claude CLI (vX) is out of date — run `claude update` in a terminal to use the latest models."* The minimum is Claude CLI **2.1.251**. If a user reports this, the fix is `claude update` in a terminal, not anything in the Creator Hub. An unreadable version string is treated as up to date.

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

**Gemini CLI** reads MCP servers from the workspace's `.gemini/settings.json`, under `mcpServers` with an `httpUrl` key (not `url`), and expands `$VAR` inside header values:

```json
{ "mcpServers": { "creator-hub": {
  "httpUrl": "http://127.0.0.1:<PORT>/mcp",
  "headers": { "Authorization": "Bearer $CREATOR_HUB_MCP_TOKEN" },
  "trust": true
} } }
```

### Inside the Creator Hub's own assistant, all four providers now get the scene tools

As of creator-hub `2cf0dc7e` the CH MCP scene tools are wired for **Claude, Codex, Cursor and Gemini** — the earlier Cursor/Gemini gap is closed. The app writes the config per provider and sets `CREATOR_HUB_MCP_TOKEN` on the child process: Claude via `--mcp-config`, Codex via `-c mcp_servers.creator-hub.bearer_token_env_var`, Gemini via `.gemini/settings.json` with a `$CREATOR_HUB_MCP_TOKEN` reference, and Cursor via a project `.cursor/mcp.json`. **Cursor's config format has no token indirection**, so the bearer token sits literally in `.cursor/mcp.json`; the Creator Hub writes it `0600` and adds it to the scene's `.gitignore`. If you are working in a scene folder and see `.cursor/mcp.json` or `.gemini/settings.json` appear, those are the Creator Hub's — do not commit them and do not hand-edit them.

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

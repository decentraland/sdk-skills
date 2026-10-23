# Connecting an external agent to the Creator Hub MCP

For sessions that are **not** the Creator Hub's own AI assistant (that one is pre-wired). Any MCP client that speaks Streamable HTTP with a custom header can connect.

Connecting the MCP gives the agent the **tools**, not the **skills**. The Creator Hub links `decentraland/sdk-skills` into a scene only for its own embedded assistant (and those links are only present in the scene folder while the app has it open). From an external client, install the skills yourself with `npx skills add decentraland/sdk-skills --all` (no Node on the machine? the Hub bundles one — see Gotchas in the main skill) unless your session already runs inside a scene folder the Creator Hub has open — details in the main skill under *Where the skills come from*.

## Where the connection details come from — check these in order, before asking the user

The server is localhost-only and gated by a bearer token. Both the **port and the token are random and change every time the Creator Hub starts**, so never hard-code them. Since Creator Hub builds that include creator-hub PR #1718 (`feat(ai): make the scene MCP server discoverable by external agents`; **unreleased as of 2026-10-23**, expected in the next release after 0.50.x) the Hub **writes them to disk for you** — try steps 1 and 2 yourself; only step 3 involves the user. Verified in `packages/creator-hub/main/src/modules/mcp-discovery.ts` on the PR branch `feat/mcp-auto-discovery`.

What changed in those builds (2026-10-23):

- **Settings > AI > *Expose AI assistant MCP server* is on by default** (`exposeMcpServer: true`; existing installs are switched on once via an `exposeMcpServerPromoted` marker; a later switch-off sticks).
- **Opening a scene starts the server and points it at that scene** (`ai.sceneOpened` IPC → `setSceneMcpProject` + publish). Before, the server started only from an embedded AI turn or the Settings tab, and the disk-read tools answered `No scene is open.` to external clients.
- Never print, echo or paste the token into chat or a log. Read it from the file inside the command that uses it (command substitution / env var), and send that command's stdout to `/dev/null` when the tool might echo headers.

### Step 1 — `<scene>/.mcp.json` (project scope, zero-touch in Claude Code)

Written into the scene folder **every time the scene opens in the editor** while the setting is on, and when the setting is switched on with a scene open. Shape (the user's own servers in the file are kept, the Hub merges its entry in):

```json
{ "mcpServers": { "creator-hub": {
  "type": "http",
  "url": "http://127.0.0.1:<PORT>/mcp",
  "headers": { "Authorization": "Bearer <TOKEN>" }
} } }
```

- Created `0600`; a `.mcp.json` rule is appended to the scene's `.gitignore` **before** the first write. Never deployed: Hub scenes' `.dclignore` starts with `.*`. Do not commit or hand-edit it.
- Switching the setting off removes **only** the `creator-hub` entry (the file too, if nothing else is left). **Closing the scene or quitting the Hub leaves it in place** — its token is dead after the next Hub launch until the scene is opened again, which rewrites it.
- **Claude Code started in the scene folder after the file was written:** nothing to do — `creator-hub` is listed under `/mcp` and the tools are `mcp__creator-hub__*`. An interactive session may show Claude Code's own one-time "approve this project's MCP servers" prompt (not the Hub's).
- **Claude Code started before the file existed** (or before the Hub restarted): servers bind at session start, so the file is not seen yet. You cannot reconnect yourself; ask the user for one action — `/mcp` menu → `creator-hub` → reconnect (terminal) or `/mcp reconnect creator-hub` (VS Code extension), or a new session. No copying needed.
- The embedded assistant passes the same server via `--mcp-config` too; a `creator-hub` defined both there and in `.mcp.json` yields a **single** entry with no warning (checked by the PR author with Claude Code 2.1.267).

Is the file current? Compare its token with the discovery file (step 2) without printing either:

```bash
F="$HOME/Library/Application Support/creator-hub/mcp-server.json"   # path per OS: table below
node -e 'const a=require(process.argv[1]),b=require(process.argv[2]);console.log(a.mcpServers?.["creator-hub"]?.headers?.Authorization==="Bearer "+b.token?"current":"stale: reopen the scene in the Hub")' "$PWD/.mcp.json" "$F"
```

### Step 2 — `<userData>/mcp-server.json` (universal, any client, any working directory)

| OS | Path |
| --- | --- |
| macOS | `~/Library/Application Support/creator-hub/mcp-server.json` |
| Windows | `%APPDATA%\creator-hub\mcp-server.json` |
| Linux | `~/.config/creator-hub/mcp-server.json` (`$XDG_CONFIG_HOME/creator-hub/…`; Electron's `app.getPath('userData')` convention — the Hub ships no Linux installer, so dev builds only) |

Shape: `{ "url": "http://127.0.0.1:<PORT>/mcp", "token": "<TOKEN>", "pid": <hub pid>, "startedAt": "<ISO time>", "version": "<hub version>" }`. Written `0600` and atomically (temp file + rename) **whenever the server comes up with the setting on** — on scene open, an embedded AI turn, or the Settings tab — and removed on quit and when the setting is switched off. **Missing file** = the Hub is not running, the setting is off, or nothing has started the server yet this launch (Hub sitting on the scene list) → ask the user to open the scene. A crashed Hub leaves the file behind; it is overwritten on the next start, so **check that `pid` is alive before trusting it**:

```bash
node -e 'const j=require(process.argv[1]);try{process.kill(j.pid,0);console.log("live",j.url,"Hub",j.version)}catch{console.log("stale: Hub pid",j.pid,"is gone")}' "$F"
```

`process.kill(pid, 0)` only tests for existence and works on Windows too; do **not** use Python's `os.kill(pid, 0)` on Windows (signal 0 there is `CTRL_C_EVENT`). No `node` on PATH: the Hub bundles one (Gotchas in the main skill), or read fields with `python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["url"])' "$F"`.

**Self-register — Claude Code** (from any directory other than the scene folder; in the scene folder step 1 already covers you):

```bash
claude mcp remove creator-hub -s local >/dev/null 2>&1   # drop a stale entry; always pass -s local
claude mcp add --transport http --scope local creator-hub \
  "$(node -p 'require(process.argv[1]).url' "$F")" \
  --header "Authorization: Bearer $(node -p 'require(process.argv[1]).token' "$F")" >/dev/null
```

- **Pass `-s local` to `remove`.** Without a scope, `claude mcp remove` deletes from whichever scope has the name — run in the scene folder, that is the Hub's `.mcp.json` entry.
- **Do not add a local-scope `creator-hub` inside the scene folder.** Claude Code resolves a name local → project → user, so a local entry shadows the `.mcp.json` the Hub rewrites on every open, and after the next Hub launch it is a dead token that wins → `401`.
- Then the same bind rule as step 1: `/mcp` reconnect or a new session (one user action if your session is already running). Clean up later with `claude mcp remove creator-hub -s local`.

**Self-register — Codex CLI** (≥ 0.148): set the URL in `~/.codex/config.toml` (`[mcp_servers.creator-hub]` `url = "<url from the file>"`, `bearer_token_env_var = "CREATOR_HUB_MCP_TOKEN"`), and start Codex with the token exported from the file — Codex reads the env var from its own process, so a session that is already running needs a restart:

```bash
export CREATOR_HUB_MCP_TOKEN="$(node -p 'require(process.argv[1]).token' "$F")"
codex -c "mcp_servers.creator-hub.url=\"$(node -p 'require(process.argv[1]).url' "$F")\"" \
      -c 'mcp_servers.creator-hub.bearer_token_env_var="CREATOR_HUB_MCP_TOKEN"'
```

**Cursor:** the Hub writes `<scene>/.cursor/mcp.json` (literal token, `0600`, gitignored) when its embedded assistant runs a Cursor turn (`writeCursorMcpConfig`, `main/src/modules/ai.ts`; existing behaviour) — it is not rewritten on scene open, so after a Hub restart it can be stale until the next embedded Cursor turn. Otherwise write the step-2 values into it yourself. **Claude Desktop / Gemini CLI / others:** write the step-2 values into the client's config (formats under *Register it in your client*) and restart the client.

### Step 3 — neither file: the Settings copy/paste (fallback, and the only path on Hubs up to 0.50.x)

Use this when the Hub predates PR #1718, when the setting is off (neither file exists while it is), or when the files cannot be written. The user copies the details from the app:

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

**Settings > Experimental now holds only the Bevy renderer toggle.** The **Enable UI Editor** row is gone — the UI Editor is stable and always on (see **build-ui**), gated only by the scene's SDK version.

**Out-of-date CLI warning.** The assistant refuses to use newer models behind an old CLI and shows: *"Your Claude CLI (vX) is out of date — run `claude update` in a terminal to use the latest models."* The minimum is Claude CLI **2.1.251**. If a user reports this, the fix is `claude update` in a terminal, not anything in the Creator Hub. An unreadable version string is treated as up to date.

| Field | Value |
| --- | --- |
| Transport | Streamable HTTP (stateful, one session per `Mcp-Session-Id`). Not stdio — nothing to spawn; the server lives inside the running Creator Hub. |
| URL | `http://127.0.0.1:<PORT>/mcp` — port chosen at app start |
| Auth | `Authorization: Bearer <TOKEN>` — token generated at app start; wrong or stale → `401 Unauthorized` |
| Server name | `creator-hub` (tools surface as `mcp__creator-hub__*` in Claude Code) |
| Scope | The scene currently open in the editor window |

On Hubs up to 0.50.x, ticking the setting (or opening the AI panel) is what starts the server; a Creator Hub that has never shown the snippet has nothing listening. In builds with PR #1718 opening a scene also starts it while the setting is on (2026-10-23).

## Register it in your client

Paste the snippet (or the step-2 values) where your client keeps MCP servers, then reload so it binds. Because the values rotate, prefer a **project-local** config you can overwrite each session over a global one — and don't commit it (the token only opens the local editor, but it is still a secret for that session).

**Claude Code** — either drop the snippet into `.mcp.json` at the scene root (project scope; on Hubs with PR #1718 the Hub already does this — don't hand-edit its entry), or register from the shell (`--header` is repeatable):

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
| `401 Unauthorized` | Token is stale (Creator Hub restarted) or mistyped. With a `.mcp.json` present: it was written by an earlier Hub launch — the scene has not been reopened since (compare tokens, step 1) or a local-scope `creator-hub` entry is shadowing it; ask the user to open the scene, then reconnect. With a self-registered entry: re-read `mcp-server.json` and re-register. On older Hubs: re-copy the snippet. |
| connection refused | Creator Hub not running, restarted on a new port, or the server was never started (open a scene, or tick the setting). A `mcp-server.json` whose `pid` is dead is the same case. |
| Tools bind but mutations return `No editor window is open.` | The user is on the scene list — ask them to open the scene. |
| Tools bind, the scene is open, but `scene_state` / `get_project_info` / `entity_detail` / `launch_preview` return `No scene is open.` | Hubs **without** PR #1718: expected from an external client — those four are bound to the project only by the embedded assistant. Probe with `get_selection`, read the composite from disk, mutate through the tools, preview via the Play button's **Enable MCP Server** — see Gotchas in the main skill. Hubs **with** it bind the project on scene open, so there it means no scene has been opened since this Hub launch. (Closing a scene does not unbind it: `sceneClosed` only forgets where to write `.mcp.json`, so the disk-read tools keep reading the last opened scene while mutations answer `No editor window is open.`.) |

The probe is only for diagnosing a connection. Drive the scene through the bound MCP tools, not over curl.

# Connecting an external agent to the Creator Hub MCP

For sessions that are **not** the Creator Hub's own AI assistant (that one is pre-wired): Claude Code in a terminal or VS Code, Codex, Cursor, Claude Desktop, Gemini CLI, any MCP client that speaks Streamable HTTP with a custom header.

Connecting gives you the **tools**, not the **skills**: see the main skill → *Where the skills come from*.

## How outside access works

- **Opt-in, off by default:** Settings > AI > **Allow other AI apps to edit your scenes**. A separate switch from *Enable AI Assistant*, shown whether or not the assistant is on. Help text: *"Lets AI apps you use on this computer, like Claude Code or Codex, see and change the scene you have open. Claude Code started in your scene's folder connects on its own. Turning this off disconnects them right away. The AI Assistant above doesn't need this."*
- **While it is on, the Hub keeps two files current:**
  - `<scene>/.mcp.json`: Claude Code's project-scope config, written for the scene **open in the editor** (on scene open, and when access is granted with a scene open). Written only when the scene has no `.mcp.json` of its own: the Hub owns a `.mcp.json` only when it holds nothing but its `creator-hub` entry on `http://127.0.0.1:…`; any other file is the creator's and is never written or removed. Gitignored before the first write (comment line *"Creator Hub — holds a local connection token, do not commit"*), mode `0600`. **Removed when the scene closes**, when access is turned off, and when the Hub quits. A crashed Hub leaves it behind until that scene is opened again (rewritten with access on, removed with it off), and it carries no `pid`: it is live only when its `url` and token match a `mcp-server.json` whose `pid` is alive.
  - `<userData>/mcp-server.json`: `{ "url", "token", "pid", "startedAt", "version" }` for any client. Written (atomically, `0600`) when access is granted, including at Hub start when the setting was left on; scene open or not. Removed when access is turned off and when the Hub quits. A crashed Hub leaves it behind: check `pid`.
- **Outside agents get their own token**, separate from the embedded assistant's. Turning access off drops it and closes every outside session at once (later calls get `401`); turning it on again mints a new one. Port and token also change on every Hub launch. Within one Hub run, closing and reopening a scene rewrites `.mcp.json` with the same URL and token.
- **An agent can ask for access** by creating `<userData>/mcp-server.request` (any content; the Hub consumes the file). Access off → the creator gets a notice that stays until answered: *"An AI app on this computer wants to see and change your open scene."* with **Allow** / **Don't allow**. Only **Allow** turns the setting on; **Don't allow** grants nothing. Access already on → the Hub rewrites `mcp-server.json`. A request made while the Hub is closed is handled at its next start.
- **The tools follow the editor.** Opening a scene binds every tool to it (`scene_state`, `get_project_info`, `entity_detail` and `launch_preview` included); leaving the scene detaches them, and every tool then answers `No scene is open.` With the Hub running and no scene open, the server is up and the files exist, but nothing can be read or changed yet.

Source: `packages/creator-hub/main/src/modules/mcp-discovery.ts`, `scene-mcp.ts` (`setExternalMcpAccess`, `callerFor`), `project-config-files.ts`.

## Connect — try these in order before asking the user

Never print, echo or paste the token into chat, a log or a commit. Read it from the file inside the command that uses it (command substitution or an env var) and send the command's stdout to `/dev/null` when it might echo headers.

| OS | `<userData>` |
| --- | --- |
| macOS | `~/Library/Application Support/creator-hub` |
| Windows | `%APPDATA%\creator-hub` |
| Linux | `~/.config/creator-hub` (Electron `app.getPath('userData')`; `$XDG_CONFIG_HOME` if set) |

```bash
F="$HOME/Library/Application Support/creator-hub/mcp-server.json"   # path per OS: table above
```

### Step 1 — `<scene>/.mcp.json` (Claude Code in the scene folder)

- **Session started in the scene folder after the file was written:** nothing to do. `creator-hub` is listed under `/mcp` and the tools are `mcp__creator-hub__*`. An interactive Claude Code may ask once to approve the project's MCP servers (Claude Code's prompt, not the Hub's).
- **Session started before the file existed** (scene opened later, access granted later, Hub restarted): Claude Code binds servers at session start. Ask the user for one action: `/mcp` menu → `creator-hub` → reconnect (terminal), `/mcp reconnect creator-hub` (VS Code extension), or a new session. Nothing to copy.
- Leave the file alone: no hand edits, no commits. It is never deployed: `sdk-commands` always adds `.*` to the ignore patterns, whatever `.dclignore` says (`logic/dcl-ignore.ts`).
- **No `.mcp.json` although the scene is open:** access is off (go to step 3), or the scene has a `.mcp.json` of the creator's own (go to step 2).
- **A `.mcp.json` whose `url` and token differ from a live `mcp-server.json`, or no live `mcp-server.json` at all:** a crashed Hub's leftover, not proof the scene is open. Go to step 2.

### Step 2 — `<userData>/mcp-server.json` (any client, any working directory)

Check the file is live before using it:

```bash
node -e 'const j=require(process.argv[1]);try{process.kill(j.pid,0);console.log("live",j.url,"Hub",j.version)}catch{console.log("stale: Hub pid",j.pid,"is gone")}' "$F"
```

`process.kill(pid, 0)` only tests that the process exists and works on Windows too (Python's `os.kill(pid, 0)` does not: on Windows signal 0 is `CTRL_C_EVENT`). No `node` on PATH: use the Hub's bundled one (main skill → Gotchas).

**Claude Code** (from a folder other than the scene, or a scene with its own `.mcp.json`):

```bash
claude mcp remove creator-hub -s local >/dev/null 2>&1   # drop a stale entry
claude mcp add --transport http --scope local creator-hub \
  "$(node -p 'require(process.argv[1]).url' "$F")" \
  --header "Authorization: Bearer $(node -p 'require(process.argv[1]).token' "$F")" >/dev/null
```

- Always pass `-s local` to `remove`: without a scope it deletes from whichever scope has the name, which in the scene folder is the Hub's `.mcp.json`.
- In a scene folder that has the Hub's `.mcp.json`, skip this: Claude Code resolves a name local → project → user, so a local `creator-hub` shadows the file the Hub keeps current, and after the next Hub launch it is a dead token that wins (`401`).
- Then the bind rule from step 1: one `/mcp` reconnect or a new session. Clean up later with `claude mcp remove creator-hub -s local`.

**Codex CLI** (≥ 0.148 speaks HTTP MCP natively): the token goes through an env var Codex reads from its own process, so a running Codex needs a restart:

```bash
export CREATOR_HUB_MCP_TOKEN="$(node -p 'require(process.argv[1]).token' "$F")"
codex -c "mcp_servers.creator-hub.url=\"$(node -p 'require(process.argv[1]).url' "$F")\"" \
      -c 'mcp_servers.creator-hub.bearer_token_env_var="CREATOR_HUB_MCP_TOKEN"'
```

The same two keys can live in `~/.codex/config.toml` under `[mcp_servers.creator-hub]`.

**Cursor, Claude Desktop, Gemini CLI, others:** write the URL and token into the client's own MCP config (formats under *Client config formats*) and restart the client. In a scene folder, `.cursor/mcp.json` and `.gemini/settings.json` belong to the embedded assistant, which rewrites its `creator-hub` entry (with the assistant's token) on its own Cursor / Gemini turns: register an outside Cursor in `~/.cursor/mcp.json` instead. [UNVERIFIED: how Cursor resolves a `creator-hub` name defined in both the global and the project file.]

### Step 3 — neither file: request access

```bash
touch "$HOME/Library/Application Support/creator-hub/mcp-server.request"   # per-OS <userData>
```

Windows PowerShell: `New-Item -ItemType File -Force "$env:APPDATA\creator-hub\mcp-server.request"`.

Then tell the creator: *"Creator Hub will ask whether an AI app may see and change your open scene. Click **Allow**."* Poll for `mcp-server.json` (a few seconds apart), then step 1 or step 2. Still missing after the creator answered: they chose **Don't allow** or the Hub is not running; ask, and do not re-request in a loop. No `<userData>` folder at all means the Creator Hub was never run on this machine.

### Step 4 — last resort: the Settings snippet

For a client that cannot read files on this machine. With the setting on, Settings > AI shows a read-only JSON snippet with **Copy configuration** and the note *"Only apps on this computer can connect. These details change each time Creator Hub restarts or this is turned off."* The AI panel's no-CLI screen (*"No CLI? Connect a tool you already use"*) offers the same snippet, or, with access off, *"To connect one, turn on “Allow other AI apps to edit your scenes” in Settings → AI."* Shape:

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

| Field | Value |
| --- | --- |
| Transport | Streamable HTTP (stateful, one session per `Mcp-Session-Id`). Not stdio: the server lives inside the running Creator Hub. |
| URL | `http://127.0.0.1:<PORT>/mcp`, port chosen at app start |
| Auth | `Authorization: Bearer <TOKEN>`; wrong, stale or revoked → `401 Unauthorized` |
| Server name | `creator-hub` (tools surface as `mcp__creator-hub__*` in Claude Code) |
| Scope | The scene currently open in the editor window |

## Client config formats

Prefer a **project-local** or session-scoped entry you can overwrite: the values rotate.

- **Claude Code**: `.mcp.json` (the snippet shape; the Hub writes it for you in the scene folder) or `claude mcp add` as in step 2 (`--header` is repeatable). "already exists" on add: `claude mcp remove creator-hub -s local` first.
- **Codex**: `[mcp_servers.creator-hub]` with `url` and `bearer_token_env_var = "CREATOR_HUB_MCP_TOKEN"`.
- **Cursor / Claude Desktop / other JSON clients**: the snippet's `mcpServers` shape (`~/.cursor/mcp.json`, `claude_desktop_config.json`, …; key names vary per client).
- **Gemini CLI**: `.gemini/settings.json` under `mcpServers` with `httpUrl` (not `url`); it expands `$VAR` in header values:

```json
{ "mcpServers": { "creator-hub": {
  "httpUrl": "http://127.0.0.1:<PORT>/mcp",
  "headers": { "Authorization": "Bearer $CREATOR_HUB_MCP_TOKEN" },
  "trust": true
} } }
```

### Inside the Creator Hub's own assistant

All four providers (Claude, Codex, Cursor, Gemini) get the scene tools with the assistant's own token, set as `CREATOR_HUB_MCP_TOKEN` on the child process: Claude via `--mcp-config`, Codex via `-c mcp_servers.creator-hub.bearer_token_env_var`, Gemini via `.gemini/settings.json` with a `$CREATOR_HUB_MCP_TOKEN` reference, Cursor via a project `.cursor/mcp.json`. Cursor's format has no token indirection, so that file holds the token literally (`0600`, gitignored). Files the Hub writes into a scene folder (`.mcp.json`, `.cursor/mcp.json`, `.gemini/settings.json`) are the Hub's: do not commit or hand-edit them.

## Settings > AI

Current strings, in case a user reads you a different one:

| Control | Note |
| --- | --- |
| **Enable AI Assistant** | Master switch for the embedded assistant, on by default. Help text: *"Runs your installed Claude, Codex, Cursor, or Gemini CLI with full access to your machine, the same reach it has in your terminal. Only enable it if you trust what you ask it to do."* |
| **Bill this to an API key instead** | Nested under the switch, off by default. Uses `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `CURSOR_API_KEY` / `GEMINI_API_KEY` from the environment rather than the signed-in subscription. |
| **Connect** (accordion) | One row per provider, status **Connected** or an amber-dot **Sign-in needed**. Only **Codex** gets in-app **Sign in** / **Sign out** buttons, and only when the Creator Hub installed it (not a Codex already on `PATH`); Claude, Cursor and Gemini sign in from a terminal. Each row's **Via Terminal** section gives the install and sign-in commands; on *Sign-in needed* a terminal-signed provider gets the re-login pair instead (a Hub-installed Codex: **Sign out**, then **Sign in**): `claude auth logout` / `claude auth login`, `codex logout` / `codex login`, `cursor-agent logout` / `cursor-agent login`, Gemini: run `gemini`, then `/auth logout`, `/auth login`. Then **Recheck** and resend the message. |
| **Allow other AI apps to edit your scenes** | Outside access, off by default, below a divider and not nested under the assistant. While on: the snippet, **Copy configuration** and the note from step 4. |

**Settings > Experimental holds only the Bevy renderer toggle.** The UI Editor is always on (see **build-ui**), gated only by the scene's SDK version.

**Out-of-date CLI warning.** The assistant refuses to use newer models behind an old CLI and shows: *"Your Claude CLI (vX) is out of date — run `claude update` in a terminal to use the latest models."* The minimum is Claude CLI **2.1.251**. The fix is `claude update` in a terminal, not anything in the Creator Hub. An unreadable version string is treated as up to date.

## Probe and failure diagnosis

```bash
curl -s -m 2 "$(node -p 'require(process.argv[1]).url' "$F")" -X POST \
  -H "Authorization: Bearer $(node -p 'require(process.argv[1]).token' "$F")" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}'
```

| Result | Meaning |
| --- | --- |
| `serverInfo` with `"name":"creator-hub"` | Up; register or reconnect your client. |
| `401 Unauthorized` | Token from an earlier Hub launch, or access was turned off (revoked) and maybe on again (new token). Re-read `mcp-server.json` and re-register; with the Hub's `.mcp.json`, reconnect (`/mcp`) so Claude Code re-reads it, and look for a local-scope `creator-hub` shadowing it (`claude mcp get creator-hub`). No `mcp-server.json`: access is off, step 3. |
| connection refused | Hub not running, or restarted on a new port. A `mcp-server.json` whose `pid` is dead is the same case. |
| Tools bind but answer `No scene is open.` | No scene is open in the editor (the creator is on the scene list or closed it). Ask them to open the scene; no reconnect needed. |
| `No editor window is open.` | A scene is bound but the Hub's main window is gone. Ask the creator to bring the Creator Hub window back (or restart it), then re-read the files. |

The probe is only for diagnosing a connection. Drive the scene through the bound MCP tools, not over curl.

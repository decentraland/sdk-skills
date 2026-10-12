# Scene Insights: Persisted Server Logs and Metrics

Read what a **deployed** Multiplayer Server scene did: its server logs and resource metrics are kept for **7 days**, across restarts and redeploys, and can be searched, followed live and charted with `sdk-commands scene-insights`. Use it to debug a deployed scene: errors, crashes and restarts, a server that stopped responding, CPU or memory growth, rate-limited logging.

`sdk-server-logs` (see `{baseDir}/references/server-patterns.md` → Production Logs) only streams the live server's recent output and loses it when the server restarts. Prefer `scene-insights` for anything that already happened.

Requires the `@dcl/sdk-commands` from the `auth-server` dist-tag that ships `scene-insights` (`npx sdk-commands scene-insights --help` prints its usage when it is available).

## Access and Signing In

The signed-in wallet must be in the deployed `scene.json` **`logsPermissions`**, or be the **World's owner or a deployer** (for Worlds). Adding an address to `logsPermissions` takes a redeploy.

The **user** signs in, once every 12 hours:

```bash
npx sdk-commands scene-insights login
```

It opens the browser to sign with their wallet and saves the session (`~/.dcl/scene-insights-session.json`). Every other subcommand reuses it without prompting.

Rules for agents:
- **Never** try to sign in yourself, ask for a private key, or read the session file: it signs Decentraland requests as the user's address until it expires. When a command exits with code **3**, ask the user to run `npx sdk-commands scene-insights login`, then retry.
- Without a terminal, `scene-insights` never opens the browser: a missing session fails at once with exit code 3 instead of hanging.
- `npx sdk-commands scene-insights session --json` checks the session without using it: exit 0 with `{address, expiration}`, or exit 3.
- Scripts and CI can set `DCL_PRIVATE_KEY` (an address with access) instead; nothing is saved.

## Choosing the Scene

Run it from the scene project to use its `scene.json` (`worldConfiguration.name`, else `scene.base`), or pass it:

```bash
--world myworld.dcl.eth             # a World (myworld also works)
--world myworld --position 10,10    # one scene of a multi-scene World
--position=-125,-96                 # a Genesis City scene (= form for negative coordinates)
```

Scenes deployed to the development network (`.zone`) need `--target https://multiplayer-scenes-insights-service.decentraland.zone`.

## Commands

Always pass `--json` and parse stdout; diagnostics go to stderr.

```bash
# Errors of the last 6 hours, newest 200 lines (printed oldest first)
npx sdk-commands scene-insights logs --from 6h --level error --limit 200 --json

# Lines containing a literal text (case-insensitive) in a time window
npx sdk-commands scene-insights logs --from 2026-10-12T14:00:00Z --to 2026-10-12T14:30:00Z --query "player joined" --json

# Lines of one server run only
npx sdk-commands scene-insights logs --execution <executionId> --from 1d --json

# Deployments and restarts of the last day
npx sdk-commands scene-insights executions --from 1d --json

# Metrics with data, then one metric's series
npx sdk-commands scene-insights metrics --json
npx sdk-commands scene-insights metrics mem.heap_used --from 2h --step 60 --json

# Follow new lines live for 30 seconds (replaying the newest 20 first)
npx sdk-commands scene-insights tail --for 30s --lines 20 --json
```

- **Never run `tail` without `--for`**: it follows until interrupted. For questions about the past use `logs`.
- `--from`/`--to` take a duration back from now (`15m`, `2h`, `7d`), epoch milliseconds, or ISO-8601 with an offset. `logs` defaults to the last hour; `metrics` (names) and `executions` to the last 24 hours. At most 7 days.
- `logs --level` is a minimum (`warn` includes `error`). `--source scene,engine` filters by origin.
- `logs` returns the newest `--limit` lines (1-10000, default 100); `--order asc` returns the oldest instead.

## Reading the Output

`logs --json` prints one document:

```json
{
  "sceneKey": "world:myworld.dcl.eth:0,0",
  "logs": [
    {
      "id": "…",
      "timestamp": "2026-10-12T14:13:32.188Z",
      "level": "error",
      "source": "scene",
      "executionId": "760471b8-…",
      "entityId": "bafkrei…",
      "message": "…",
      "truncated": false
    }
  ],
  "more": true
}
```

- `logs` is oldest first. `more: true` means more lines matched than were returned: narrow the range or filters, or raise `--limit`.
- `level`: the server's `console.log` is `info`, `console.error` is `error`. `source: engine` lines are written by the platform, not the scene.
- `truncated: true`: the line was longer than 8 KiB and was cut.
- An `engine` `warn` line **`Rate limit: dropped N log lines (M bytes) in the last Xs`** means the scene logged more than its budget (50 lines/s sustained, bursts of 500; 64 KiB/s) and those lines were **not stored**. Reduce per-frame or per-player logging; the missing lines cannot be recovered.
- An `engine` `warn` line **`Daily log quota reached (...): dropped N log lines (M bytes); logs are stored again from <time>`** means the scene used up its daily storage quota (500,000 lines or 128 MiB per UTC day by default). Nothing more is stored until the time it names (the next 00:00 UTC); it repeats at most hourly while lines keep being dropped. The live server keeps running; only what is persisted stops. Log less (aggregate repeated events, drop per-frame lines) so the important lines fit.
- `executions` lists each server run: `entityId` is the deployed version and `executionId` the process. A new `executionId` with the **same** `entityId` is a **restart** (a crash, or the server stopping when the scene emptied and starting on the next visitor); a new `entityId` is a **redeploy**. To find why a run ended, read the last lines of the previous execution with `logs --execution <id>`.
- `tail --json` prints one log entry per line, as it arrives (a few seconds after the scene writes it), and exits 0 when `--for` elapses.

### Metrics

`metrics --json` (no name) lists `{name, type, unit}`; pass a name, or its short form without `dcl.scene.`, to get its series. Every bucket of the range is a point; `null` means no data (the server was not running).

| Metric | Type | Meaning |
| --- | --- | --- |
| `cpu.run_ms` | sum | Milliseconds spent running the scene's code |
| `cpu.ticks` | sum | Frames the server ran |
| `mem.heap_used`, `mem.heap_limit` | gauge | JavaScript heap in bytes, and its limit |
| `logs.lines`, `logs.bytes` | sum | What the scene wrote to the console (before the rate limit) |
| `comms.msgs_out`, `comms.bytes_out` | sum | Messages and bytes the server sent to players |
| `crdt.bytes` | sum | Bytes of component changes the scene's code wrote |
| `fetch.started`, `fetch.completed`, `fetch.failed`, `fetch.bytes_down` | sum | HTTP requests made by the server |
| `storage.requests`, `storage.completed`, `storage.failed` | sum | Storage service calls |
| `storage.unauthorized` | sum | Storage calls refused with 401/403 (also counted as completed) |
| `ws.opened` | sum | WebSockets opened |

Gauges return `avg` and `max` per bucket; sums return `sum` (the bucket's total) and `rate` (per second). The list varies by scene and engine version: always start from `metrics --json`.

Typical reads:
- `mem.heap_used` max rising over hours toward `mem.heap_limit`: a leak (state that grows per player or per event and is never removed).
- `cpu.run_ms` rate close to 1000 ms/s: the server is saturated; look for heavy per-frame systems.
- `logs.lines` rate above 50/s: the scene is losing lines to the rate limit.
- `fetch.failed` or `storage.failed` growing: check the errors in `logs` for the same window. `storage.unauthorized` above 0: the server's storage credential was refused.

## Exit Codes

| Code | Meaning | What to do |
| --- | --- | --- |
| 0 | Success | |
| 2 | Invalid arguments | Fix the flags (the message names the bad one) |
| 3 | Sign-in needed or session refused | Ask the user to run `npx sdk-commands scene-insights login` |
| 4 | The address has no access to this scene | Use a wallet in `logsPermissions` (or the World's owner); adding one takes a redeploy |
| 5 | Scene not found | Check `--world`/`--position`, and `--target` for `.zone` deployments |
| 6 | Service unavailable | Retry later, or narrow the range if the query timed out |
| 1 | Anything else | Read the message |

With `--json`, an error is printed on stderr as `{"error":{"code","message","exitCode"}}`.

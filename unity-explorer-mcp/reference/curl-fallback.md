# Curl JSON-RPC fallback

**Open this file only after the user — told its costs first — has explicitly chosen this fallback over reconnecting via `/mcp` or restarting the Claude session, or their client cannot do Streamable HTTP.** If neither has happened yet, go back to the bind gate in `SKILL.md` Setup step 2 and ask; silence or a working probe is not a choice.

Every tool in this skill is reachable over plain HTTP, just without the schemas surfacing as native tools — and at a real cost: no inspectable screenshot images in context, no argument validation, and far more tokens per call.

## Protocol

`POST http://127.0.0.1:8123/unity-explorer-mcp` (`--mcp-port` changes the port) with both headers:

```
Content-Type: application/json
Accept: application/json, text/event-stream
```

Call `initialize` once, then `tools/call` per tool:

```bash
curl -sS -m 30 http://127.0.0.1:8123/unity-explorer-mcp -X POST \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_scene_state","arguments":{}}}'
```

## Reading responses

- Responses may be SSE-framed — lines prefixed `data:` that must be stripped and concatenated before parsing as JSON.
- Tool payloads arrive as JSON *text* in `result.content[0].text`, so they need a second parse.
- `result.isError` marks a tool-level failure; the message is in the text content block.
- Screenshots come back as base64 in an image content block — decode to a file rather than into context.

[`../scripts/screenshot.sh`](../scripts/screenshot.sh) is a working reference implementation of all four points (SSE-tolerant parse, text/image content handling, base64 to disk) — read it before hand-rolling another one, and use it directly for any capture.

## While on this path

- Re-offer `/mcp` once if the session runs long — a reconnect at any point upgrades every subsequent call.
- The readiness probe, `get_scene_state` polling, and `get_scene_logs` are cheap here. Screenshots are not: always route them through `scripts/screenshot.sh` so frames land on disk.

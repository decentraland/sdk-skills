#!/usr/bin/env bash
# Run one console line on a running dcl-one Explorer through its loopback console and print the
# reply. Needs curl and python3. The client must have been started with --automation-token.
#
#   DCL_AUTOMATION_TOKEN=<token> console.sh '/world_state'
#   console.sh --image frame.jpg '/screenshot --max-width 640 --jpg'   # the frame to disk
#   console.sh --port 15703 --timeout 120 '/walk 0 1 --seconds 5'
#
# Prints the command's output on stdout and exits 0 when the command answered ok, 1 when it
# failed (its output, a refusal or an error text, still goes to stdout), 2 on a transport or
# usage error. With --image the reply's base64 image (`image` of a JSON reply, or a raw base64
# reply) is decoded to the file and the rest of the reply (the caption) is printed.
set -euo pipefail

port="${DCL_AUTOMATION_PORT:-15702}"
token="${DCL_AUTOMATION_TOKEN:-}"
timeout=60
image=""
line=""
while [ $# -gt 0 ]; do
  case "$1" in
    --port) port="$2"; shift 2 ;;
    --token) token="$2"; shift 2 ;;
    --timeout) timeout="$2"; shift 2 ;;
    --image) image="$2"; shift 2 ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) line="$1"; shift ;;
  esac
done
if [ -z "$line" ]; then echo "console.sh: a console line is required" >&2; exit 2; fi
if [ -z "$token" ]; then echo "console.sh: set DCL_AUTOMATION_TOKEN or pass --token" >&2; exit 2; fi

url="http://127.0.0.1:${port}/"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export CONSOLE_SH_TOKEN="$token" CONSOLE_SH_LINE="$line" CONSOLE_SH_IMAGE="$image"

# rpc <method> <call id or empty>: writes the JSON-RPC result to $work/result, or fails.
rpc() {
  python3 - "$1" "${2:-}" > "$work/request" <<'PY'
import json, os, sys
method, call_id = sys.argv[1], sys.argv[2]
params = {"token": os.environ["CONSOLE_SH_TOKEN"]}
params["command" if method == "dcl/console" else "id"] = os.environ["CONSOLE_SH_LINE"] if method == "dcl/console" else int(call_id)
print(json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}))
PY
  if ! curl -sS -m 10 -X POST -H 'Content-Type: application/json' --data-binary "@$work/request" "$url" > "$work/reply"; then
    echo "console.sh: no loopback console at ${url} (start the client with --automation-token)" >&2
    return 2
  fi
  python3 - "$work/reply" "$work/result" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    reply = json.load(f)
if "error" in reply:
    print(f"console.sh: {reply['error'].get('message')} ({reply['error'].get('code')})", file=sys.stderr)
    sys.exit(2)
with open(sys.argv[2], "w") as f:
    json.dump(reply["result"], f)
PY
}

rpc 'dcl/console' || exit 2
call_id=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$work/result")

deadline=$(( $(date +%s) + timeout ))
while :; do
  rpc 'dcl/console_result' "$call_id" || exit 2
  if [ "$(python3 -c 'import json,sys; print("1" if json.load(open(sys.argv[1])).get("done") else "0")' "$work/result")" = "1" ]; then break; fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "console.sh: no reply to '${line}' within ${timeout}s (the command may still be running)" >&2
    exit 2
  fi
  sleep 0.2
done

python3 - "$work/result" <<'PY'
import base64, json, os, sys
with open(sys.argv[1]) as f:
    result = json.load(f)
image = os.environ.get("CONSOLE_SH_IMAGE", "")
output = result.get("output") or ""
ok = bool(result.get("ok"))
if image and ok:
    data = None
    try:
        parsed = json.loads(output)
        if isinstance(parsed, dict) and isinstance(parsed.get("image"), str):
            data = parsed.pop("image")
            output = json.dumps(parsed)
    except ValueError:
        data = output.strip()
        output = f"image written to {image}"
    if data:
        with open(image, "wb") as f:
            f.write(base64.b64decode(data))
print(output)
sys.exit(0 if ok else 1)
PY

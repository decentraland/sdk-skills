#!/usr/bin/env bash
# Capture Explorer screenshots to disk via the embedded MCP server, without spending agent context.
# Frames are saved as files; only the caption (resolution + parcel) is printed. Read a frame file
# only when you actually need to inspect it.
#
# A single frame is the `screenshot` tool. A burst (-n > 1) is the `capture_sequence` tool: the
# Explorer captures the frames in-process at the true interval (down to 0.05 s) and writes them
# under its own temporary cache; this script copies them into the output dir and prints the paths.
#
# Usage: screenshot.sh [options]
#   -o, --out FILE        output file (single capture; extension follows quality; relative to cwd)
#   -d, --dir DIR         output dir (default: $TMPDIR/mcp-shots, outside the scene folder; used for bursts and when -o is omitted)
#   -n, --count N         number of frames to capture (default: 1; a burst runs in chunks of 20, the tool's maximum per call)
#   -i, --interval SEC    seconds between frames in a burst (default: 0.5; min 0.05, max 2)
#   -w, --max-width PX    maxWidth passed to the tool (default: 1280; use 640 for cheap sanity checks)
#       --png             capture PNG instead of JPG
#       --world-only      exclude UI overlays (worldOnly: true)
#   -p, --port PORT       MCP server port (default: 8123)
#
# Requires: curl, python3. The Explorer must be running with --mcp.

set -euo pipefail

PORT=8123
MAX_WIDTH=1280
QUALITY=jpg
WORLD_ONLY=false
COUNT=1
INTERVAL=0.5
OUT=""
TMP_BASE="${TMPDIR:-/tmp}"
OUT_DIR="${TMP_BASE%/}/mcp-shots"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -o|--out) OUT="$2"; shift 2 ;;
        -d|--dir) OUT_DIR="$2"; shift 2 ;;
        -n|--count) COUNT="$2"; shift 2 ;;
        -i|--interval) INTERVAL="$2"; shift 2 ;;
        -w|--max-width) MAX_WIDTH="$2"; shift 2 ;;
        --png) QUALITY=png; shift ;;
        --world-only) WORLD_ONLY=true; shift ;;
        -p|--port) PORT="$2"; shift 2 ;;
        -h|--help) sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "unknown argument: $1 (see --help)" >&2; exit 2 ;;
    esac
done

capture_one() {
    local target_file="$1"

    local payload
    payload=$(printf '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"screenshot","arguments":{"maxWidth":%s,"quality":"%s","worldOnly":%s}}}' \
        "$MAX_WIDTH" "$QUALITY" "$WORLD_ONLY")

    # NOTE: response must land in a file, not a pipe into `python3 - <<heredoc`:
    # the heredoc IS python's stdin (the program), so piped data would be lost.
    local response_file
    response_file=$(mktemp)

    curl -sS --max-time 30 -X POST "http://127.0.0.1:${PORT}/unity-explorer-mcp" \
        -H 'Content-Type: application/json' \
        -H 'Accept: application/json, text/event-stream' \
        -o "$response_file" \
        -d "$payload"

    python3 - "$target_file" "$response_file" <<'PY'
import base64, json, sys

with open(sys.argv[2], encoding="utf-8") as f:
    raw = f.read()

# Tolerate SSE framing (data: lines) in case a proxy or future transport wraps the response.
try:
    response = json.loads(raw)
except json.JSONDecodeError:
    data_lines = [line[5:].strip() for line in raw.splitlines() if line.startswith("data:")]
    response = json.loads("".join(data_lines))

error = response.get("error")
if error:
    sys.exit(f"MCP error {error.get('code')}: {error.get('message')}")

result = response.get("result") or {}
image = None
caption = ""

for item in result.get("content", []):
    if item.get("type") == "image":
        image = item
    elif item.get("type") == "text":
        caption = item.get("text", "")

if result.get("isError"):
    sys.exit(f"screenshot tool error: {caption}")

if image is None:
    sys.exit("no image content in the response")

with open(sys.argv[1], "wb") as f:
    f.write(base64.b64decode(image["data"]))

print(f"{sys.argv[1]}  ({caption})")
PY
    local status=$?
    rm -f "$response_file"
    return $status
}

if [[ -n "$OUT" && "$COUNT" -eq 1 ]]; then
    mkdir -p "$(dirname "$OUT")" 2>/dev/null || true
    capture_one "$OUT"
    exit 0
fi

# Burst: one capture_sequence call per chunk of up to 20 frames. The frames land in the Explorer's
# cache; each is copied to OUT_DIR as shot-<stamp>-NNN.<ext> and its new path printed.
capture_burst() {
    local chunk="$1" first_index="$2" stamp="$3"

    local payload
    payload=$(printf '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"capture_sequence","arguments":{"count":%s,"intervalSec":%s,"maxWidth":%s,"quality":"%s","worldOnly":%s}}}' \
        "$chunk" "$INTERVAL" "$MAX_WIDTH" "$QUALITY" "$WORLD_ONLY")

    local response_file
    response_file=$(mktemp)

    # The call lasts count * interval plus the captures; 90 s covers the 20 * 2 s worst case with margin.
    curl -sS --max-time 90 -X POST "http://127.0.0.1:${PORT}/unity-explorer-mcp" \
        -H 'Content-Type: application/json' \
        -H 'Accept: application/json, text/event-stream' \
        -o "$response_file" \
        -d "$payload"

    python3 - "$OUT_DIR" "$first_index" "$stamp" "$QUALITY" "$response_file" <<'PY'
import json, shutil, sys, os

out_dir, first_index, stamp, ext, response_file = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4], sys.argv[5]

with open(response_file, encoding="utf-8") as f:
    raw = f.read()

try:
    response = json.loads(raw)
except json.JSONDecodeError:
    data_lines = [line[5:].strip() for line in raw.splitlines() if line.startswith("data:")]
    response = json.loads("".join(data_lines))

error = response.get("error")
if error:
    sys.exit(f"MCP error {error.get('code')}: {error.get('message')}")

result = response.get("result") or {}
text = next((item.get("text", "") for item in result.get("content", []) if item.get("type") == "text"), "")

if result.get("isError"):
    sys.exit(f"capture_sequence tool error: {text}")

sequence = result.get("structuredContent") or json.loads(text)

for frame in sequence.get("frames", []):
    source = frame["path"]
    target = os.path.join(out_dir, f"shot-{stamp}-{first_index + frame['index']:03d}.{ext}")
    shutil.copyfile(source, target)
    print(f"{target}  (frame {frame['index']} at t={frame['stamp']}s, {frame['width']}x{frame['height']})")

late = sequence.get("late", 0)
mean = sequence.get("meanIntervalSec")
screen = sequence.get("screen") or {}
print(f"burst: {sequence.get('count')} frames, mean interval {mean}s, {late} late (screen {screen.get('width')}x{screen.get('height')})")
PY
    local status=$?
    rm -f "$response_file"
    return $status
}

mkdir -p "$OUT_DIR"
stamp=$(date +%Y%m%d-%H%M%S)

captured=0
while (( captured < COUNT )); do
    chunk=$(( COUNT - captured ))
    (( chunk > 20 )) && chunk=20
    capture_burst "$chunk" "$(( captured + 1 ))" "$stamp"
    captured=$(( captured + chunk ))
done

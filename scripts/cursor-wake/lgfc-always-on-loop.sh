#!/usr/bin/env bash
# Single always-on 1m wake for THIS Cursor chat only.
# Runs the local GitHub poller every tick (merges + issues), then wakes.
# Stop (same routing as every other session): ~/.cursor/lgfc-wake-ctl.sh stop
set -euo pipefail
echo $$ > /tmp/lgfc-always-on-loop.pid
touch /tmp/lgfc-always-on-loop.heartbeat
REPO="${GITHUB_POLL_REPO:-wdhunter465/next-starter-template}"
CURSOR_HOME="${LGFC_CURSOR_HOME:-${HOME}/.cursor}"
POLL="${CURSOR_HOME}/github-poller/poll-github.mjs"
echo "LGFC always-on STARTED pid=$$ interval=1m poller=on $(date -u +%Y-%m-%dT%H:%M:%SZ)"

emit_tick() {
  local ts poll_json poll_err fresh events snapshot prompt idle resume nex wait
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  poll_err="$(mktemp "${TMPDIR:-/tmp}/lgfc-always-on-poll.XXXXXX")"
  poll_json="$(node "$POLL" 2>"$poll_err" || true)"
  if [[ -z "$poll_json" ]]; then
    fresh="POLL_FAIL"
    idle="unknown"
    resume="none"
    nex="none"
    wait="none"
    events="$(tr '\n' ' ' < "$poll_err" | head -c 300)"
  else
    fresh="$(printf '%s' "$poll_json" | python3 -c 'import sys,json; j=json.load(sys.stdin); print(j.get("fresh",0))')"
    idle="$(printf '%s' "$poll_json" | python3 -c 'import sys,json; j=json.load(sys.stdin); print(str(j.get("idle","")).lower() or "unknown")')"
    resume="$(printf '%s' "$poll_json" | python3 -c 'import sys,json; j=json.load(sys.stdin); items=j.get("resumeQueue") or []; print(",".join(("waiting:" if i.get("waiting") else "") + "%s:#%s" % (i.get("kind"), i.get("number")) for i in items[:12]) or "none")')"
    nex="$(printf '%s' "$poll_json" | python3 -c 'import sys,json; j=json.load(sys.stdin); n=j.get("nextExecutable") or {}; print("%s:#%s" % (n.get("kind"), n.get("number")) if n.get("number") else "none")')"
    wait="$(printf '%s' "$poll_json" | python3 -c 'import sys,json; j=json.load(sys.stdin); items=j.get("waiting") or []; print(",".join("%s:#%s" % (i.get("kind"), i.get("number")) for i in items[:8]) or "none")')"
    events="$(printf '%s' "$poll_json" | python3 -c 'import sys,json; j=json.load(sys.stdin); parts=[]; 
for e in j.get("events",[]):
    n=e.get("issueNumber") or e.get("prNumber"); parts.append("%s:#%s" % (e.get("kind"), n))
print(",".join(parts) or "none")')"
  fi
  rm -f "$poll_err"
  snapshot="$(python3 - "$REPO" <<'PY'
import json, subprocess, sys
repo = sys.argv[1]
def gh(*args):
    try:
        out = subprocess.check_output(["gh", *args], text=True, stderr=subprocess.DEVNULL)
        return json.loads(out) if out.strip() else []
    except Exception:
        return [{"error": True}]
merged = gh("pr","list","--repo",repo,"--state","merged","--limit","5","--json","number,mergedAt")
closed = gh("issue","list","--repo",repo,"--state","closed","--limit","5","--json","number,closedAt,title")
handoff = gh("issue","list","--repo",repo,"--label","agent:cursor,handoff:ready","--state","open","--limit","8","--json","number")
assigned = gh("issue","list","--repo",repo,"--assignee","wdhunter465","--state","open","--limit","8","--json","number")
ops = gh("issue","list","--repo",repo,"--label","ops:priority:1","--state","open","--limit","5","--json","number")
pmf = gh("issue","list","--repo",repo,"--label","post-merge-failure","--state","open","--limit","5","--json","number")
def nums(items, key="number"):
    if items and isinstance(items[0], dict) and items[0].get("error"):
        return "ERR"
    if key == "merged":
        return ",".join(f"#{i['number']}@{i.get('mergedAt','')}" for i in items) or "none"
    if key == "closed":
        return ",".join(f"#{i['number']}@{i.get('closedAt','')}" for i in items) or "none"
    return ",".join(f"#{i['number']}" for i in items) or "none"
print(
    "merged=" + nums(merged, "merged"),
    "closed_issues=" + nums(closed, "closed"),
    "handoff=" + nums(handoff),
    "assigned=" + nums(assigned),
    "ops_p1=" + nums(ops),
    "post_merge_failure=" + nums(pmf),
)
PY
)"
  # A tick runs the ready queue. An empty poll is not a stop.
  idle="false"
  prompt_file="${CURSOR_HOME}/lgfc-tick-prompt.txt"
  if [[ ! -f "$prompt_file" ]]; then
    prompt_file="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tick-prompt.txt"
  fi
  if [[ ! -f "$prompt_file" ]]; then
    echo "LGFC always-on missing tick prompt" >&2
    exit 1
  fi
  prompt_base="$(tr '\n' ' ' < "$prompt_file" | sed 's/[[:space:]]*$//')"
  prompt="${prompt_base} Poll fresh=${fresh} events=${events}."
  TS="$ts" PROMPT="$prompt" FRESH="$fresh" IDLE="$idle" POLL_JSON="$poll_json" python3 -c '
import json, os
raw = os.environ.get("POLL_JSON") or ""
ready = []
try:
    parsed = json.loads(raw) if raw.strip() else {}
    ready = parsed.get("readyQueue") or []
except Exception:
    ready = []
payload = {
    "ts": os.environ["TS"],
    "prompt": os.environ["PROMPT"],
    "fresh": os.environ.get("FRESH", ""),
    "idle": os.environ.get("IDLE", ""),
    "readyQueue": ready,
}
inbox = os.path.expanduser("~/.cursor/lgfc-wake-poll-inbox.json")
tmp = inbox + ".tmp"
with open(tmp, "w", encoding="utf-8") as fh:
    json.dump(payload, fh)
    fh.write("\n")
os.replace(tmp, inbox)
print("AGENT_LOOP_TICK_lgfc_always_on " + json.dumps({"ts": payload["ts"], "prompt": payload["prompt"], "fresh": payload["fresh"], "idle": payload["idle"], "readyQueue": [{"index": item.get("index"), "count": item.get("count"), "actionable": [row.get("number") for row in item.get("actionable") or []], "skipped": [row.get("number") for row in item.get("skipped") or []]} for item in ready]}))
'
}

export FRESH=""
while true; do
  sleep 60
  emit_tick
  touch /tmp/lgfc-always-on-loop.heartbeat
done

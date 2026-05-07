#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT
cd "$TMPDIR"
node "$ROOT/dist/cli.js" init
node "$ROOT/dist/cli.js" profile add sample --fixture "$ROOT/fixtures/sample-site" --out "$TMPDIR/out"
JOB_ID="$(node "$ROOT/dist/cli.js" job enqueue sample | awk '{print $3}')"
node "$ROOT/dist/cli.js" inspect sample | grep 'Home'
node "$ROOT/dist/cli.js" job next | grep "$JOB_ID"
node "$ROOT/dist/cli.js" job status "$JOB_ID" | grep queued
node "$ROOT/dist/cli.js" job pause "$JOB_ID" | grep paused
node "$ROOT/dist/cli.js" job resume "$JOB_ID" | grep queued
set +e
START_OUTPUT="$(node "$ROOT/dist/cli.js" job start "$JOB_ID" 2>&1)"
START_CODE=$?
set -e
printf '%s\n' "$START_OUTPUT" | grep "$JOB_ID"
test "$START_CODE" -eq 0
node "$ROOT/dist/cli.js" health | grep 'failed: 1'
node "$ROOT/dist/cli.js" report | grep 'processed items: 3'

#!/bin/bash
# Starts the autoposter dashboard server and worker now and at every login. launchd restarts either one if it
# crashes or is killed. The worker is kept awake by caffeinate so the Mac doesn't idle-sleep while it runs.
set -euo pipefail
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
CLAUDE="$(command -v claude)" || { echo "claude CLI not found on PATH" >&2; exit 1; }
BIN_PATH="$(dirname "$NODE"):$(dirname "$CLAUDE"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
mkdir -p "$PROJECT/logs" "$HOME/Library/LaunchAgents"

for NAME in server worker; do
  LABEL="com.autoposter.$NAME"
  TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"
  sed -e "s#__NODE__#$NODE#g" -e "s#__PROJECT__#$PROJECT#g" -e "s#__PATH__#$BIN_PATH#g" \
    "$PROJECT/launchd/$LABEL.plist" > "$TARGET"
  plutil -lint "$TARGET"
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$TARGET"
  echo "Installed $LABEL. Log: $PROJECT/logs/$NAME.log"
  launchctl print "gui/$(id -u)/$LABEL" | grep -E '^\s*(state|pid) =' || true
done

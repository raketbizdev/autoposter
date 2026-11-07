#!/bin/bash
# Stops the autoposter server and worker and removes them from login.
set -euo pipefail
for LABEL in com.autoposter.server com.autoposter.worker; do
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
done
echo "Uninstalled."

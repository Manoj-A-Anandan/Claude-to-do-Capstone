#!/usr/bin/env bash
[ -d .sdlc/logs ] && echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) session ended" >> .sdlc/logs/sessions.log
marker=".sdlc/pending-doc-sync.txt"
if [ -s "$marker" ]; then
  echo "WARNING: $(wc -l < "$marker") source file(s) changed since the last docs-sync. Run /sync-docs before opening the PR."
fi
exit 0

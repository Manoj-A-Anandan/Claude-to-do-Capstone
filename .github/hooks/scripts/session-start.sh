#!/usr/bin/env bash
mkdir -p .sdlc/logs docs user-story
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) session started" >> .sdlc/logs/sessions.log
if [ -f .sdlc/state.md ]; then
  echo "SDLC state found. $(grep -m1 '^Current stage:' .sdlc/state.md). Run /resume-sdlc to continue."
else
  echo "No SDLC state yet. Drop a user story in user-story/ and run /run-sdlc."
fi
exit 0

#!/usr/bin/env bash
# postToolUse: when source files change, mark docs as needing a docs-sync pass.
input="$(cat)"
tool="$(printf '%s' "$input" | grep -oE '"toolName"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"([^"]+)"$/\1/' | tr 'A-Z' 'a-z')"
case "$tool" in edit|create|write|str_replace_editor) ;; *) exit 0 ;; esac

path="$(printf '%s' "$input" | grep -oE '(src|scripts)(/|\\\\+)[A-Za-z0-9_./-]+' | head -1 | sed -E 's#\\+#/#g')"
[ -z "$path" ] && exit 0

mkdir -p .sdlc
marker=".sdlc/pending-doc-sync.txt"
grep -qxF "$path" "$marker" 2>/dev/null || printf '%s\n' "$path" >> "$marker"
exit 0

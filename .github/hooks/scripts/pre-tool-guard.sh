#!/usr/bin/env bash
# preToolUse guard: blocks destructive git/shell commands, .env writes, and real-looking secrets.
input="$(cat)"

deny() {
  printf '{"permissionDecision":"deny","permissionDecisionReason":"%s"}\n' "$1"
  exit 0
}

tool="$(printf '%s' "$input" | grep -oE '"toolName"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"([^"]+)"$/\1/' | tr 'A-Z' 'a-z')"

case "$tool" in
  bash|powershell|shell|execute)
    printf '%s' "$input" | grep -qE 'rm +-[a-z]*r[a-z]*f?( +|\\+")(/|~|\*)' && deny "Blocked: recursive delete of a broad path. Ask the human first."
    printf '%s' "$input" | grep -qE 'git +push[^"]*(--force|--force-with-lease| -f( |\\|"))' && deny "Blocked: force push is not allowed."
    printf '%s' "$input" | grep -qE 'git +push[^"]*[ /](main|master)( |\\|")' && deny "Blocked: pushing to main/master is not allowed. Use the feature branch and a PR."
    printf '%s' "$input" | grep -qE 'git +reset +--hard|git +clean +-[a-z]*f' && deny "Blocked: destructive git command. Ask the human first."
    printf '%s' "$input" | grep -qE 'gh +pr +merge' && deny "Blocked: merging a PR is a human action."
    ;;
  edit|create|write|str_replace_editor)
    printf '%s' "$input" | grep -qE '(path|file_path|filePath)[^,}]*[/\\"]\.env(\.(local|prod|production|dev))?(\\"|")' && deny "Blocked: do not write .env files. Use .env.example with placeholders."
    printf '%s' "$input" | grep -oE 'ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[abp]-[A-Za-z0-9-]{10,}' | grep -v 'FAKE' | grep -q . && deny "Blocked: content looks like a real secret. Use an environment variable and a placeholder."
    ;;
esac
exit 0

$ErrorActionPreference = 'Stop'
$raw = [Console]::In.ReadToEnd()

function Deny($reason) {
    @{ permissionDecision = 'deny'; permissionDecisionReason = $reason } | ConvertTo-Json -Compress
    exit 0
}

try { $evt = $raw | ConvertFrom-Json } catch { exit 0 }
$tool = "$($evt.toolName)".ToLower()
$toolArgs = $evt.toolArgs
if ($toolArgs -is [string]) { try { $toolArgs = $toolArgs | ConvertFrom-Json } catch { $toolArgs = $null } }

if ($tool -in @('bash', 'powershell', 'shell', 'execute') -and $toolArgs.command) {
    $cmd = [string]$toolArgs.command
    if ($cmd -match 'rm\s+-[a-z]*r[a-z]*f?\s+(/|~|\*|\.\s*$)|Remove-Item\s+.*-Recurse.*(\\|/)\s*$') { Deny 'Blocked: recursive delete of a broad path. Ask the human first.' }
    if ($cmd -match 'git\s+push\b.*(--force|--force-with-lease|\s-f\b)') { Deny 'Blocked: force push is not allowed.' }
    if ($cmd -match 'git\s+push\b.*\b(main|master)\b') { Deny 'Blocked: pushing to main/master is not allowed. Use the feature branch and a PR.' }
    if ($cmd -match 'git\s+reset\s+--hard|git\s+clean\s+-[a-z]*f') { Deny 'Blocked: destructive git command. Ask the human first.' }
    if ($cmd -match 'gh\s+pr\s+merge') { Deny 'Blocked: merging a PR is a human action.' }
}

if ($tool -in @('edit', 'create', 'write', 'str_replace_editor')) {
    $path = [string]($toolArgs.path, $toolArgs.file_path, $toolArgs.filePath | Where-Object { $_ } | Select-Object -First 1)
    if ($path -match '(^|[\\/])\.env($|\.(local|prod|production|dev))' -and $path -notmatch '\.example$') {
        Deny 'Blocked: do not write .env files. Use .env.example with placeholders.'
    }
    $body = ($toolArgs | ConvertTo-Json -Depth 5 -Compress)
    $secretPattern = 'ghp_(?!FAKE)[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[abp]-[A-Za-z0-9-]{10,}'
    if ($body -match $secretPattern) { Deny 'Blocked: content looks like a real secret. Use an environment variable and a placeholder.' }
}
exit 0

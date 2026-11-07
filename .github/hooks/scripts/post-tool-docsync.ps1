$raw = [Console]::In.ReadToEnd()
try { $evt = $raw | ConvertFrom-Json } catch { exit 0 }
$tool = "$($evt.toolName)".ToLower()
if ($tool -notin @('edit', 'create', 'write', 'str_replace_editor')) { exit 0 }

$toolArgs = $evt.toolArgs
$path = ''
if ($toolArgs -is [string]) {
    try { $toolArgs = $toolArgs | ConvertFrom-Json } catch { $toolArgs = $null; if ($raw -match '(?i)(src|scripts)(/|\\+)[A-Za-z0-9_./\\-]+') { $path = $Matches[0] } }
}
if ($toolArgs) { $path = [string]($toolArgs.path, $toolArgs.file_path, $toolArgs.filePath | Where-Object { $_ } | Select-Object -First 1) }

if ($path -match '(^|[\\/])(src|scripts)[\\/]') {
    New-Item -ItemType Directory -Force -Path '.sdlc' | Out-Null
    $marker = '.sdlc/pending-doc-sync.txt'
    $rel = $path -replace '\\', '/'
    if (-not (Test-Path $marker) -or -not (Select-String -Path $marker -SimpleMatch -Pattern $rel -Quiet)) {
        Add-Content -Path $marker -Value $rel
    }
}
exit 0

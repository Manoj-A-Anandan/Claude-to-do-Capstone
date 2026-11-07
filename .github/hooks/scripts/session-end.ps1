$stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
if (Test-Path '.sdlc/logs') { Add-Content -Path '.sdlc/logs/sessions.log' -Value "$stamp session ended" }
$marker = '.sdlc/pending-doc-sync.txt'
if ((Test-Path $marker) -and (Get-Item $marker).Length -gt 0) {
    $n = (Get-Content $marker | Measure-Object -Line).Lines
    Write-Output "WARNING: $n source file(s) changed since the last docs-sync. Run /sync-docs before opening the PR."
}
exit 0

New-Item -ItemType Directory -Force -Path '.sdlc/logs', 'docs', 'user-story' | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
Add-Content -Path '.sdlc/logs/sessions.log' -Value "$stamp session started"
if (Test-Path '.sdlc/state.md') {
    $line = Select-String -Path '.sdlc/state.md' -Pattern '^Current stage:' | Select-Object -First 1
    Write-Output "SDLC state found. $($line.Line). Run /resume-sdlc to continue."
} else {
    Write-Output 'No SDLC state yet. Drop a user story in user-story/ and run /run-sdlc.'
}
exit 0

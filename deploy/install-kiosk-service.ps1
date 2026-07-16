# install-kiosk-service.ps1 — ONE-TIME on the kiosk hosting box (run as Administrator).
#
# Registers Asian Super Server as an NSSM Windows service so it starts at boot
# under SYSTEM — same pattern as winfactory-server / ips-*.
# Windowless: kids never see a console over their game.
#
# Prereqs: NSSM on PATH, Node 18+ on PATH, repo cloned to $RepoRoot, .env filled.

$ErrorActionPreference = "Stop"

$RepoRoot = "C:\Apps\asian-super-server"
$Node     = (Get-Command node).Source
$Service  = "asian-super-server"
$Script   = "src\index.js"
$Logs     = Join-Path $RepoRoot "logs"

if (-not (Test-Path (Join-Path $RepoRoot ".env"))) {
  throw "Missing $RepoRoot\.env — copy .env.example and fill Discord + channel IDs first."
}

New-Item -ItemType Directory -Force -Path $Logs | Out-Null

# Recreate cleanly if it already exists.
nssm stop $Service 2>$null
nssm remove $Service confirm 2>$null

nssm install $Service $Node $Script
nssm set $Service AppDirectory $RepoRoot
nssm set $Service AppStdout (Join-Path $Logs "asian-super-server.out.log")
nssm set $Service AppStderr (Join-Path $Logs "asian-super-server.err.log")
nssm set $Service AppExit Default Restart
nssm set $Service Start SERVICE_AUTO_START

nssm start $Service
Write-Host "Service installed: $Service" -ForegroundColor Green
nssm status $Service

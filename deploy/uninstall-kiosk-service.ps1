# uninstall-kiosk-service.ps1 — remove the NSSM service (Administrator).

$ErrorActionPreference = "Stop"
$Service = "asian-super-server"

nssm stop $Service 2>$null
nssm remove $Service confirm
Write-Host "Removed $Service" -ForegroundColor Yellow

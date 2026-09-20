# Configure the TypeSafe/Jev API key using .NET User Secrets (backend-only, never committed)
$Root = Split-Path -Parent $PSScriptRoot
$Project = Join-Path $Root "src\BizzJev.Lab\BizzJev.Lab.csproj"

Write-Host ""
Write-Host "TypeSafe/Jev API Key Setup" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The key is stored in .NET User Secrets on this machine only." -ForegroundColor DarkGray
Write-Host "It is never committed to Git, never sent to the browser," -ForegroundColor DarkGray
Write-Host "and never shown in the Technical View." -ForegroundColor DarkGray
Write-Host ""

$key = Read-Host "Paste your TypeSafe API key (input is hidden)" -AsSecureString
$keyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($key))

if ([string]::IsNullOrWhiteSpace($keyPlain)) {
    Write-Host "No key entered. Aborting." -ForegroundColor Red
    exit 1
}

$json = @{ TYPESAFE_API_KEY = $keyPlain } | ConvertTo-Json -Compress
$json | dotnet user-secrets set --project $Project
Remove-Variable keyPlain

Write-Host ""
Write-Host "API key configured successfully." -ForegroundColor Green
Write-Host "Run START_DEMO.bat to start the demo." -ForegroundColor Green

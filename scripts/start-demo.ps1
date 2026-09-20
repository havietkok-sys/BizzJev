# Semantic Operations Lab - one-command demo launcher (Windows)
# Starts the backend (which also serves the pre-built frontend) and opens the browser.
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$Url = "http://localhost:5099"
$Project = Join-Path $Root "src\BizzJev.Lab\BizzJev.Lab.csproj"

Write-Host ""
Write-Host "Semantic Operations Lab" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Check .NET SDK ---
Write-Host "Checking environment..." -ForegroundColor Yellow
$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnet) {
    Write-Host "ERROR: .NET SDK not found." -ForegroundColor Red
    Write-Host ""
    Write-Host "Install .NET SDK 10.0 from: https://dotnet.microsoft.com/download/dotnet/10.0"
    Write-Host "Then run START_DEMO.bat again."
    exit 1
}
$sdkVersion = (dotnet --version 2>$null)
Write-Host "  .NET SDK $sdkVersion found." -ForegroundColor Green

# --- 2. Check API key ---
$userSecrets = dotnet user-secrets list --project $Project 2>$null
$hasKey = $userSecrets -match "TYPESAFE_API_KEY"
if (-not $hasKey) {
    Write-Host ""
    Write-Host "  API key not configured." -ForegroundColor Red
    Write-Host ""
    Write-Host "  The demo needs a TypeSafe/Jev API key to run semantic analysis."
    Write-Host "  Get a development key at: https://console.typesafe.ai/"
    Write-Host ""
    $answer = Read-Host "  Configure an API key now? (Y/n)"
    if ($answer -eq "" -or $answer -match "^[Yy]") {
        & (Join-Path $PSScriptRoot "set-api-key.ps1")
        # re-check
        $userSecrets = dotnet user-secrets list --project $Project 2>$null
        $hasKey = $userSecrets -match "TYPESAFE_API_KEY"
        if (-not $hasKey) {
            Write-Host "  API key still not configured. Cannot continue." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  Run SET_API_KEY.bat later, then START_DEMO.bat again." -ForegroundColor Yellow
        exit 1
    }
}
Write-Host "  API key configured." -ForegroundColor Green

# --- 3. Stop any existing instance on our port ---
$existing = Get-NetTCPConnection -LocalPort 5099 -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "  Stopping previous instance on port 5099..." -ForegroundColor Yellow
    $existing | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
}

# --- 4. Start backend (serves both API and pre-built frontend) ---
Write-Host ""
Write-Host "Starting backend..." -ForegroundColor Yellow
$backend = Start-Process -FilePath "dotnet" `
    -ArgumentList "run","--project",$Project,"--no-build","--","--urls",$Url `
    -WorkingDirectory $Root `
    -PassThru -WindowStyle Minimized `
    -RedirectStandardOutput (Join-Path $Root "data\lab\backend.log") `
    -RedirectStandardError (Join-Path $Root "data\lab\backend.err.log")

# --- 5. Wait for readiness ---
Write-Host "Waiting for services..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    if ($backend.HasExited) {
        Write-Host "ERROR: Backend exited unexpectedly." -ForegroundColor Red
        Write-Host "Check: data\lab\backend.log and data\lab\backend.err.log"
        exit 1
    }
}
if (-not $ready) {
    Write-Host "ERROR: Backend did not become ready within 30 seconds." -ForegroundColor Red
    Write-Host "Check: data\lab\backend.log and data\lab\backend.err.log"
    exit 1
}

Write-Host "  Backend ready." -ForegroundColor Green

# --- 6. Open browser ---
Write-Host ""
Write-Host "Ready." -ForegroundColor Green
Write-Host ""
Write-Host "Opening: $Url" -ForegroundColor Cyan
Start-Process $Url

Write-Host ""
Write-Host "The Semantic Operations Lab is now running." -ForegroundColor White
Write-Host ""
Write-Host "To stop: close this window, or press Ctrl+C." -ForegroundColor DarkGray
Write-Host "Logs:      data\lab\backend.log" -ForegroundColor DarkGray
Write-Host "Local URL: $Url" -ForegroundColor DarkGray
Write-Host ""

# Keep this window alive so the backend child process stays running
try {
    Wait-Process -Id $backend.Id
} catch {
    # Ctrl+C or window closed
}

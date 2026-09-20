# Run with Windows PowerShell: powershell -NoProfile -File scripts/test-start-demo.ps1
# Exercises the real launcher/build/server in a fresh directory containing spaces.
$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$DotnetExe = (Get-Command dotnet).Source
if (Get-NetTCPConnection -LocalPort 5099 -State Listen -ErrorAction SilentlyContinue) {
    throw "Stop the existing demo on port 5099 before running this check."
}
$TestRoot = Join-Path ([IO.Path]::GetTempPath()) ("BizzJev launcher check " + [guid]::NewGuid())
$OriginalLocation = Get-Location
$OriginalDataDir = $env:LAB_DATA_DIR
$script:TestBackend = $null
try {
    Set-Location -LiteralPath $Repo
    $files = git ls-files -- global.json scripts/start-demo.ps1 src/BizzJev.Lab
    if ($LASTEXITCODE -ne 0) { throw "Could not list source files." }
    foreach ($file in $files) {
        $destination = Join-Path $TestRoot $file
        New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $Repo $file) -Destination $destination
    }
    if (Test-Path (Join-Path $TestRoot "data")) { throw "Test must start without runtime data." }
    if (Test-Path (Join-Path $TestRoot "src/BizzJev.Lab/bin")) { throw "Test must start without build output." }
    $env:LAB_DATA_DIR = $null

    # Supply key presence without reading or writing real user secrets. No inference calls.
    function dotnet {
        if ($args[0] -eq "user-secrets") {
            $global:LASTEXITCODE = 0
            return "TYPESAFE_API_KEY = launcher-check-placeholder"
        }
        & $DotnetExe @args
    }
    # Never stop an unrelated process, even if something takes the port during this check.
    function Get-NetTCPConnection { }
    function Start-Process {
        [CmdletBinding()]
        param($FilePath, $ArgumentList, $WorkingDirectory, [switch]$PassThru,
            $WindowStyle, $RedirectStandardOutput, $RedirectStandardError)
        if ($FilePath -eq "http://localhost:5099") { return }
        $script:TestBackend = Microsoft.PowerShell.Management\Start-Process @PSBoundParameters
        return $script:TestBackend
    }
    function Wait-Process {
        param($Id)
        $health = Invoke-RestMethod http://localhost:5099/api/health
        $gates = Invoke-RestMethod http://localhost:5099/api/gates
        $page = Invoke-WebRequest http://localhost:5099 -UseBasicParsing
        if ($health.status -ne "ok" -or $gates.gates.Count -eq 0 -or $page.StatusCode -ne 200) {
            throw "Backend or frontend verification failed."
        }
        if (-not (Test-Path (Join-Path $TestRoot "data/lab/evaluations"))) {
            throw "Runtime data was not created at the repository root."
        }
        if (-not (Test-Path (Join-Path $TestRoot "data/lab/backend.err.log"))) {
            throw "Backend logs were not created."
        }
        $script:Verified = $true
    }
    . (Join-Path $TestRoot "scripts/start-demo.ps1")
    if (-not $script:Verified) { throw "Launcher did not reach verification." }
    Write-Host "PASS: fresh build, spaced path, health, gates, frontend, logs, and runtime data."
} finally {
    if ($script:TestBackend -and -not $script:TestBackend.HasExited) {
        & taskkill /PID $script:TestBackend.Id /T /F | Out-Null
    }
    $env:LAB_DATA_DIR = $OriginalDataDir
    Set-Location $OriginalLocation
    Write-Host "Test files retained at: $TestRoot"
}

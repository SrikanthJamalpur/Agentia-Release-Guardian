$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$AppDirectory = Join-Path $ProjectRoot "release-guardian"
$ReportPath = Join-Path $AppDirectory "reports\release-guardian-report.json"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " AGENTIA RELEASE GUARDIAN - DEMO RUNNER" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Running automated tests..." -ForegroundColor Yellow
Push-Location $AppDirectory
try {
    npm test
    if ($LASTEXITCODE -ne 0) {
        throw "Tests failed. Report generation was stopped."
    }

    Write-Host ""
    Write-Host "[2/3] Generating release reports..." -ForegroundColor Yellow
    npm run guardian
    if ($LASTEXITCODE -ne 0) {
        throw "Report generation failed."
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path $ReportPath)) {
    throw "Expected JSON report was not created: $ReportPath"
}

Write-Host ""
Write-Host "[3/3] Reading generated decisions..." -ForegroundColor Yellow

$Scenarios = Get-Content $ReportPath -Raw | ConvertFrom-Json

if ($Scenarios.Count -eq 0) {
    throw "The generated report contains no scenarios."
}

foreach ($Scenario in $Scenarios) {
    if (-not $Scenario.report.decision) {
        throw "Scenario '$($Scenario.name)' has no decision in the report."
    }

    $Decision = $Scenario.report.decision
    $Risk = $Scenario.report.riskScore
    $ImpactedCount = @($Scenario.report.impactedComponents).Count

    $Color = switch ($Decision) {
        "GO"    { "Green" }
        "HOLD"  { "Yellow" }
        "BLOCK" { "Red" }
        default { "White" }
    }

    Write-Host ""
    Write-Host "Scenario: $($Scenario.name)"
    Write-Host "Decision: $Decision | Risk: $Risk/100 | Impacted components: $ImpactedCount" -ForegroundColor $Color
}

Write-Host ""
Write-Host "JSON report: $ReportPath"
Write-Host "Markdown report: $(Join-Path $AppDirectory 'reports\release-guardian-report.md')"
Write-Host ""
Write-Host "Demo completed. This is local analysis, not deployment approval." -ForegroundColor Cyan

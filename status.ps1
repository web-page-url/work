# Publishing Pipeline Monitor Status Dashboard
param([switch]$Watch, [int]$Interval = 30)

function Get-PipelineStatus {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/pipeline/status" -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json
        return $data.data
    }
    catch {
        Write-Host "❌ Cannot connect to Pipeline Monitor server. Is it running?" -ForegroundColor Red
        Write-Host "Run: npm start" -ForegroundColor Yellow
        return $null
    }
}

function Show-StatusDashboard {
    param($status)

    Clear-Host
    Write-Host "🚀 PUBLISHING PIPELINE MONITOR - LIVE STATUS" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Yellow
    Write-Host ""

    $overallColor = if ($status.isHealthy) { "Green" } else { "Red" }
    $overallIcon = if ($status.isHealthy) { "✅" } else { "❌" }
    Write-Host "$overallIcon OVERALL STATUS: $($status.status)" -ForegroundColor $overallColor
    Write-Host ""

    Write-Host "📊 COMPONENT STATUS" -ForegroundColor Magenta
    Write-Host ("-" * 30) -ForegroundColor Gray

    foreach ($check in $status.checks) {
        $icon = if ($check.isHealthy) { "✅" } else { "❌" }
        $color = if ($check.isHealthy) { "Green" } else { "Red" }
        $componentName = $check.component -replace "-", " " -replace "\b\w", { $_.Value.ToUpper() }

        Write-Host "$icon $($componentName.PadRight(20)) - $($check.status)" -ForegroundColor $color
        Write-Host "  Response Time: $($check.responseTime)ms" -ForegroundColor Gray
        if ($check.error) {
            Write-Host "  Error: $($check.error)" -ForegroundColor Red
        }
        Write-Host ""
    }

    if ($status.recoverySuggestion) {
        Write-Host "🔧 RECOVERY REQUIRED" -ForegroundColor Yellow
        Write-Host ("-" * 20) -ForegroundColor Gray
        Write-Host "Component: $($status.recoverySuggestion.component)" -ForegroundColor Yellow
        Write-Host "Priority: $($status.recoverySuggestion.priority.ToUpper())" -ForegroundColor Yellow
        Write-Host "Suggestion: $($status.recoverySuggestion.suggestion)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Next Steps:" -ForegroundColor Cyan
        foreach ($step in $status.recoverySuggestion.nextSteps) {
            Write-Host "  • $step" -ForegroundColor White
        }
        Write-Host ""
    }

    Write-Host "⚙️  MONITORING INFO" -ForegroundColor Blue
    Write-Host ("-" * 18) -ForegroundColor Gray
    Write-Host "Active: $($status.monitoring.isActive)" -ForegroundColor $(if ($status.monitoring.isActive) { "Green" } else { "Red" })
    Write-Host "Auto-Recovery: $($status.monitoring.autoRecovery)" -ForegroundColor $(if ($status.monitoring.autoRecovery) { "Green" } else { "Red" })
    Write-Host "Check Interval: $($status.monitoring.checkInterval / 1000) seconds" -ForegroundColor White
    Write-Host "Last Check: $(Get-Date $status.lastChecked -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
    Write-Host ""

    Write-Host "💡 Tip: Use -Watch parameter for live monitoring" -ForegroundColor Gray
}

if ($Watch) {
    Write-Host "Starting live status monitoring... Press Ctrl+C to stop." -ForegroundColor Green
    while ($true) {
        $status = Get-PipelineStatus
        if ($status) {
            Show-StatusDashboard -status $status
        }
        Start-Sleep -Seconds $Interval
    }
} else {
    $status = Get-PipelineStatus
    if ($status) {
        Show-StatusDashboard -status $status
    }
}

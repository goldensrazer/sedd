#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Shows current SEDD feature status
.PARAMETER Branch
    Feature branch name (optional, auto-detected)
.PARAMETER Json
    Output as JSON
.EXAMPLE
    ./sedd-status.ps1
    ./sedd-status.ps1 -Json
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$Branch = "",

    [switch]$Json
)

$ErrorActionPreference = 'SilentlyContinue'

#region Config

function Get-SeddConfig {
    $configPath = Join-Path (Get-Location) 'sedd.config.json'
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath -Raw | ConvertFrom-Json -AsHashtable
            return @{ specsDir = if ($config.specsDir) { $config.specsDir } else { '.sedd' } }
        }
        catch { }
    }
    return @{ specsDir = '.sedd' }
}

function Get-CurrentBranch {
    try { return (git rev-parse --abbrev-ref HEAD 2>$null).Trim() }
    catch { return '' }
}

#endregion

#region Main

$config = Get-SeddConfig
$specsDir = $config.specsDir

if (-not $Branch) { $Branch = Get-CurrentBranch }

if (-not ($Branch -match '^\d{3}-')) {
    if ($Json) {
        Write-Output (@{ error = "Not on a feature branch"; branch = $Branch } | ConvertTo-Json -Compress)
    }
    else {
        Write-Host "Not on a feature branch (current: $Branch)" -ForegroundColor Yellow
    }
    exit 0
}

# Find feature directory
$featureDir = Join-Path (Get-Location) "$specsDir/$Branch"
if (-not (Test-Path $featureDir)) {
    $featureDir = Join-Path (Get-Location) "specs/$Branch"
}

if (-not (Test-Path $featureDir)) {
    if ($Json) {
        Write-Output (@{ error = "Feature not found"; branch = $Branch } | ConvertTo-Json -Compress)
    }
    else {
        Write-Host "Feature not found: $Branch" -ForegroundColor Red
    }
    exit 0
}

# Load meta
$metaPath = Join-Path $featureDir '_meta.json'
if (-not (Test-Path $metaPath)) {
    if ($Json) {
        Write-Output (@{ error = "No _meta.json"; branch = $Branch; legacy = $true } | ConvertTo-Json -Compress)
    }
    else {
        Write-Host "Legacy structure (no _meta.json). Run /sedd.migrate" -ForegroundColor Yellow
    }
    exit 0
}

$meta = Get-Content $metaPath -Raw | ConvertFrom-Json

# Collect pending tasks
$allPending = @()
$totalCompleted = 0
$totalTasks = 0

foreach ($migId in $meta.migrations.PSObject.Properties.Name) {
    $migInfo = $meta.migrations.$migId
    $totalTasks += $migInfo.tasksTotal
    $totalCompleted += $migInfo.tasksCompleted

    $tasksFile = Join-Path $featureDir "$($migInfo.folder)/tasks.md"
    if (Test-Path $tasksFile) {
        $content = Get-Content $tasksFile -Raw
        foreach ($line in ($content -split "`n")) {
            if ($line -match '^\s*-\s*\[\s*\]\s*(T\d{3}-\d{3})\s+(.+)') {
                $allPending += @{
                    id = $Matches[1]
                    migration = $migId
                    text = ($Matches[2] -replace '`[^`]+`', '').Trim()
                }
            }
        }
    }
}

if ($Json) {
    $output = @{
        branch = $Branch
        featureId = $meta.featureId
        featureName = $meta.featureName
        currentMigration = $meta.currentMigration
        totalMigrations = $meta.migrations.PSObject.Properties.Name.Count
        totalTasks = $totalTasks
        completedTasks = $totalCompleted
        pendingTasks = $allPending
    }
    Write-Output ($output | ConvertTo-Json -Depth 10 -Compress)
}
else {
    Write-Host "`n=== SEDD Status ===" -ForegroundColor Cyan
    Write-Host "Branch: $Branch" -ForegroundColor White
    Write-Host "Feature: $($meta.featureName) ($($meta.featureId))" -ForegroundColor White
    Write-Host "Current Migration: $($meta.currentMigration)" -ForegroundColor White
    Write-Host "Progress: $totalCompleted/$totalTasks tasks" -ForegroundColor White

    if ($allPending.Count -gt 0) {
        Write-Host "`nPending Tasks:" -ForegroundColor Yellow
        foreach ($task in ($allPending | Select-Object -First 10)) {
            $truncated = if ($task.text.Length -gt 60) { $task.text.Substring(0, 60) + '...' } else { $task.text }
            Write-Host "  - $($task.id): $truncated" -ForegroundColor White
        }
        if ($allPending.Count -gt 10) {
            Write-Host "  ... and $($allPending.Count - 10) more" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "`nAll tasks completed!" -ForegroundColor Green
    }

    Write-Host ""
}

#endregion

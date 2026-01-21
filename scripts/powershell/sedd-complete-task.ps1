#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Marks a SEDD task as completed
.PARAMETER TaskId
    Task ID to complete (e.g., "T001-001")
.PARAMETER Branch
    Feature branch name (optional, auto-detected)
.EXAMPLE
    ./sedd-complete-task.ps1 -TaskId "T001-001"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$TaskId,

    [Parameter(Mandatory = $false)]
    [string]$Branch = ""
)

$ErrorActionPreference = 'Stop'

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
    Write-Host "Error: Not on a feature branch" -ForegroundColor Red
    exit 1
}

# Parse task ID
if (-not ($TaskId -match '^T(\d{3})-(\d{3})$')) {
    Write-Host "Error: Invalid task ID format. Expected: T001-001" -ForegroundColor Red
    exit 1
}

$migId = $Matches[1]

# Find feature directory
$featureDir = Join-Path (Get-Location) "$specsDir/$Branch"
if (-not (Test-Path $featureDir)) {
    $featureDir = Join-Path (Get-Location) "specs/$Branch"
}

if (-not (Test-Path $featureDir)) {
    Write-Host "Error: Feature not found: $Branch" -ForegroundColor Red
    exit 1
}

# Load meta
$metaPath = Join-Path $featureDir '_meta.json'
if (-not (Test-Path $metaPath)) {
    Write-Host "Error: _meta.json not found" -ForegroundColor Red
    exit 1
}

$meta = Get-Content $metaPath -Raw | ConvertFrom-Json -AsHashtable

$migInfo = $meta.migrations[$migId]
if (-not $migInfo) {
    Write-Host "Error: Migration $migId not found" -ForegroundColor Red
    exit 1
}

$tasksFile = Join-Path $featureDir "$($migInfo.folder)/tasks.md"
if (-not (Test-Path $tasksFile)) {
    Write-Host "Error: tasks.md not found" -ForegroundColor Red
    exit 1
}

# Read and update task
$content = Get-Content $tasksFile -Raw
$pattern = "- \[ \] $TaskId"

if ($content -notmatch [regex]::Escape($pattern)) {
    if ($content -match "- \[x\] $TaskId") {
        Write-Host "Task $TaskId is already completed" -ForegroundColor Yellow
        exit 0
    }
    Write-Host "Error: Task $TaskId not found" -ForegroundColor Red
    exit 1
}

$newContent = $content -replace [regex]::Escape("- [ ] $TaskId"), "- [x] $TaskId"
Set-Content -Path $tasksFile -Value $newContent -Encoding UTF8

Write-Host "Completed: $TaskId" -ForegroundColor Green

# Update meta
$meta.migrations[$migId].tasksCompleted = $meta.migrations[$migId].tasksCompleted + 1

$completed = $meta.migrations[$migId].tasksCompleted
$total = $meta.migrations[$migId].tasksTotal

if ($completed -ge $total) {
    $meta.migrations[$migId].status = 'completed'
    $meta.migrations[$migId].completedAt = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    Write-Host "Migration $migId completed!" -ForegroundColor Cyan
}

Set-Content -Path $metaPath -Value ($meta | ConvertTo-Json -Depth 10) -Encoding UTF8

Write-Host "Progress: $completed/$total tasks" -ForegroundColor White

# Output JSON
$output = @{
    success = $true
    taskId = $TaskId
    migrationId = $migId
    completed = $completed
    total = $total
    migrationStatus = $meta.migrations[$migId].status
}

Write-Output "---SEDD-OUTPUT---"
Write-Output ($output | ConvertTo-Json -Compress)

#endregion

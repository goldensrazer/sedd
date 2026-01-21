#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Adds tasks to the current SEDD migration
.PARAMETER Branch
    Feature branch name (optional, auto-detected)
.PARAMETER Tasks
    JSON array of tasks to add
.PARAMETER MigrationId
    Specific migration ID (optional, uses current)
.EXAMPLE
    ./sedd-tasks.ps1 -Tasks '[{"story":"US1","description":"Implement feature"}]'
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$Branch = "",

    [Parameter(Mandatory = $false)]
    [string]$Tasks = "[]",

    [Parameter(Mandatory = $false)]
    [string]$MigrationId = ""
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

function Get-NextTaskNumber {
    param([string]$Content, [string]$MigId)

    $pattern = "T$MigId-(\d{3})"
    $matches = [regex]::Matches($Content, $pattern)

    if ($matches.Count -eq 0) { return 1 }

    $maxNum = 0
    foreach ($m in $matches) {
        $num = [int]$m.Groups[1].Value
        if ($num -gt $maxNum) { $maxNum = $num }
    }

    return $maxNum + 1
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

# Get migration
$migId = if ($MigrationId) { $MigrationId } else { $meta.currentMigration }

if (-not $migId) {
    Write-Host "Error: No current migration. Run /sedd.clarify first." -ForegroundColor Red
    exit 1
}

$migInfo = $meta.migrations[$migId]
if (-not $migInfo) {
    Write-Host "Error: Migration $migId not found" -ForegroundColor Red
    exit 1
}

$tasksFile = Join-Path $featureDir "$($migInfo.folder)/tasks.md"
if (-not (Test-Path $tasksFile)) {
    Write-Host "Error: tasks.md not found for migration $migId" -ForegroundColor Red
    exit 1
}

# Parse tasks
$taskList = @()
try {
    $taskList = $Tasks | ConvertFrom-Json
}
catch {
    Write-Host "Error: Invalid tasks JSON" -ForegroundColor Red
    exit 1
}

if ($taskList.Count -eq 0) {
    Write-Host "No tasks provided" -ForegroundColor Yellow
    exit 0
}

# Read current content
$content = Get-Content $tasksFile -Raw
$nextNum = Get-NextTaskNumber -Content $content -MigId $migId

# Build new tasks
$newTasks = @()
foreach ($task in $taskList) {
    $taskId = "T$migId-" + $nextNum.ToString().PadLeft(3, '0')
    $story = if ($task.story) { "[$($task.story)] " } else { "" }
    $line = "- [ ] $taskId ${story}$($task.description)"
    $newTasks += $line
    $nextNum++
}

# Append to file
$separator = "`n"
if (-not $content.EndsWith("`n")) { $separator = "`n`n" }

$newContent = $content + $separator + ($newTasks -join "`n") + "`n"
Set-Content -Path $tasksFile -Value $newContent -Encoding UTF8

Write-Host "Added $($taskList.Count) task(s) to migration $migId" -ForegroundColor Green

foreach ($t in $newTasks) {
    Write-Host "  $t" -ForegroundColor White
}

# Update meta
$meta.migrations[$migId].tasksTotal = $meta.migrations[$migId].tasksTotal + $taskList.Count
$meta.migrations[$migId].status = 'in-progress'
Set-Content -Path $metaPath -Value ($meta | ConvertTo-Json -Depth 10) -Encoding UTF8

# Output JSON
$output = @{
    success = $true
    migrationId = $migId
    tasksAdded = $taskList.Count
    totalTasks = $meta.migrations[$migId].tasksTotal
}

Write-Output "---SEDD-OUTPUT---"
Write-Output ($output | ConvertTo-Json -Compress)

#endregion

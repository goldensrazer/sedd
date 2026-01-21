#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Creates a new SEDD migration with clarify/tasks/decisions files
.PARAMETER Branch
    Feature branch name (e.g., "023-agent-executor")
.PARAMETER Questions
    JSON array of clarification questions
.PARAMETER Decisions
    JSON array of decisions made
.EXAMPLE
    ./sedd-clarify.ps1 -Branch "023-agent-executor"
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$Branch = "",

    [Parameter(Mandatory = $false)]
    [string]$Questions = "[]",

    [Parameter(Mandatory = $false)]
    [string]$Decisions = "[]"
)

$ErrorActionPreference = 'Stop'

#region Config

$DEFAULT_CONFIG = @{ specsDir = '.sedd' }

function Get-SeddConfig {
    $configPath = Join-Path (Get-Location) 'sedd.config.json'
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath -Raw | ConvertFrom-Json -AsHashtable
            return @{ specsDir = if ($config.specsDir) { $config.specsDir } else { '.sedd' } }
        }
        catch { }
    }
    return $DEFAULT_CONFIG
}

function Get-CurrentBranch {
    try {
        return (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
    }
    catch { return '' }
}

function Get-NextMigrationId {
    param([hashtable]$Meta)

    $ids = @($Meta.migrations.PSObject.Properties.Name | ForEach-Object { [int]$_ })
    $max = if ($ids.Count -gt 0) { ($ids | Measure-Object -Maximum).Maximum } else { 0 }
    return ($max + 1).ToString().PadLeft(3, '0')
}

#endregion

#region Main

$config = Get-SeddConfig
$specsDir = $config.specsDir

# Get branch
if (-not $Branch) {
    $Branch = Get-CurrentBranch
}

if (-not ($Branch -match '^\d{3}-')) {
    Write-Host "Error: Not on a feature branch (current: $Branch)" -ForegroundColor Red
    exit 1
}

# Find feature directory
$featureDir = Join-Path (Get-Location) "$specsDir/$Branch"
if (-not (Test-Path $featureDir)) {
    $featureDir = Join-Path (Get-Location) "specs/$Branch"
}

if (-not (Test-Path $featureDir)) {
    Write-Host "Error: Feature directory not found for branch: $Branch" -ForegroundColor Red
    exit 1
}

# Load meta
$metaPath = Join-Path $featureDir '_meta.json'
if (-not (Test-Path $metaPath)) {
    Write-Host "Error: _meta.json not found. Run /sedd.specify first." -ForegroundColor Red
    exit 1
}

$meta = Get-Content $metaPath -Raw | ConvertFrom-Json -AsHashtable

# Generate migration info
$migrationId = Get-NextMigrationId -Meta $meta
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$migrationFolder = "${migrationId}_${timestamp}"
$migrationDir = Join-Path $featureDir $migrationFolder

# Create migration directory
New-Item -ItemType Directory -Path $migrationDir -Force | Out-Null
Write-Host "Created migration: $migrationFolder" -ForegroundColor Green

# Create clarify.md
$clarifyContent = @"
# Clarification Session - Migration $migrationId

**Timestamp:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Branch:** $Branch

## Questions & Answers

<!-- Questions discussed during this clarification session -->

"@

# Parse and add questions if provided
try {
    $questionList = $Questions | ConvertFrom-Json
    if ($questionList.Count -gt 0) {
        $qNum = 1
        foreach ($q in $questionList) {
            $clarifyContent += "`n### Q$qNum`: $($q.question)`n"
            if ($q.answer) {
                $clarifyContent += "`n**Answer:** $($q.answer)`n"
            }
            $qNum++
        }
    }
}
catch { }

Set-Content -Path (Join-Path $migrationDir 'clarify.md') -Value $clarifyContent -Encoding UTF8
Write-Host "Created: clarify.md" -ForegroundColor Green

# Create decisions.md
$decisionsContent = @"
# Decisions - Migration $migrationId

**Timestamp:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
"@

try {
    $decisionList = $Decisions | ConvertFrom-Json
    $dNum = 1
    foreach ($d in $decisionList) {
        $decisionsContent += "| $dNum | $($d.decision) | $($d.rationale) |`n"
        $dNum++
    }
}
catch { }

Set-Content -Path (Join-Path $migrationDir 'decisions.md') -Value $decisionsContent -Encoding UTF8
Write-Host "Created: decisions.md" -ForegroundColor Green

# Create tasks.md
$tasksContent = @"
# Tasks - Migration $migrationId

**Migration:** $migrationId
**Timestamp:** $timestamp
**Parent:** $(if ($meta.currentMigration) { $meta.currentMigration } else { 'none' })

## Tasks

<!-- Tasks will be added here by /sedd.tasks -->
<!-- Format: - [ ] T$migrationId-001 [US1] Task description -->

"@

Set-Content -Path (Join-Path $migrationDir 'tasks.md') -Value $tasksContent -Encoding UTF8
Write-Host "Created: tasks.md" -ForegroundColor Green

# Update _meta.json
$now = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
$previousMigration = $meta.currentMigration

if (-not $meta.migrations) {
    $meta.migrations = @{}
}

$meta.migrations[$migrationId] = @{
    id = $migrationId
    timestamp = $timestamp
    folder = $migrationFolder
    parent = $previousMigration
    status = 'pending'
    tasksTotal = 0
    tasksCompleted = 0
    createdAt = $now
}
$meta.currentMigration = $migrationId

Set-Content -Path $metaPath -Value ($meta | ConvertTo-Json -Depth 10) -Encoding UTF8
Write-Host "Updated: _meta.json" -ForegroundColor Green

Write-Host "`nMigration $migrationId created successfully!" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Add questions/answers to clarify.md" -ForegroundColor White
Write-Host "  2. Document decisions in decisions.md" -ForegroundColor White
Write-Host "  3. Run /sedd.tasks to generate tasks" -ForegroundColor White

# Output JSON for Claude
$output = @{
    success = $true
    migrationId = $migrationId
    migrationFolder = $migrationFolder
    migrationDir = $migrationDir
    files = @('clarify.md', 'decisions.md', 'tasks.md')
}

Write-Output "---SEDD-OUTPUT---"
Write-Output ($output | ConvertTo-Json -Compress)

#endregion

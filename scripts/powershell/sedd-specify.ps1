#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Creates initial SEDD feature structure
.PARAMETER FeatureId
    Feature ID (e.g., "023")
.PARAMETER FeatureName
    Feature name (e.g., "agent-executor")
.PARAMETER Description
    Brief description of the feature
.EXAMPLE
    ./sedd-specify.ps1 -FeatureId "024" -FeatureName "new-feature" -Description "My new feature"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$FeatureId,

    [Parameter(Mandatory = $true)]
    [string]$FeatureName,

    [Parameter(Mandatory = $false)]
    [string]$Description = ""
)

$ErrorActionPreference = 'Stop'

#region Config

$DEFAULT_CONFIG = @{
    specsDir = '.sedd'
}

function Get-SeddConfig {
    $configPath = Join-Path (Get-Location) 'sedd.config.json'
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath -Raw | ConvertFrom-Json -AsHashtable
            return @{
                specsDir = if ($config.specsDir) { $config.specsDir } else { $DEFAULT_CONFIG.specsDir }
            }
        }
        catch { }
    }
    return $DEFAULT_CONFIG
}

#endregion

#region Main

$config = Get-SeddConfig
$specsDir = $config.specsDir
$branchName = "$FeatureId-$FeatureName"
$featureDir = Join-Path (Get-Location) "$specsDir/$branchName"

# Check if already exists
if (Test-Path $featureDir) {
    Write-Host "Feature already exists: $featureDir" -ForegroundColor Yellow
    exit 1
}

# Create directory
New-Item -ItemType Directory -Path $featureDir -Force | Out-Null
Write-Host "Created: $featureDir" -ForegroundColor Green

# Create _meta.json
$now = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
$meta = @{
    featureId = $FeatureId
    featureName = $FeatureName
    branch = $branchName
    createdAt = $now
    specCreatedAt = $now
    currentMigration = $null
    migrations = @{}
    splits = @()
    commits = @()
} | ConvertTo-Json -Depth 10

Set-Content -Path (Join-Path $featureDir '_meta.json') -Value $meta -Encoding UTF8
Write-Host "Created: _meta.json" -ForegroundColor Green

# Create spec.md
$specContent = @"
# $FeatureName

## Overview

$Description

## Goals

- [ ] Goal 1
- [ ] Goal 2

## Non-Goals

- Out of scope item 1

## User Stories

### US1: [Story Title]

**As a** [user type]
**I want** [action]
**So that** [benefit]

#### Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Technical Requirements

### Architecture

[Describe the technical approach]

### Dependencies

- Dependency 1
- Dependency 2

## UI/UX (if applicable)

[ASCII mockups or description]

## Open Questions

- [ ] Question 1?
- [ ] Question 2?
"@

Set-Content -Path (Join-Path $featureDir 'spec.md') -Value $specContent -Encoding UTF8
Write-Host "Created: spec.md" -ForegroundColor Green

# Create interfaces.ts
$interfacesContent = @"
/**
 * TypeScript interfaces for $FeatureName
 * Feature ID: $FeatureId
 *
 * Define types here FIRST, then implement with Zod schemas later.
 */

// Example interface - replace with actual types
export interface Example {
  id: string;
  name: string;
  createdAt: Date;
}

// Add your interfaces below
"@

Set-Content -Path (Join-Path $featureDir 'interfaces.ts') -Value $interfacesContent -Encoding UTF8
Write-Host "Created: interfaces.ts" -ForegroundColor Green

# Create CHANGELOG.md
$changelogContent = @"
# Changelog - $FeatureName

All notable changes to this feature will be documented in this file.

## [Unreleased]

### Added
- Initial feature specification created
"@

Set-Content -Path (Join-Path $featureDir 'CHANGELOG.md') -Value $changelogContent -Encoding UTF8
Write-Host "Created: CHANGELOG.md" -ForegroundColor Green

Write-Host "`nFeature structure created successfully!" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit spec.md with detailed requirements" -ForegroundColor White
Write-Host "  2. Define interfaces in interfaces.ts" -ForegroundColor White
Write-Host "  3. Run /sedd.clarify to start first migration" -ForegroundColor White

# Output JSON for Claude to parse
$output = @{
    success = $true
    featureDir = $featureDir
    branch = $branchName
    files = @('_meta.json', 'spec.md', 'interfaces.ts', 'CHANGELOG.md')
}

Write-Output "---SEDD-OUTPUT---"
Write-Output ($output | ConvertTo-Json -Compress)

#endregion

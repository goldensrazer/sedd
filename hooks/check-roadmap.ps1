#!/usr/bin/env pwsh
<#
.SYNOPSIS
    SEDD Assertive Hook - UserPromptSubmit
.DESCRIPTION
    Forces skill activation and tracks migration tasks
#>

$ErrorActionPreference = 'SilentlyContinue'

#region Constants

$DEFAULT_CONFIG = @{
    specsDir = '.sedd'
    hooks = @{
        assertive = $true
        skills = @('langchain-expert', 'architecture-mapper', 'defect-analyzer')
    }
}

$IGNORE_PATTERNS = @(
    '^\/\w+',
    '^\s*(oi|hi|hello|hey)\s*$',
    '^\s*(obrigado|thanks?|thx)\s*$',
    '^(sim|yes|no|não|ok|okay)\s*$',
    '^\s*\?\s*$',
    '^q\d+:',
    '^(a|b|c|d|e)\s*$',
    '^continue\s*$',
    '^prossiga\s*$'
)

$SKILLS = @{
    'langchain-expert' = @{
        triggers = @(
            'langchain', 'langgraph', 'agent', 'tool', 'graph', 'checkpoint',
            'omniagent', 'subagent', '@langchain', 'stategraph',
            'toolnode', 'basemessage', 'dynamicstructuredtool'
        )
        instruction = @"
[SKILL ACTIVATED: langchain-expert]
You MUST use the langchain-expert skill for this request.
Follow LangGraph 1.0+ patterns, check Context7 MCP for latest docs.
Key patterns: StateGraph, Annotation, ToolNode, DynamicStructuredTool, streamEvents.
"@
    }
    'architecture-mapper' = @{
        triggers = @(
            'arquitetura', 'architecture', 'estrutura', 'structure', 'mapear',
            'flow', 'fluxo', 'diagram', 'onde fica', 'where is', 'como funciona', 'how does'
        )
        instruction = @"
[SKILL ACTIVATED: architecture-mapper]
You MUST map the architecture before answering.
Use Mermaid diagrams, identify related files, trace data flow.
"@
    }
    'defect-analyzer' = @{
        triggers = @(
            'bug', 'erro', 'error', 'não funciona', 'broken', 'fail',
            'problema', 'issue', 'debug', 'crash', 'exception', 'fix'
        )
        instruction = @"
[SKILL ACTIVATED: defect-analyzer]
You MUST analyze the root cause systematically.
Check logs, trace execution path, identify failure point.
"@
    }
}

$SEDD_COMMAND_PATTERNS = @(
    @{ pattern = '(nova|new|criar|create).*(feature|funcionalidade)'; command = '/sedd.specify' }
    @{ pattern = '(clarif|duvid|question|pergunt|requisit)'; command = '/sedd.clarify' }
    @{ pattern = '(implement|execut|task|tarefa)'; command = '/sedd.implement' }
    @{ pattern = '(migra|convert|antiga|legacy)'; command = '/sedd.migrate' }
)

#endregion

#region Functions

function Get-SeddConfig {
    param([string]$Cwd)

    $configPath = Join-Path $Cwd 'sedd.config.json'
    if (-not (Test-Path $configPath)) { return $DEFAULT_CONFIG }

    try {
        $userConfig = Get-Content $configPath -Raw | ConvertFrom-Json -AsHashtable
        $merged = $DEFAULT_CONFIG.Clone()
        foreach ($key in $userConfig.Keys) {
            $merged[$key] = $userConfig[$key]
        }
        return $merged
    }
    catch {
        return $DEFAULT_CONFIG
    }
}

function Get-CurrentBranch {
    param([string]$Cwd)

    try {
        Push-Location $Cwd
        $branch = (git rev-parse --abbrev-ref HEAD 2>$null)
        Pop-Location
        return if ($branch) { $branch.Trim() } else { '' }
    }
    catch {
        return ''
    }
}

function Test-FeatureBranch {
    param([string]$Branch)
    return $Branch -match '^\d{3}-'
}

function Test-ShouldIgnorePrompt {
    param([string]$Prompt)

    foreach ($pattern in $IGNORE_PATTERNS) {
        if ($Prompt -match $pattern) { return $true }
    }
    return $false
}

function Get-ActiveSkills {
    param([string]$PromptLower)

    $active = @()
    foreach ($skillName in $SKILLS.Keys) {
        $skill = $SKILLS[$skillName]
        foreach ($trigger in $skill.triggers) {
            if ($PromptLower.Contains($trigger)) {
                $active += @{ name = $skillName; instruction = $skill.instruction }
                break
            }
        }
    }
    return $active
}

function Get-SeddCommandSuggestions {
    param([string]$PromptLower)

    $suggestions = @()
    foreach ($item in $SEDD_COMMAND_PATTERNS) {
        if ($PromptLower -match $item.pattern) {
            $suggestions += $item.command
        }
    }
    return $suggestions
}

function Get-TasksFromContent {
    param(
        [string]$Content,
        [string]$MigrationId
    )

    $pending = @()
    $completed = 0

    foreach ($line in ($Content -split "`n")) {
        if ($line -match '^\s*-\s*\[\s*\]\s*(T\d{3}-\d{3})\s+(.+)') {
            $pending += @{
                id = $Matches[1]
                migration = $MigrationId
                text = ($Matches[2] -replace '`[^`]+`', '').Trim()
            }
            continue
        }
        if ($line -match '^\s*-\s*\[x\]\s*T\d{3}-\d{3}') {
            $completed++
        }
    }

    return @{ pending = $pending; completed = $completed }
}

function Get-TasksFromMigrations {
    param(
        [string]$FeatureDir,
        [object]$MetaData
    )

    $allPending = @()
    $totalCompleted = 0

    foreach ($migId in $MetaData.migrations.PSObject.Properties.Name) {
        $migInfo = $MetaData.migrations.$migId
        $tasksFile = Join-Path $FeatureDir "$($migInfo.folder)/tasks.md"

        if (-not (Test-Path $tasksFile)) { continue }

        $content = Get-Content $tasksFile -Raw
        $result = Get-TasksFromContent -Content $content -MigrationId $migId
        $allPending += $result.pending
        $totalCompleted += $result.completed
    }

    return @{ pending = $allPending; completed = $totalCompleted }
}

function Get-TasksFromLegacy {
    param([string]$FeatureDir)

    $tasksFile = Join-Path $FeatureDir 'tasks.md'
    if (-not (Test-Path $tasksFile)) {
        return @{ pending = @(); completed = 0 }
    }

    $content = Get-Content $tasksFile -Raw
    return Get-TasksFromContent -Content $content -MigrationId $null
}

function Find-FeatureDir {
    param(
        [string]$Cwd,
        [string]$SpecsDir,
        [string]$Branch
    )

    $primaryDir = Join-Path $Cwd "$SpecsDir/$Branch"
    if (Test-Path $primaryDir) { return $primaryDir }

    $legacyDir = Join-Path $Cwd "specs/$Branch"
    if (Test-Path $legacyDir) { return $legacyDir }

    return $null
}

function Get-ExpectationSummary {
    param([object]$Expectation)

    if (-not $Expectation) { return $null }
    if ($Expectation -is [string]) { return $Expectation }
    return $Expectation.summary
}

function Get-MustNotList {
    param([object]$Expectation)

    if (-not $Expectation -or $Expectation -is [string]) { return @() }
    if ($Expectation.mustNot) { return $Expectation.mustNot } else { return @() }
}

function Build-SeddContext {
    param(
        [string]$Branch,
        [string]$CurrentMigration,
        [int]$Completed,
        [array]$Pending,
        [object]$FeatureExpectation,
        [object]$MigrationExpectation
    )

    $featureSummary = Get-ExpectationSummary -Expectation $FeatureExpectation
    $migrationSummary = Get-ExpectationSummary -Expectation $MigrationExpectation
    $mustNotList = Get-MustNotList -Expectation $MigrationExpectation
    if ($mustNotList.Count -eq 0) {
        $mustNotList = Get-MustNotList -Expectation $FeatureExpectation
    }

    if ($Pending.Count -eq 0 -and -not $featureSummary -and -not $migrationSummary) { return $null }

    $total = $Completed + $Pending.Count
    $migrationInfo = if ($CurrentMigration) { " | Migration: $CurrentMigration" } else { '' }

    # Build expectation block
    $expectationBlock = ''
    $activeExpectation = if ($migrationSummary) { $migrationSummary } else { $featureSummary }

    if ($featureSummary -and $migrationSummary -and $featureSummary -ne $migrationSummary) {
        $expectationBlock = @"

🎯 **FEATURE:** $featureSummary
📍 **MIGRATION ${CurrentMigration}:** $migrationSummary
"@
    }
    elseif ($activeExpectation) {
        $prefix = if ($migrationSummary) { "📍 M$CurrentMigration" } else { '🎯' }
        $expectationBlock = "`n$prefix **EXPECTATIVA:** $activeExpectation`n"
    }

    # Build mustNot block
    $mustNotBlock = ''
    if ($mustNotList.Count -gt 0) {
        $restrictions = ($mustNotList | ForEach-Object { "- ❌ $_" }) -join "`n"
        $mustNotBlock = @"

⛔ **NÃO DEVE:**
$restrictions
"@
    }

    if ($Pending.Count -eq 0) {
        return @"
<sedd-context>
**Branch: $Branch**$migrationInfo$expectationBlock$mustNotBlock
</sedd-context>
"@
    }

    $tasksList = ($Pending | Select-Object -First 5 | ForEach-Object {
        $text = if ($_.text.Length -gt 60) { $_.text.Substring(0, 60) + '...' } else { $_.text }
        "- $($_.id): $text"
    }) -join "`n"

    $moreText = if ($Pending.Count -gt 5) { "`n... and $($Pending.Count - 5) more" } else { '' }

    return @"
<sedd-context>
**Branch: $Branch**$migrationInfo | Progress: $Completed/$total tasks
$expectationBlock$mustNotBlock
Pending tasks:
$tasksList$moreText
</sedd-context>
"@
}

#endregion

#region Main

function Main {
    try {
        $inputJson = [Console]::In.ReadToEnd()
        if (-not $inputJson) { return }

        $inputData = $inputJson | ConvertFrom-Json
        $prompt = $inputData.prompt
        $cwd = if ($inputData.cwd) { $inputData.cwd } else { Get-Location }

        if (-not $prompt) { return }
        if (Test-ShouldIgnorePrompt -Prompt $prompt) { return }

        $config = Get-SeddConfig -Cwd $cwd
        $specsDir = if ($config.specsDir) { $config.specsDir } else { '.sedd' }
        $promptLower = $prompt.ToLower()
        $parts = @()

        # Detect and force skills
        $activeSkills = Get-ActiveSkills -PromptLower $promptLower
        if ($activeSkills.Count -gt 0) {
            $instructions = ($activeSkills | ForEach-Object { $_.instruction }) -join "`n`n"
            $parts += "<forced-skills>`n$instructions`n</forced-skills>"
        }

        # Check feature branch and tasks
        $branch = Get-CurrentBranch -Cwd $cwd
        if (Test-FeatureBranch -Branch $branch) {
            $featureDir = Find-FeatureDir -Cwd $cwd -SpecsDir $specsDir -Branch $branch

            if ($featureDir) {
                $metaFile = Join-Path $featureDir '_meta.json'
                $pending = @()
                $completed = 0
                $currentMigration = $null
                $featureExpectation = $null
                $migrationExpectation = $null

                if (Test-Path $metaFile) {
                    $metaData = Get-Content $metaFile -Raw | ConvertFrom-Json
                    $currentMigration = $metaData.currentMigration
                    $featureExpectation = $metaData.expectation

                    if ($currentMigration -and $metaData.migrations.$currentMigration.expectation) {
                        $migrationExpectation = $metaData.migrations.$currentMigration.expectation
                    }

                    $result = Get-TasksFromMigrations -FeatureDir $featureDir -MetaData $metaData
                    $pending = $result.pending
                    $completed = $result.completed
                }
                else {
                    $result = Get-TasksFromLegacy -FeatureDir $featureDir
                    $pending = $result.pending
                    $completed = $result.completed
                }

                $context = Build-SeddContext -Branch $branch -CurrentMigration $currentMigration -Completed $completed -Pending $pending -FeatureExpectation $featureExpectation -MigrationExpectation $migrationExpectation
                if ($context) { $parts += $context }
            }
        }

        # Suggest SEDD commands
        $suggestions = Get-SeddCommandSuggestions -PromptLower $promptLower
        if ($suggestions.Count -gt 0 -and -not $prompt.StartsWith('/sedd')) {
            $parts += "<sedd-hint>Consider using: $($suggestions -join ', ')</sedd-hint>"
        }

        # Output
        if ($parts.Count -gt 0) {
            $output = @{ systemMessage = "`n" + ($parts -join "`n`n") + "`n" }
            Write-Output ($output | ConvertTo-Json -Compress)
        }
    }
    catch {
        # Silent exit on errors
    }
}

Main

#endregion

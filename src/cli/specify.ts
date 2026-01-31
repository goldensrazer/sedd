import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadConfig, FeatureMeta, type SourceIssue } from '../types/index.js';
import { GitOperations } from '../utils/git.js';
import { GitHubOperations } from '../utils/github.js';
import { BoardManager } from '../core/board-manager.js';

interface SpecifyOptions {
  description?: string;
  expectation?: string;
  fromIssue?: string;
}

export async function specify(
  featureId: string,
  featureName: string,
  options: SpecifyOptions = {}
): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const gh = new GitHubOperations(cwd);
  const bm = new BoardManager(config, cwd);

  let issueData: { title: string; body: string; labels: string[]; number: number; url: string } | null = null;
  let sourceIssue: SourceIssue | undefined;

  if (options.fromIssue) {
    console.log(chalk.blue('i'), `Fetching issue from: ${options.fromIssue}`);
    const issue = gh.getIssueFromUrl(options.fromIssue);
    if (!issue) {
      console.log(chalk.red('Error: Could not fetch issue from URL'));
      process.exit(1);
    }
    issueData = issue;
    sourceIssue = {
      number: issue.number,
      url: issue.url || options.fromIssue,
      title: issue.title,
    };

    // Use issue title as feature name if the provided one is a placeholder
    if (featureName === '_' || featureName === 'from-issue') {
      featureName = issue.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
    }

    console.log(chalk.green('✓'), `Issue #${issue.number}: ${issue.title}`);
  }

  const branchName = `${featureId}-${featureName}`;

  const git = new GitOperations(cwd);
  const currentBranch = git.getCurrentBranch();

  if (!git.isFeatureBranch(currentBranch)) {
    console.log(chalk.blue('i'), `On ${currentBranch}, creating feature branch...`);
    const success = git.createBranch(branchName);
    if (!success) {
      console.log(chalk.red('Error: Could not create branch'), branchName);
      process.exit(1);
    }
    console.log(chalk.green('✓'), `Created and switched to branch: ${branchName}`);
  } else {
    console.log(chalk.blue('i'), `Already on feature branch: ${currentBranch}`);
  }
  const featureDir = join(cwd, config.specsDir, branchName);

  if (existsSync(featureDir)) {
    console.log(chalk.yellow(`Feature already exists: ${featureDir}`));
    process.exit(1);
  }

  mkdirSync(featureDir, { recursive: true });
  console.log(chalk.green('✓'), `Created: ${featureDir}`);

  if (issueData?.body) {
    issueData.body = gh.downloadIssueImages(issueData.body, featureDir);
  }

  const now = new Date().toISOString();
  const description = issueData?.body || options.description || '';
  const expectation = options.expectation || (issueData ? issueData.title : '');

  const meta: FeatureMeta = {
    featureId,
    featureName,
    branch: branchName,
    createdAt: now,
    specCreatedAt: now,
    currentMigration: null,
    migrations: {},
    splits: [],
    commits: [],
    expectation: expectation || undefined,
    sourceIssue,
  };

  writeFileSync(join(featureDir, '_meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
  console.log(chalk.green('✓'), 'Created: _meta.json');

  let acceptanceCriteria = '';
  if (issueData?.body) {
    const acMatch = issueData.body.match(/##?\s*acceptance\s*criteria[\s\S]*?(?=##|$)/i);
    if (acMatch) {
      acceptanceCriteria = acMatch[0].trim();
    }
  }

  const expectationSection = expectation
    ? `## Expectation

> ${expectation}

`
    : `## Expectation

> What do you expect as the final outcome of this feature?

[Define your expectation here]

`;

  const issueSection = sourceIssue
    ? `## Source Issue

> [#${sourceIssue.number}](${sourceIssue.url}) — ${sourceIssue.title}

`
    : '';

  const specContent = `# ${featureName}

${issueSection}## Overview

${description}

${expectationSection}## Goals

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

${acceptanceCriteria || '- [ ] Criterion 1\n- [ ] Criterion 2'}

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
`;

  writeFileSync(join(featureDir, 'spec.md'), specContent, 'utf-8');
  console.log(chalk.green('✓'), 'Created: spec.md');

  const interfacesContent = `/**
 * TypeScript interfaces for ${featureName}
 * Feature ID: ${featureId}
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
`;

  writeFileSync(join(featureDir, 'interfaces.ts'), interfacesContent, 'utf-8');
  console.log(chalk.green('✓'), 'Created: interfaces.ts');

  const changelogContent = `# Changelog - ${featureName}

All notable changes to this feature will be documented in this file.

## [Unreleased]

### Added
- Initial feature specification created
`;

  writeFileSync(join(featureDir, 'CHANGELOG.md'), changelogContent, 'utf-8');
  console.log(chalk.green('✓'), 'Created: CHANGELOG.md');

  if (sourceIssue && bm.isGitHubEnabled()) {
    const ghConfig = config.github!;

    const comment = [
      `🚀 SEDD feature ${branchName} created from this issue`,
      `Branch: ${branchName}`,
      `Spec: ${config.specsDir}/${branchName}/spec.md`,
    ].join('\n');
    gh.addIssueComment(sourceIssue.number, comment);

    if (ghConfig.project) {
      const itemId = gh.addIssueToProject(ghConfig.project.projectId, sourceIssue.url);
      if (itemId) {
        const inProgressCol = ghConfig.columnMapping['in-progress'];
        const optionId = ghConfig.columns.options[inProgressCol];
        if (optionId) {
          gh.moveItem(ghConfig.project.projectId, itemId, ghConfig.columns.fieldId, optionId);
        }

        const sourceSyncPath = join(featureDir, '.github-source-sync.json');
        writeFileSync(sourceSyncPath, JSON.stringify({ itemId, issueNumber: sourceIssue.number }, null, 2), 'utf-8');
      }
    }

    console.log(chalk.green('✓'), `Issue #${sourceIssue.number} moved to "In Progress"`);
  }

  console.log(chalk.cyan('\n✨ Feature structure created successfully!'));
  if (sourceIssue) {
    console.log(chalk.cyan(`Created from issue #${sourceIssue.number}. Run /sedd.clarify to start.`));
  } else {
    console.log(chalk.cyan('Next steps:'));
    console.log('  1. Edit spec.md with detailed requirements');
    console.log('  2. Define interfaces in interfaces.ts');
    console.log('  3. Run /sedd.clarify to start first migration');
  }
}

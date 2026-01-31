import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadConfig, getNextMigrationId, getMigrationFolder, FeatureMeta } from '../types/index.js';
import { GitOperations } from '../utils/git.js';
import { GitHubOperations } from '../utils/github.js';
import { BoardManager } from '../core/board-manager.js';
import { getSessionTimestamp, formatTimestamp } from '../core/timestamps.js';

interface ClarifyOptions {
  fromIssue?: string;
}

export async function clarify(branch?: string, options: ClarifyOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const git = new GitOperations(cwd);

  const currentBranch = branch || git.getCurrentBranch();

  if (!git.isFeatureBranch(currentBranch)) {
    console.log(chalk.red(`Error: Not on a feature branch (current: ${currentBranch})`));
    process.exit(1);
  }

  let featureDir = join(cwd, config.specsDir, currentBranch);
  if (!existsSync(featureDir)) {
    featureDir = join(cwd, 'specs', currentBranch);
  }

  if (!existsSync(featureDir)) {
    console.log(chalk.red(`Error: Feature directory not found for branch: ${currentBranch}`));
    process.exit(1);
  }

  const metaPath = join(featureDir, '_meta.json');
  if (!existsSync(metaPath)) {
    console.log(chalk.red('Error: _meta.json not found. Run /sedd.specify first.'));
    process.exit(1);
  }

  const gh = new GitHubOperations(cwd);
  const bm = new BoardManager(config, cwd);

  let issueData: { number: number; url: string; title: string; body: string; labels: string[] } | null = null;
  if (options.fromIssue) {
    console.log(chalk.blue('i'), `Fetching issue from: ${options.fromIssue}`);
    const issue = gh.getIssueFromUrl(options.fromIssue);
    if (!issue) {
      console.log(chalk.red('Error: Could not fetch issue from URL'));
      process.exit(1);
    }
    issueData = issue;
    console.log(chalk.green('✓'), `Issue #${issue.number}: ${issue.title}`);
  }

  const meta: FeatureMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));

  const migrationId = getNextMigrationId(meta);
  const timestamp = getSessionTimestamp();
  const migrationFolder = getMigrationFolder(migrationId, timestamp);
  const migrationDir = join(featureDir, migrationFolder);

  mkdirSync(migrationDir, { recursive: true });
  console.log(chalk.green('✓'), `Created migration: ${migrationFolder}`);

  if (issueData?.body) {
    issueData.body = gh.downloadIssueImages(issueData.body, migrationDir);
  }

  const dateStr = formatTimestamp();
  const previousMigration = meta.currentMigration;

  const issueContext = issueData
    ? `## Context (from GitHub Issue #${issueData.number})

${issueData.body || '(no body)'}

## Expected Outcome

> ${issueData.title}
`
    : `## Expected Outcome

> What do you expect to achieve with this migration?

[Define your expected outcome here]
`;

  const clarifyContent = `# Clarification Session - Migration ${migrationId}

**Timestamp:** ${dateStr}
**Branch:** ${currentBranch}

${issueContext}
---

## Questions & Answers

<!-- Questions discussed during this clarification session -->

### Q1: [Question]

**Answer:** [Answer]

`;

  writeFileSync(join(migrationDir, 'clarify.md'), clarifyContent, 'utf-8');
  console.log(chalk.green('✓'), 'Created: clarify.md');

  const decisionsContent = `# Decisions - Migration ${migrationId}

**Timestamp:** ${dateStr}

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | [Decision] | [Why] |

`;

  writeFileSync(join(migrationDir, 'decisions.md'), decisionsContent, 'utf-8');
  console.log(chalk.green('✓'), 'Created: decisions.md');

  const tasksContent = `# Tasks - Migration ${migrationId}

**Migration:** ${migrationId}
**Timestamp:** ${timestamp}
**Parent:** ${previousMigration || 'none'}

## Tasks

<!-- Tasks will be added here by /sedd.tasks -->
<!-- Format: - [ ] T${migrationId}-001 [US1] Task description -->

`;

  writeFileSync(join(migrationDir, 'tasks.md'), tasksContent, 'utf-8');
  console.log(chalk.green('✓'), 'Created: tasks.md');

  meta.currentMigration = migrationId;
  meta.migrations[migrationId] = {
    id: migrationId,
    timestamp,
    folder: migrationFolder,
    parent: previousMigration || undefined,
    status: 'pending',
    tasksTotal: 0,
    tasksCompleted: 0,
    createdAt: new Date().toISOString(),
  };

  writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  console.log(chalk.green('✓'), 'Updated: _meta.json');

  if (issueData && bm.isGitHubEnabled()) {
    const comment = `SEDD migration ${migrationId} started from this issue`;
    gh.addIssueComment(issueData.number, comment);
    console.log(chalk.green('✓'), `Commented on issue #${issueData.number}`);

    const syncPath = join(migrationDir, '.github-sync.json');
    bm.saveSyncMapping(syncPath, {
      lastSyncedAt: new Date().toISOString(),
      tasks: {},
    });
  }

  console.log(chalk.cyan(`\n✨ Migration ${migrationId} created successfully!`));
  if (issueData) {
    console.log(chalk.cyan(`Pre-populated from issue #${issueData.number}. Run /sedd.tasks to generate tasks.`));
  } else {
    console.log(chalk.cyan('Next steps:'));
    console.log('  1. Add questions/answers to clarify.md');
    console.log('  2. Document decisions in decisions.md');
    console.log('  3. Run /sedd.tasks to generate tasks');
  }

  console.log(chalk.gray('\n---SEDD-OUTPUT---'));
  console.log(
    JSON.stringify({
      success: true,
      migrationId,
      migrationFolder,
      migrationDir,
      files: ['clarify.md', 'decisions.md', 'tasks.md'],
      fromIssue: issueData ? issueData.number : undefined,
    })
  );
}

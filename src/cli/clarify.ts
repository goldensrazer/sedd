import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadConfig, getNextMigrationId, getMigrationFolder, FeatureMeta } from '../types/index.js';
import { GitOperations } from '../utils/git.js';
import { getSessionTimestamp, formatTimestamp } from '../core/timestamps.js';

export async function clarify(branch?: string): Promise<void> {
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

  const meta: FeatureMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));

  const migrationId = getNextMigrationId(meta);
  const timestamp = getSessionTimestamp();
  const migrationFolder = getMigrationFolder(migrationId, timestamp);
  const migrationDir = join(featureDir, migrationFolder);

  mkdirSync(migrationDir, { recursive: true });
  console.log(chalk.green('✓'), `Created migration: ${migrationFolder}`);

  const dateStr = formatTimestamp();
  const previousMigration = meta.currentMigration;

  const clarifyContent = `# Clarification Session - Migration ${migrationId}

**Timestamp:** ${dateStr}
**Branch:** ${currentBranch}

## Expected Outcome

> What do you expect to achieve with this migration?

[Define your expected outcome here]

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

  console.log(chalk.cyan(`\n✨ Migration ${migrationId} created successfully!`));
  console.log(chalk.cyan('Next steps:'));
  console.log('  1. Add questions/answers to clarify.md');
  console.log('  2. Document decisions in decisions.md');
  console.log('  3. Run /sedd.tasks to generate tasks');

  console.log(chalk.gray('\n---SEDD-OUTPUT---'));
  console.log(
    JSON.stringify({
      success: true,
      migrationId,
      migrationFolder,
      migrationDir,
      files: ['clarify.md', 'decisions.md', 'tasks.md'],
    })
  );
}

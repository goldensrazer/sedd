import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { GitOperations } from '../utils/git.js';
import { MigrationManager } from '../core/migration-manager.js';
import { BoardManager } from '../core/board-manager.js';
import { loadConfig } from '../types/index.js';

interface StatusOptions {
  json?: boolean;
}

export async function status(options: StatusOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const git = new GitOperations(cwd);
  const config = loadConfig(cwd);

  const specsDir = join(cwd, config.specsDir);

  if (!existsSync(specsDir)) {
    if (options.json) {
      console.log(JSON.stringify({ error: 'No specs directory found' }));
    } else {
      console.log(chalk.yellow(`\n⚠ No ${config.specsDir}/ directory found. Run "sedd init" first.\n`));
    }
    return;
  }

  let currentFeature: string | null = null;

  if (git.hasGit()) {
    const branch = git.getCurrentBranch();
    if (git.isFeatureBranch(branch)) {
      const featureDir = join(specsDir, branch);
      if (existsSync(featureDir)) {
        currentFeature = branch;
      }
    }
  }

  if (!currentFeature) {
    const features = readdirSync(specsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{3}-/.test(d.name))
      .map((d) => d.name)
      .sort()
      .reverse();

    if (features.length > 0) {
      currentFeature = features[0];
    }
  }

  if (!currentFeature) {
    if (options.json) {
      console.log(JSON.stringify({ error: 'No features found' }));
    } else {
      console.log(chalk.yellow('\n⚠ No features found. Use /sedd.specify to create one.\n'));
    }
    return;
  }

  const featureDir = join(specsDir, currentFeature);
  const mm = new MigrationManager(featureDir);
  const meta = mm.loadMeta();

  if (options.json) {
    if (meta) {
      const status = {
        featureId: meta.featureId,
        featureName: meta.featureName,
        branch: meta.branch,
        currentMigration: meta.currentMigration,
        migrations: meta.migrations,
        commits: meta.commits.slice(-5),
      };
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.log(
        JSON.stringify({
          feature: currentFeature,
          status: 'legacy',
          message: 'Uses old structure, needs migration',
        })
      );
    }
    return;
  }

  console.log(chalk.blue(`\n📊 Feature Status: ${currentFeature}\n`));

  if (!meta) {
    console.log(chalk.yellow('⚠ This feature uses the old structure.'));
    console.log(chalk.gray(`  Run: sedd migrate ${currentFeature}`));
    console.log();
    return;
  }

  console.log(chalk.gray('Feature ID:'), meta.featureId);
  console.log(chalk.gray('Feature Name:'), meta.featureName);
  console.log(chalk.gray('Branch:'), meta.branch);
  console.log(chalk.gray('Current Migration:'), chalk.cyan(meta.currentMigration || 'none'));
  console.log();

  // Show migrations
  const migrations = Object.values(meta.migrations);
  if (migrations.length > 0) {
    console.log(chalk.gray('Migrations:'));
    for (const mig of migrations) {
      let icon = '○';
      let color = chalk.gray;

      if (mig.status === 'completed') {
        icon = '●';
        color = chalk.green;
      } else if (mig.status === 'in-progress') {
        icon = '◐';
        color = chalk.cyan;
      }

      const progress = `${mig.tasksCompleted}/${mig.tasksTotal}`;
      console.log(`  ${color(icon)} ${mig.id} (${mig.timestamp}) - ${progress} tasks`);
    }
    console.log();
  }

  // Show recent commits
  if (meta.commits.length > 0) {
    console.log(chalk.gray('Recent Commits:'));
    const recentCommits = meta.commits.slice(-3);
    for (const commit of recentCommits) {
      console.log(chalk.gray(`  ${commit.hash}`), commit.message);
    }
    console.log();
  }

  // Show board summary
  const bm = new BoardManager(config, cwd);
  const boardStatus = bm.getBoard(featureDir, meta);
  if (boardStatus) {
    const colSummary = boardStatus.columns
      .map(c => `${c.tasks.length} ${c.name}`)
      .join(' | ');
    console.log(chalk.gray('Board:'), colSummary);

    const violations = bm.checkWipLimits(boardStatus);
    if (violations.length > 0) {
      for (const v of violations) {
        console.log(chalk.yellow(`WIP: "${v.column}" ${v.current}/${v.limit}`));
      }
    } else {
      console.log(chalk.gray('WIP:'), 'OK');
    }

    const suggestions = bm.suggestNext(boardStatus);
    if (suggestions.length > 0) {
      const top = suggestions[0];
      console.log(chalk.cyan(`Next: ${top.taskId} "${top.description}" (${top.reason})`));
    }
    console.log();
  }

  // Show source issue if present
  if (meta.sourceIssue) {
    console.log(chalk.gray('Source Issue:'), `#${meta.sourceIssue.number} ${meta.sourceIssue.title}`);
    console.log(chalk.gray('  URL:'), meta.sourceIssue.url);
    console.log();
  }
}

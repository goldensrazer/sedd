import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadConfig, type FeatureMeta, type BoardStatus } from '../types/index.js';
import { GitOperations } from '../utils/git.js';
import { BoardManager } from '../core/board-manager.js';

interface BoardOptions {
  all?: boolean;
  json?: boolean;
  move?: string;
  sync?: boolean;
}

export async function board(options: BoardOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const git = new GitOperations(cwd);
  const bm = new BoardManager(config, cwd);

  const specsDir = join(cwd, config.specsDir);

  if (!existsSync(specsDir)) {
    console.log(chalk.yellow('No specs directory found. Run "sedd init" first.'));
    return;
  }

  if (options.move) {
    const args = process.argv;
    const moveIdx = args.indexOf('--move');
    const taskId = args[moveIdx + 1];
    const targetColumn = args[moveIdx + 2];

    if (!taskId || !targetColumn) {
      console.log(chalk.red('Usage: sedd board --move <task-id> "<column>"'));
      return;
    }

    const { featureDir, meta } = getFeatureContext(cwd, config, git);
    if (!featureDir || !meta) return;

    const success = bm.moveTask(featureDir, meta, taskId, targetColumn);
    if (!success) {
      console.log(chalk.red(`Failed to move ${taskId}`));
      return;
    }

    console.log(chalk.green(`✓ Moved ${taskId} to "${targetColumn}"`));

    if (bm.isGitHubEnabled()) {
      const autoSync = config.github?.autoSync || 'ask';

      if (autoSync === 'off') return;

      if (autoSync === 'ask') {
        const { shouldSync } = await inquirer.prompt([{
          type: 'confirm',
          name: 'shouldSync',
          message: 'Sync this change to GitHub?',
          default: true,
        }]);
        if (!shouldSync) return;
      }

      const result = bm.syncToGitHub(featureDir, meta);
      if (result.moved > 0 || result.synced > 0) {
        console.log(chalk.green(`✓ Synced to GitHub`));
      }
    }
    return;
  }

  if (options.sync) {
    const { featureDir, meta } = getFeatureContext(cwd, config, git);
    if (!featureDir || !meta) return;

    if (!bm.isGitHubEnabled()) {
      console.log(chalk.yellow('GitHub sync not enabled. Run "sedd github setup" first.'));
      return;
    }

    console.log(chalk.cyan('Syncing board with GitHub...'));
    const result = bm.syncToGitHub(featureDir, meta);
    console.log(chalk.green(`✓ Synced: ${result.synced} | Created: ${result.created} | Moved: ${result.moved}`));
    if (result.errors.length > 0) {
      result.errors.forEach(e => console.log(chalk.yellow(`  ⚠ ${e}`)));
    }
    return;
  }

  if (options.all) {
    showAllBoards(cwd, config, bm, options.json);
  } else {
    const { featureDir, meta } = getFeatureContext(cwd, config, git);
    if (!featureDir || !meta) return;

    const boardStatus = bm.getBoard(featureDir, meta);
    if (!boardStatus) {
      console.log(chalk.yellow('No active migration with tasks. Run "sedd clarify" then "sedd tasks" first.'));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(boardStatus, null, 2));
      return;
    }

    renderBoard(boardStatus, bm, config);
  }
}

function getFeatureContext(cwd: string, config: any, git: GitOperations): { featureDir: string | null; meta: FeatureMeta | null } {
  const specsDir = join(cwd, config.specsDir);

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
      .filter(d => d.isDirectory() && /^\d{3}-/.test(d.name))
      .map(d => d.name)
      .sort()
      .reverse();

    if (features.length > 0) {
      currentFeature = features[0];
    }
  }

  if (!currentFeature) {
    console.log(chalk.yellow('No features found.'));
    return { featureDir: null, meta: null };
  }

  const featureDir = join(specsDir, currentFeature);
  const metaPath = join(featureDir, '_meta.json');

  if (!existsSync(metaPath)) {
    console.log(chalk.yellow(`No _meta.json for feature ${currentFeature}`));
    return { featureDir: null, meta: null };
  }

  const meta: FeatureMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  return { featureDir, meta };
}

function showAllBoards(cwd: string, config: any, bm: BoardManager, json?: boolean): void {
  const specsDir = join(cwd, config.specsDir);
  const features = readdirSync(specsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{3}-/.test(d.name))
    .map(d => d.name)
    .sort();

  if (features.length === 0) {
    console.log(chalk.yellow('No features found.'));
    return;
  }

  const allBoards: BoardStatus[] = [];

  for (const feature of features) {
    const featureDir = join(specsDir, feature);
    const metaPath = join(featureDir, '_meta.json');
    if (!existsSync(metaPath)) continue;

    const meta: FeatureMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    const boardStatus = bm.getBoard(featureDir, meta);
    if (boardStatus) {
      allBoards.push(boardStatus);
    }
  }

  if (json) {
    console.log(JSON.stringify(allBoards, null, 2));
    return;
  }

  if (allBoards.length === 0) {
    console.log(chalk.yellow('No active boards found.'));
    return;
  }

  for (const boardStatus of allBoards) {
    renderBoard(boardStatus, bm, config);
    console.log('');
  }
}

function renderBoard(boardStatus: BoardStatus, bm: BoardManager, config: any): void {
  console.log(chalk.cyan.bold(`\nKanban: ${boardStatus.featureName} (Migration ${boardStatus.migrationId})\n`));

  const colWidth = 22;

  const headers = boardStatus.columns.map(col => {
    const countStr = col.wipLimit
      ? `[${col.tasks.length}/${col.wipLimit}]`
      : `[${col.tasks.length}]`;
    const header = `${col.name} ${countStr}`;
    return header.padEnd(colWidth);
  });
  console.log(chalk.bold(headers.join(' ')));

  const separators = boardStatus.columns.map(() => '─'.repeat(colWidth));
  console.log(chalk.gray(separators.join(' ')));

  const maxRows = Math.max(...boardStatus.columns.map(c => c.tasks.length));
  for (let i = 0; i < maxRows; i++) {
    const cells = boardStatus.columns.map(col => {
      const task = col.tasks[i];
      if (!task) return ' '.repeat(colWidth);

      const text = `${task.id} ${truncate(task.description, colWidth - task.id.length - 2)}`;
      return text.padEnd(colWidth);
    });
    console.log(cells.join(' '));
  }

  if (maxRows === 0) {
    console.log(chalk.gray('  (no tasks)'));
  }

  const violations = bm.checkWipLimits(boardStatus);
  if (violations.length > 0) {
    console.log('');
    for (const v of violations) {
      console.log(chalk.red(`⚠ WIP: "${v.column}" has ${v.current}/${v.limit} items`));
    }
  } else {
    console.log(chalk.gray('\nWIP: OK'));
  }

  const suggestions = bm.suggestNext(boardStatus);
  if (suggestions.length > 0) {
    const top = suggestions[0];
    console.log(chalk.cyan(`Next: ${top.taskId} "${truncate(top.description, 40)}" (${top.reason})`));
  }
}

function truncate(str: string, maxLen: number): string {
  const clean = str.replace(/\[[\w-]+\]\s*/g, '');
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen - 3) + '...';
}

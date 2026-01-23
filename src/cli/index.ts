#!/usr/bin/env node

/**
 * SEDD CLI - Spec & Expectation Driven Development
 *
 * Main entry point for the CLI.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

// Commands
import { init } from './init.js';
import { check } from './check.js';
import { status } from './status.js';
import { migrate } from './migrate.js';
import { specify } from './specify.js';
import { clarify } from './clarify.js';
import { addTasks, completeTask } from './tasks.js';
import { update } from './update.js';
import { estimate } from './estimate.js';
import { validate } from './validate.js';
import { checkForUpdates, showUpdateNotification, getInstalledVersion } from './version-check.js';

const SEDD_DIR = '.sedd';

interface FeatureInfo {
  id: string;
  name: string;
  hasSpec: boolean;
  migrations: number;
}

function getFeatures(seddPath: string): FeatureInfo[] {
  if (!existsSync(seddPath)) return [];
  const features: FeatureInfo[] = [];

  try {
    const items = readdirSync(seddPath, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory() && /^\d{3}-/.test(item.name)) {
        const featurePath = join(seddPath, item.name);
        const parts = item.name.split('-');
        const id = parts[0];
        const name = parts.slice(1).join('-');

        let migrations = 0;
        try {
          const contents = readdirSync(featurePath, { withFileTypes: true });
          migrations = contents.filter(c => c.isDirectory() && /^M\d{3}$/.test(c.name)).length;
        } catch {}

        features.push({
          id,
          name,
          hasSpec: existsSync(join(featurePath, 'spec.md')),
          migrations,
        });
      }
    }
  } catch {}

  return features.sort((a, b) => a.id.localeCompare(b.id));
}

function showWelcome(): void {
  const seddPath = join(process.cwd(), SEDD_DIR);
  const hasSedd = existsSync(seddPath);
  const features = hasSedd ? getFeatures(seddPath) : [];

  let projectName = basename(process.cwd());
  const pkgPath = join(process.cwd(), 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      projectName = pkg.name || projectName;
    } catch {}
  }

  console.log(chalk.cyan.bold(`
  SEDD - Spec & Expectation Driven Development
  Use with Claude Code, Cursor, Copilot, or any LLM
`));

  if (!hasSedd) {
    console.log(chalk.yellow(`  No SEDD project found in: ${process.cwd()}`));
    console.log(chalk.white(`  Run ${chalk.cyan('sedd init')} to initialize.\n`));
  } else {
    console.log(chalk.green(`  Project: ${chalk.bold.white(projectName)}`));

    if (features.length === 0) {
      console.log(chalk.yellow(`  No features yet.`));
      console.log(chalk.white(`  Create one: ${chalk.cyan('sedd specify 001 my-feature')}\n`));
    } else {
      console.log(chalk.white(`  Features (${features.length}):`));
      for (const f of features.slice(0, 5)) {
        const dot = f.hasSpec ? chalk.green('●') : chalk.red('○');
        const mig = f.migrations > 0 ? chalk.gray(` [${f.migrations}]`) : '';
        console.log(`    ${dot} ${chalk.cyan(f.id)} ${f.name}${mig}`);
      }
      if (features.length > 5) {
        console.log(chalk.gray(`    ... +${features.length - 5} more`));
      }
      console.log('');
    }
  }

  console.log(chalk.bold('  Workflow:'));
  console.log(`
    1. ${chalk.cyan('sedd init')}                  Initialize SEDD
    2. ${chalk.cyan('sedd specify 001 feature')}   Create feature spec
    3. Edit ${chalk.yellow('.sedd/001-feature/spec.md')}
    4. Run ${chalk.cyan('claude')} or your LLM     Implement the spec
    5. ${chalk.cyan('sedd clarify')}               Document decisions
`);

  console.log(chalk.bold('  Commands:'));
  console.log(`
    ${chalk.cyan('sedd init')}                  Initialize SEDD in project
    ${chalk.cyan('sedd specify <id> <name>')}   Create new feature spec
    ${chalk.cyan('sedd clarify')}               Create clarify/tasks/decisions
    ${chalk.cyan('sedd status')}                Show project status
    ${chalk.cyan('sedd update')}                Update templates/commands/hooks
    ${chalk.cyan('sedd --help')}                Show all commands
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const program = new Command();

  program
    .name('sedd')
    .description('SEDD - Spec & Expectation Driven Development')
    .version(getInstalledVersion());

  // Non-blocking version check before any command
  program.hook('preAction', async () => {
    const versionInfo = await checkForUpdates();
    if (versionInfo?.needsUpdate) {
      showUpdateNotification(versionInfo);
    }
  });

  program
    .command('init')
    .description('Initialize SEDD in current project')
    .argument('[project-name]', 'Project name (auto-detected from package.json)')
    .option('--no-git', 'Skip git integration')
    .option('--no-gitignore', 'Skip .gitignore updates')
    .option('--legacy', 'Use specs/ folder instead of .sedd/')
    .option('-f, --force', 'Force update existing files')
    .action(init);

  program
    .command('check')
    .description('Check SEDD structure and prerequisites')
    .option('-f, --fix', 'Attempt to fix issues')
    .action(check);

  program
    .command('status')
    .description('Show current feature status')
    .option('-j, --json', 'Output as JSON')
    .action(status);

  program
    .command('migrate')
    .description('Migrate existing specs to new structure')
    .argument('[feature-dir]', 'Feature directory to migrate')
    .option('-a, --all', 'Migrate all features')
    .option('-d, --dry-run', 'Show what would be done')
    .action(migrate);

  program
    .command('specify')
    .description('Create a new feature specification')
    .argument('<feature-id>', 'Feature ID (e.g., "001")')
    .argument('<feature-name>', 'Feature name (e.g., "user-auth")')
    .option('-d, --description <desc>', 'Brief description')
    .option('-e, --expectation <exp>', 'Expected outcome')
    .action(specify);

  program
    .command('clarify')
    .description('Create new migration with clarify/tasks/decisions')
    .argument('[branch]', 'Feature branch (auto-detected)')
    .action(clarify);

  program
    .command('tasks')
    .description('Add tasks to current migration')
    .argument('<tasks-json>', 'JSON array of tasks')
    .option('-m, --migration <id>', 'Specific migration ID')
    .action(addTasks);

  program
    .command('complete')
    .description('Mark a task as completed')
    .argument('<task-id>', 'Task ID (e.g., "T001-001")')
    .action(completeTask);

  program
    .command('update')
    .description('Update SEDD templates, commands, hooks and scripts')
    .option('-f, --force', 'Skip confirmation prompt')
    .option('-b, --backup', 'Create backup before updating')
    .action(update);

  program
    .command('estimate')
    .description('Generate effort estimation for current feature')
    .option('-p, --path <path>', 'File path to investigate')
    .option('-d, --description <desc>', 'Feature description to estimate')
    .option('-j, --json', 'Output as JSON')
    .action(estimate);

  program
    .command('validate')
    .description('Validate implementation against expectation')
    .option('-m, --migration <id>', 'Specific migration ID to validate')
    .option('-a, --auto', 'Auto-create tasks for gaps')
    .option('--full-diff', 'Show full git diff')
    .option('-j, --json', 'Output as JSON')
    .action(validate);

  // No arguments - show welcome
  if (args.length === 0) {
    showWelcome();
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
});

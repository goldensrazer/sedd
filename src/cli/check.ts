import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { GitOperations } from '../utils/git.js';
import { MigrationManager } from '../core/migration-manager.js';
import { loadConfig } from '../types/index.js';

interface CheckOptions {
  fix?: boolean;
}

interface CheckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export async function check(options: CheckOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const git = new GitOperations(cwd);
  const config = loadConfig(cwd);

  console.log(chalk.blue('\n🔍 Checking SEDD structure...\n'));

  const result: CheckResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check config file
  const configPath = join(cwd, 'sedd.config.json');
  if (existsSync(configPath)) {
    console.log(chalk.green('✓'), 'sedd.config.json exists');
  } else {
    result.warnings.push('sedd.config.json not found. Using defaults.');
    console.log(chalk.yellow('⚠'), 'sedd.config.json not found (using defaults)');
  }

  // Check specs directory
  const specsDir = join(cwd, config.specsDir);
  if (!existsSync(specsDir)) {
    result.warnings.push(`${config.specsDir}/ directory not found. No features created yet.`);
    console.log(chalk.yellow('⚠'), `${config.specsDir}/ not found`);
  } else {
    console.log(chalk.green('✓'), `${config.specsDir}/ directory exists`);

    const features = readdirSync(specsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const feature of features) {
      const featureDir = join(specsDir, feature);
      const metaPath = join(featureDir, '_meta.json');

      if (existsSync(metaPath)) {
        console.log(chalk.green('✓'), `${feature}/ has valid _meta.json`);

        const mm = new MigrationManager(featureDir);
        const meta = mm.loadMeta();

        if (meta) {
          const migrations = Object.keys(meta.migrations).length;
          const current = meta.currentMigration || 'none';
          console.log(
            chalk.gray('  └'),
            `Migrations: ${migrations}, Current: ${current}`
          );
        }
      } else {
        const hasOldStructure =
          existsSync(join(featureDir, 'spec.md')) || existsSync(join(featureDir, 'tasks.md'));

        if (hasOldStructure) {
          result.warnings.push(
            `${feature}/ uses old structure. Run "sedd migrate ${feature}" to upgrade.`
          );
          console.log(chalk.yellow('⚠'), `${feature}/ needs migration`);
        } else {
          result.warnings.push(`${feature}/ has no _meta.json`);
          console.log(chalk.yellow('⚠'), `${feature}/ missing _meta.json`);
        }
      }
    }
  }

  // Check .claude directory
  const claudeDir = join(cwd, '.claude');
  const commandsDir = join(claudeDir, 'commands');
  const hooksDir = join(claudeDir, 'hooks');

  if (!existsSync(commandsDir)) {
    result.warnings.push('.claude/commands/ not found. Run "sedd init" to install commands.');
  } else {
    const requiredCommands = [
      'sedd.specify.md',
      'sedd.clarify.md',
      'sedd.implement.md',
    ];

    for (const cmd of requiredCommands) {
      const cmdPath = join(commandsDir, cmd);
      if (existsSync(cmdPath)) {
        console.log(chalk.green('✓'), `Command: ${cmd}`);
      } else {
        result.warnings.push(`Missing command: ${cmd}`);
        console.log(chalk.yellow('⚠'), `Missing: ${cmd}`);
      }
    }
  }

  if (!existsSync(hooksDir)) {
    result.warnings.push('.claude/hooks/ not found. Run "sedd init" to install hooks.');
  } else {
    const hookFiles = ['check-roadmap.js', 'check-roadmap.ps1'];
    for (const hook of hookFiles) {
      const hookPath = join(hooksDir, hook);
      if (existsSync(hookPath)) {
        console.log(chalk.green('✓'), `Hook: ${hook}`);
      }
    }
  }

  // Check git branch
  if (git.hasGit()) {
    const branch = git.getCurrentBranch();
    if (git.isFeatureBranch(branch)) {
      console.log(chalk.green('✓'), `On feature branch: ${branch}`);
    } else {
      result.warnings.push(`Not on a feature branch (current: ${branch})`);
      console.log(chalk.yellow('⚠'), `Not on feature branch: ${branch}`);
    }
  }

  console.log();

  if (result.errors.length > 0) {
    console.log(chalk.red('Errors:'));
    for (const error of result.errors) {
      console.log(chalk.red('  ✗'), error);
    }
  }

  if (result.warnings.length > 0) {
    console.log(chalk.yellow('Warnings:'));
    for (const warning of result.warnings) {
      console.log(chalk.yellow('  ⚠'), warning);
    }
  }

  if (result.valid && result.warnings.length === 0) {
    console.log(chalk.green('✨ All checks passed!\n'));
  } else if (result.valid) {
    console.log(chalk.yellow('\n⚠ Some warnings found, but structure is valid.\n'));
  } else {
    console.log(chalk.red('\n✗ Structure is invalid. Please fix errors.\n'));
    process.exit(1);
  }
}

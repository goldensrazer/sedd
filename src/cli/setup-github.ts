import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadConfig, type SeddConfig, type GitHubConfig, type OwnerChoice, type GitHubOrganization } from '../types/index.js';
import { GitHubOperations } from '../utils/github.js';

function saveConfig(cwd: string, config: SeddConfig): void {
  const configPath = join(cwd, 'sedd.config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export async function githubSetup(): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const gh = new GitHubOperations(cwd);

  console.log(chalk.cyan.bold('\nSEDD GitHub Integration Setup'));
  console.log(chalk.gray('━'.repeat(36)));

  console.log(chalk.white('\nStep 1/7: Checking GitHub CLI...'));
  if (!gh.hasGh()) {
    console.log(chalk.red('  ✗ gh CLI not found'));
    console.log(chalk.yellow('  Install it:'));
    console.log(chalk.gray('    Windows: winget install GitHub.cli'));
    console.log(chalk.gray('    Mac:     brew install gh'));
    console.log(chalk.gray('    Linux:   sudo apt install gh'));
    process.exit(1);
  }
  const version = gh.getGhVersion();
  console.log(chalk.green(`  ✓ gh v${version} found`));

  console.log(chalk.white('\nStep 2/7: Checking authentication...'));
  if (!gh.isAuthenticated()) {
    console.log(chalk.red('  ✗ Not authenticated'));

    const { runLogin } = await inquirer.prompt([{
      type: 'confirm',
      name: 'runLogin',
      message: 'Run "gh auth login" now?',
      default: true,
    }]);

    if (!runLogin) {
      console.log(chalk.yellow('  Run manually: gh auth login'));
      process.exit(1);
    }

    console.log(chalk.cyan('\n  Starting gh auth login...'));
    console.log(chalk.gray('  Select: GitHub.com > HTTPS > Login with a web browser'));
    console.log(chalk.gray('  Copy the code from the terminal and paste it in the browser when prompted.\n'));

    try {
      execSync('gh auth login -h github.com -p https -w', { cwd: process.cwd(), stdio: 'inherit' });
    } catch {
      console.log(chalk.red('\n  ✗ Authentication failed'));
      process.exit(1);
    }

    if (!gh.isAuthenticated()) {
      console.log(chalk.red('  ✗ Still not authenticated'));
      process.exit(1);
    }
  }
  const username = gh.getUsername();
  console.log(chalk.green(`  ✓ Logged in as ${username || 'unknown'}`));

  console.log(chalk.white('\nStep 3/7: Checking project scope...'));
  const hasScope = gh.hasProjectScope();
  if (!hasScope) {
    console.log(chalk.yellow('  ⚠ Scope "project" not found'));

    const { addScope } = await inquirer.prompt([{
      type: 'confirm',
      name: 'addScope',
      message: 'Run "gh auth refresh -s project" to add it?',
      default: true,
    }]);

    if (addScope) {
      console.log(chalk.gray('\n  Copy the code from the terminal and paste it in the browser when prompted.\n'));

      try {
        execSync('gh auth refresh -s project', { cwd: process.cwd(), stdio: 'inherit' });
        console.log(chalk.green('  ✓ Project scope added'));
      } catch {
        console.log(chalk.yellow('  ⚠ Could not add scope. Continuing anyway...'));
      }
    } else {
      console.log(chalk.yellow('  Continuing without project scope. You may see permission errors.'));
    }
  } else {
    console.log(chalk.green('  ✓ Project scope available'));
  }

  console.log(chalk.white('\nStep 4/7: Detecting repository...'));
  const ownerRepo = gh.detectOwnerRepo();
  if (!ownerRepo) {
    console.log(chalk.red('  ✗ Could not detect owner/repo from git remote'));
    console.log(chalk.yellow('  Make sure this is a GitHub repository with a remote set.'));
    process.exit(1);
  }
  console.log(chalk.green(`  ✓ ${ownerRepo.owner}/${ownerRepo.repo} (from git remote)`));

  console.log(chalk.white('\nStep 5/7: Select organization...'));
  console.log(chalk.gray(`  Detected owner: ${ownerRepo.owner} (from git remote)`));

  const orgs = gh.listUserOrganizations();
  const ownerChoices: OwnerChoice[] = buildOwnerChoices(username, orgs);

  console.log(chalk.gray('\n  Available:'));
  ownerChoices.forEach((c, i) => {
    console.log(chalk.white(`    ${i + 1}. ${c.label}`));
  });

  const detectedIndex = ownerChoices.findIndex(c => c.value === ownerRepo.owner);
  const defaultOwnerIndex = detectedIndex >= 0 ? detectedIndex + 1 : 1;

  const { ownerIndex } = await inquirer.prompt([{
    type: 'number',
    name: 'ownerIndex',
    message: `Select owner for projects [1-${ownerChoices.length}]:`,
    default: defaultOwnerIndex,
    validate: (val: number) => val >= 1 && val <= ownerChoices.length ? true : `Enter 1-${ownerChoices.length}`,
  }]);

  let selectedOwner = ownerChoices[ownerIndex - 1].value;

  if (selectedOwner === '__manual__') {
    const { manualOwner } = await inquirer.prompt([{
      type: 'input',
      name: 'manualOwner',
      message: 'Enter organization/user login:',
      validate: (val: string) => val.trim().length > 0 ? true : 'Cannot be empty',
    }]);
    selectedOwner = manualOwner.trim();
  }

  console.log(chalk.green(`  ✓ Using: ${selectedOwner}`));

  console.log(chalk.white('\nStep 6/7: Select project...'));

  const { projectNumberInput } = await inquirer.prompt([{
    type: 'input',
    name: 'projectNumberInput',
    message: 'Do you know the project number? (leave empty to list all):',
  }]);

  let selectedProject;
  const trimmed = projectNumberInput?.trim();

  if (trimmed && /^\d+$/.test(trimmed)) {
    const projectNumber = parseInt(trimmed);
    const project = gh.getProject(selectedOwner, projectNumber);
    if (!project) {
      console.log(chalk.red(`  ✗ Project #${projectNumber} not found or is closed`));
      process.exit(1);
    }
    selectedProject = project;
    console.log(chalk.green(`  ✓ Selected: ${selectedProject.title} (#${selectedProject.number})`));
  } else {
    const projects = gh.listProjects(selectedOwner);
    if (projects.length === 0) {
      console.log(chalk.yellow('  No projects found.'));
      console.log(chalk.gray('  Create one at: github.com → repo → Projects → New Project → Board'));
      process.exit(1);
    }

    console.log(chalk.gray('  Projects found:'));
    projects.forEach((p, i) => {
      console.log(chalk.white(`    ${i + 1}. ${p.title} (#${p.number})`));
    });

    const { projectIndex } = await inquirer.prompt([{
      type: 'number',
      name: 'projectIndex',
      message: `Select [1-${projects.length}]:`,
      default: 1,
      validate: (val: number) => val >= 1 && val <= projects.length ? true : `Enter 1-${projects.length}`,
    }]);

    selectedProject = projects[projectIndex - 1];
    console.log(chalk.green(`  ✓ Selected: ${selectedProject.title}`));
  }

  console.log(chalk.white('\nStep 7/7: Reading board columns...'));
  const statusField = gh.getStatusField(selectedProject.id);
  if (!statusField || !statusField.options || statusField.options.length === 0) {
    console.log(chalk.red('  ✗ Could not read Status field columns'));
    console.log(chalk.yellow('  Make sure your project has a "Status" field with options.'));
    process.exit(1);
  }

  const columnNames = statusField.options.map(o => o.name);
  const columnOptions: Record<string, string> = {};
  for (const opt of statusField.options) {
    columnOptions[opt.name] = opt.id;
  }

  console.log(chalk.gray(`  Columns found: ${columnNames.join(', ')}`));

  const defaultMapping = {
    pending: findBestMatch(columnNames, ['Todo', 'To Do', 'Backlog', 'New']),
    'in-progress': findBestMatch(columnNames, ['In Progress', 'Doing', 'Active', 'Working']),
    completed: findBestMatch(columnNames, ['Done', 'Completed', 'Closed', 'Finished']),
    blocked: findBestMatch(columnNames, ['Blocked', 'On Hold', 'Waiting']),
  };

  console.log(chalk.gray('\n  Column mapping:'));
  console.log(chalk.gray(`    pending     → ${defaultMapping.pending || '(none)'}`));
  console.log(chalk.gray(`    in-progress → ${defaultMapping['in-progress'] || '(none)'}`));
  console.log(chalk.gray(`    completed   → ${defaultMapping.completed || '(none)'}`));
  console.log(chalk.gray(`    blocked     → ${defaultMapping.blocked || '(none)'}`));

  const { customizeMapping } = await inquirer.prompt([{
    type: 'confirm',
    name: 'customizeMapping',
    message: 'Customize column mapping?',
    default: false,
  }]);

  let columnMapping = defaultMapping;
  if (customizeMapping) {
    const choices = [...columnNames, '(none - skip)'];
    const answers = await inquirer.prompt([
      { type: 'list', name: 'pending', message: 'Map "pending" to:', choices, default: defaultMapping.pending || choices[0] },
      { type: 'list', name: 'in-progress', message: 'Map "in-progress" to:', choices, default: defaultMapping['in-progress'] || choices[0] },
      { type: 'list', name: 'completed', message: 'Map "completed" to:', choices, default: defaultMapping.completed || choices[0] },
      { type: 'list', name: 'blocked', message: 'Map "blocked" to:', choices, default: defaultMapping.blocked || choices[0] },
    ]);
    columnMapping = {
      pending: answers.pending === '(none - skip)' ? '' : answers.pending,
      'in-progress': answers['in-progress'] === '(none - skip)' ? '' : answers['in-progress'],
      completed: answers.completed === '(none - skip)' ? '' : answers.completed,
      blocked: answers.blocked === '(none - skip)' ? '' : answers.blocked,
    };
  }

  const { setWip } = await inquirer.prompt([{
    type: 'confirm',
    name: 'setWip',
    message: 'Set WIP limits? (optional)',
    default: false,
  }]);

  let wipLimits: Record<string, number | undefined> | undefined;
  let wipEnforcement: 'warn' | 'block' | undefined;

  if (setWip) {
    wipLimits = {};
    for (const col of columnNames) {
      const { limit } = await inquirer.prompt([{
        type: 'number',
        name: 'limit',
        message: `  ${col} max (0 = unlimited):`,
        default: 0,
      }]);
      if (limit > 0) {
        wipLimits[col] = limit;
      }
    }

    const { enforcement } = await inquirer.prompt([{
      type: 'list',
      name: 'enforcement',
      message: 'WIP enforcement mode:',
      choices: [
        { name: 'Warn (show warning but allow)', value: 'warn' },
        { name: 'Block (prevent exceeding limits)', value: 'block' },
      ],
      default: 'warn',
    }]);
    wipEnforcement = enforcement;
  }

  const { engine } = await inquirer.prompt([{
    type: 'list',
    name: 'engine',
    message: 'Task engine mode:',
    choices: [
      { name: 'both - Local tasks + GitHub sync (Recommended)', value: 'both' },
      { name: 'github - GitHub issues only', value: 'github' },
      { name: 'local - Local only (no sync)', value: 'local' },
    ],
    default: 'both',
  }]);

  const { autoSync } = await inquirer.prompt([{
    type: 'list',
    name: 'autoSync',
    message: 'Auto-sync behavior when moving tasks:',
    choices: [
      { name: 'ask - Ask before syncing to GitHub (Recommended)', value: 'ask' },
      { name: 'auto - Sync automatically without asking', value: 'auto' },
      { name: 'off - Never sync automatically (manual only)', value: 'off' },
    ],
    default: 'ask',
  }]);

  const githubConfig: GitHubConfig = {
    engine,
    owner: selectedOwner,
    repo: ownerRepo.repo,
    project: {
      projectNumber: selectedProject.number,
      projectId: selectedProject.id,
      title: selectedProject.title,
    },
    columns: {
      fieldId: statusField.id,
      options: columnOptions,
    },
    columnMapping,
    wipLimits: wipLimits && Object.keys(wipLimits).length > 0 ? wipLimits : undefined,
    wipEnforcement,
    autoSync,
  };

  config.github = githubConfig;
  saveConfig(cwd, config);

  console.log(chalk.green('\n✓ Saved to sedd.config.json'));
  console.log(chalk.cyan('\nGitHub integration is ready!'));
  console.log(chalk.gray('  Run "sedd github status" to verify.'));
  console.log(chalk.gray('  Run "sedd board" to see your kanban board.\n'));
}

export async function githubStatus(): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const gh = new GitHubOperations(cwd);

  console.log(chalk.cyan.bold('\nSEDD GitHub Integration Status\n'));

  if (!config.github || config.github.engine === 'local') {
    console.log(chalk.yellow('Engine: local (GitHub integration not configured)'));
    console.log(chalk.gray('Run "sedd github setup" to configure.\n'));
    return;
  }

  const ghConfig = config.github;

  console.log(chalk.gray('Engine:'), chalk.white(ghConfig.engine));
  console.log(chalk.gray('Repository:'), chalk.white(`${ghConfig.owner}/${ghConfig.repo}`));

  if (ghConfig.project) {
    console.log(chalk.gray('Project:'), chalk.white(`${ghConfig.project.title} (#${ghConfig.project.projectNumber})`));
  }

  console.log(chalk.gray('\nConnection test:'));
  if (!gh.hasGh()) {
    console.log(chalk.red('  ✗ gh CLI not found'));
    return;
  }
  console.log(chalk.green('  ✓ gh CLI available'));

  if (!gh.isAuthenticated()) {
    console.log(chalk.red('  ✗ Not authenticated'));
    return;
  }
  console.log(chalk.green('  ✓ Authenticated'));

  if (ghConfig.project) {
    const statusField = gh.getStatusField(ghConfig.project.projectId);
    if (statusField && statusField.options) {
      const currentCols = statusField.options.map(o => o.name);
      const configCols = Object.keys(ghConfig.columns.options);
      const missing = configCols.filter(c => !currentCols.includes(c));
      if (missing.length > 0) {
        console.log(chalk.yellow(`  ⚠ Columns changed on GitHub. Missing: ${missing.join(', ')}`));
        console.log(chalk.gray('    Run "sedd github refresh" to update.'));
      } else {
        console.log(chalk.green('  ✓ Columns valid'));
      }
    }
  }

  console.log(chalk.gray('\nColumn mapping:'));
  const mapping = ghConfig.columnMapping;
  console.log(chalk.gray(`  pending     → ${mapping.pending || '(none)'}`));
  console.log(chalk.gray(`  in-progress → ${mapping['in-progress'] || '(none)'}`));
  console.log(chalk.gray(`  completed   → ${mapping.completed || '(none)'}`));
  console.log(chalk.gray(`  blocked     → ${mapping.blocked || '(none)'}`));

  if (ghConfig.wipLimits) {
    console.log(chalk.gray('\nWIP limits:'));
    for (const [col, limit] of Object.entries(ghConfig.wipLimits)) {
      if (limit) console.log(chalk.gray(`  ${col}: ${limit}`));
    }
    console.log(chalk.gray(`  Enforcement: ${ghConfig.wipEnforcement || 'warn'}`));
  }

  console.log('');
}

export async function githubSync(): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);

  if (!config.github || config.github.engine === 'local') {
    console.log(chalk.yellow('GitHub integration not configured. Run "sedd github setup" first.'));
    return;
  }

  const { BoardManager } = await import('../core/board-manager.js');
  const { GitOperations } = await import('../utils/git.js');
  const git = new GitOperations(cwd);
  const bm = new BoardManager(config, cwd);

  if (!bm.isGitHubEnabled()) {
    console.log(chalk.yellow('GitHub sync not enabled. Check gh CLI and engine config.'));
    return;
  }

  const specsDir = join(cwd, config.specsDir);
  const { readdirSync } = await import('node:fs');

  const featureDirs = readdirSync(specsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{3}-/.test(d.name))
    .map(d => d.name);

  if (featureDirs.length === 0) {
    console.log(chalk.yellow('No features found.'));
    return;
  }

  console.log(chalk.cyan('Syncing with GitHub...\n'));

  let totalCreated = 0;
  let totalMoved = 0;
  let totalSynced = 0;
  const allErrors: string[] = [];

  for (const feature of featureDirs) {
    const featureDir = join(specsDir, feature);
    const metaPath = join(featureDir, '_meta.json');
    if (!existsSync(metaPath)) continue;

    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    const result = bm.syncToGitHub(featureDir, meta);

    totalCreated += result.created;
    totalMoved += result.moved;
    totalSynced += result.synced;
    allErrors.push(...result.errors);

    if (result.created > 0 || result.moved > 0) {
      console.log(chalk.green(`  ✓ ${feature}: created ${result.created}, moved ${result.moved}`));
    }
  }

  console.log(chalk.green(`\n✓ Sync complete: ${totalSynced} synced, ${totalCreated} created, ${totalMoved} moved`));

  if (allErrors.length > 0) {
    allErrors.forEach(e => console.log(chalk.yellow(`  ⚠ ${e}`)));
  }

  console.log('');
}

export async function githubRefresh(): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const gh = new GitHubOperations(cwd);

  if (!config.github?.project) {
    console.log(chalk.yellow('No GitHub project configured. Run "sedd github setup" first.'));
    return;
  }

  console.log(chalk.cyan('Refreshing columns from GitHub...'));

  const statusField = gh.getStatusField(config.github.project.projectId);
  if (!statusField || !statusField.options) {
    console.log(chalk.red('Could not read Status field from project.'));
    return;
  }

  const newOptions: Record<string, string> = {};
  for (const opt of statusField.options) {
    newOptions[opt.name] = opt.id;
  }

  config.github.columns = {
    fieldId: statusField.id,
    options: newOptions,
  };

  saveConfig(cwd, config);

  const columnNames = statusField.options.map(o => o.name);
  console.log(chalk.green(`✓ Updated columns: ${columnNames.join(', ')}`));

  const mapping = config.github.columnMapping;
  const invalid: string[] = [];
  for (const [seddStatus, colName] of Object.entries(mapping)) {
    if (colName && !columnNames.includes(colName)) {
      invalid.push(`${seddStatus} → ${colName}`);
    }
  }

  if (invalid.length > 0) {
    console.log(chalk.yellow(`\n⚠ Some mappings reference removed columns:`));
    invalid.forEach(m => console.log(chalk.yellow(`  ${m}`)));
    console.log(chalk.gray('  Run "sedd github setup" to reconfigure mapping.'));
  }

  console.log('');
}

function buildOwnerChoices(username: string | null, orgs: GitHubOrganization[]): OwnerChoice[] {
  const choices: OwnerChoice[] = [];

  if (username) {
    choices.push({ label: `${username} (personal)`, value: username });
  }

  for (const org of orgs) {
    if (org.login === username) continue;
    const label = org.name !== org.login ? `${org.login} (${org.name})` : org.login;
    choices.push({ label, value: org.login });
  }

  choices.push({ label: 'Enter manually...', value: '__manual__' });
  return choices;
}

function findBestMatch(columns: string[], candidates: string[]): string {
  for (const candidate of candidates) {
    const found = columns.find(c => c.toLowerCase() === candidate.toLowerCase());
    if (found) return found;
  }
  return '';
}

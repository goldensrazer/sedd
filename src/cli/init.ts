import { existsSync, mkdirSync, copyFileSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { GitOperations } from '../utils/git.js';
import { DEFAULT_CONFIG } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '../../templates');
const COMMANDS_DIR = join(__dirname, '../../commands');
const HOOKS_DIR = join(__dirname, '../../hooks');
const SCRIPTS_DIR = join(__dirname, '../../scripts');

interface InitOptions {
  git?: boolean;
  gitignore?: boolean;
  legacy?: boolean;
  force?: boolean;
}

function detectProject(cwd: string): { name: string; found: boolean } {
  const packageJsonPath = join(cwd, 'package.json');

  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      return { name: pkg.name || basename(cwd), found: true };
    } catch {
      return { name: basename(cwd), found: true };
    }
  }

  const projectIndicators = [
    'pyproject.toml',  // Python
    'Cargo.toml',      // Rust
    'go.mod',          // Go
    'composer.json',   // PHP
    'Gemfile',         // Ruby
    '.git',            // Git repo
  ];

  for (const indicator of projectIndicators) {
    if (existsSync(join(cwd, indicator))) {
      return { name: basename(cwd), found: true };
    }
  }

  return { name: '', found: false };
}

export async function init(projectName?: string, options: InitOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const git = new GitOperations(cwd);

  if (!projectName) {
    const detected = detectProject(cwd);

    if (!detected.found) {
      console.log(chalk.yellow('\n⚠️  No project detected in current directory.\n'));
      console.log('SEDD works best inside a project. Try one of these:');
      console.log(chalk.gray('  1.'), 'Run', chalk.cyan('npm init -y'), 'to create a package.json');
      console.log(chalk.gray('  2.'), 'Run', chalk.cyan('sedd init my-project'), 'to specify a project name');
      console.log(chalk.gray('  3.'), 'Navigate to an existing project folder');
      console.log();

      const { default: inquirer } = await import('inquirer');
      const { continueAnyway } = await inquirer.prompt([{
        type: 'confirm',
        name: 'continueAnyway',
        message: 'Initialize SEDD anyway in current directory?',
        default: false,
      }]);

      if (!continueAnyway) {
        console.log(chalk.gray('\nAborted.\n'));
        return;
      }

      projectName = basename(cwd);
    } else {
      projectName = detected.name;
      console.log(chalk.blue(`\n🔍 Detected project: ${chalk.bold(projectName)}\n`));
    }
  }

  console.log(chalk.blue('🚀 Initializing SEDD...\n'));

  const configPath = join(cwd, 'sedd.config.json');
  const specsDir = options.legacy ? 'specs' : '.sedd';
  const specsDirPath = join(cwd, specsDir);
  const claudeDir = join(cwd, '.claude');
  const commandsDir = join(claudeDir, 'commands');
  const hooksDir = join(claudeDir, 'hooks');

  if (!existsSync(configPath)) {
    const config = { ...DEFAULT_CONFIG, specsDir };
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log(chalk.green('✓'), 'Created sedd.config.json');
  }

  if (!existsSync(specsDirPath)) {
    mkdirSync(specsDirPath, { recursive: true });
    console.log(chalk.green('✓'), `Created ${specsDir}/`);
  }

  const seddInternalDir = join(cwd, '.sedd');
  if (!existsSync(seddInternalDir)) {
    mkdirSync(seddInternalDir, { recursive: true });
  }

  const seddTemplatesDir = join(seddInternalDir, 'templates');
  if (!existsSync(seddTemplatesDir)) {
    mkdirSync(seddTemplatesDir, { recursive: true });
    console.log(chalk.green('✓'), 'Created .sedd/templates/');
  }

  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
    console.log(chalk.green('✓'), 'Created .claude/');
  }

  if (!existsSync(commandsDir)) {
    mkdirSync(commandsDir, { recursive: true });
    console.log(chalk.green('✓'), 'Created .claude/commands/');
  }

  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
    console.log(chalk.green('✓'), 'Created .claude/hooks/');
  }

  const shouldCopy = (dest: string) => !existsSync(dest) || options.force;
  const actionVerb = options.force ? 'Updated' : 'Installed';

  if (existsSync(TEMPLATES_DIR)) {
    const templates = readdirSync(TEMPLATES_DIR);
    for (const template of templates) {
      const src = join(TEMPLATES_DIR, template);
      const dest = join(seddTemplatesDir, template);
      if (shouldCopy(dest)) {
        copyFileSync(src, dest);
        console.log(chalk.green('✓'), `${actionVerb} template: ${template}`);
      }
    }
  }

  if (existsSync(COMMANDS_DIR)) {
    const commands = readdirSync(COMMANDS_DIR);
    for (const command of commands) {
      const src = join(COMMANDS_DIR, command);
      const dest = join(commandsDir, command);
      if (shouldCopy(dest)) {
        copyFileSync(src, dest);
        console.log(chalk.green('✓'), `${actionVerb} command: ${command}`);
      }
    }
  }

  if (existsSync(HOOKS_DIR)) {
    const hooks = readdirSync(HOOKS_DIR);
    for (const hook of hooks) {
      const src = join(HOOKS_DIR, hook);
      const dest = join(hooksDir, hook);
      if (shouldCopy(dest)) {
        copyFileSync(src, dest);
        console.log(chalk.green('✓'), `${actionVerb} hook: ${hook}`);
      }
    }
  }

  // Register hooks in .claude/settings.json
  const settingsPath = join(claudeDir, 'settings.json');
  const hooksConfig = {
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node "$(git rev-parse --show-toplevel)/.claude/hooks/check-roadmap.cjs"', timeout: 10 }] }],
      SessionStart: [{ matcher: 'startup|resume|compact', hooks: [{ type: 'command', command: 'node "$(git rev-parse --show-toplevel)/.claude/hooks/session-recovery.cjs"', timeout: 10 }] }],
      PreCompact: [{ hooks: [{ type: 'command', command: 'node "$(git rev-parse --show-toplevel)/.claude/hooks/pre-compact.cjs"', timeout: 10 }] }],
      Stop: [{ hooks: [{ type: 'command', command: 'node "$(git rev-parse --show-toplevel)/.claude/hooks/session-stop.cjs"', timeout: 10 }] }],
      SubagentStart: [{ hooks: [{ type: 'command', command: 'node "$(git rev-parse --show-toplevel)/.claude/hooks/subagent-context.cjs"', timeout: 10 }] }],
    },
  };

  if (!existsSync(settingsPath) || options.force) {
    let settings = hooksConfig;
    if (existsSync(settingsPath)) {
      try {
        const existing = JSON.parse(readFileSync(settingsPath, 'utf-8'));
        settings = { ...existing, ...hooksConfig };
      } catch { /* use fresh config */ }
    }
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    console.log(chalk.green('✓'), `${actionVerb} .claude/settings.json with hook registrations`);
  }

  const seddScriptsDir = join(seddInternalDir, 'scripts');
  if (existsSync(SCRIPTS_DIR)) {
    const isWindows = process.platform === 'win32';

    let scriptRunner: 'auto' | 'powershell' | 'bash' = 'auto';
    if (existsSync(configPath)) {
      try {
        const existingConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
        if (existingConfig.scriptRunner && existingConfig.scriptRunner !== 'auto') {
          scriptRunner = existingConfig.scriptRunner;
        }
      } catch {
        // Ignore parse errors
      }
    }

    const primaryFolder = scriptRunner !== 'auto'
      ? scriptRunner
      : (isWindows ? 'powershell' : 'bash');

    const platformName = scriptRunner !== 'auto'
      ? `${scriptRunner} (configured in sedd.config.json)`
      : (isWindows ? 'Windows (PowerShell)' : process.platform === 'darwin' ? 'macOS (Bash)' : 'Linux (Bash)');

    console.log(chalk.gray(`  Script runner: ${platformName}`));

    const srcFolder = join(SCRIPTS_DIR, primaryFolder);
    const destFolder = join(seddScriptsDir, primaryFolder);

    if (existsSync(srcFolder)) {
      if (!existsSync(destFolder)) {
        mkdirSync(destFolder, { recursive: true });
      }

      const scripts = readdirSync(srcFolder);
      for (const script of scripts) {
        const src = join(srcFolder, script);
        const dest = join(destFolder, script);
        if (shouldCopy(dest)) {
          copyFileSync(src, dest);
          console.log(chalk.green('✓'), `${actionVerb} script: ${primaryFolder}/${script}`);
        }
      }
    }

    const secondaryFolder = isWindows ? 'bash' : 'powershell';
    const secondarySrcFolder = join(SCRIPTS_DIR, secondaryFolder);
    const secondaryDestFolder = join(seddScriptsDir, secondaryFolder);

    if (existsSync(secondarySrcFolder)) {
      if (!existsSync(secondaryDestFolder)) {
        mkdirSync(secondaryDestFolder, { recursive: true });
      }

      const scripts = readdirSync(secondarySrcFolder);
      for (const script of scripts) {
        const src = join(secondarySrcFolder, script);
        const dest = join(secondaryDestFolder, script);
        if (shouldCopy(dest)) {
          copyFileSync(src, dest);
        }
      }
    }
  }

  // Update .gitignore with SEDD entries
  const shouldUpdateGitignore = options.git !== false && options.gitignore !== false && git.hasGit();
  if (shouldUpdateGitignore) {
    const gitignorePath = join(cwd, '.gitignore');
    const { appendFileSync } = await import('node:fs');

    // Default entries to ignore
    const seddIgnoreEntries = [
      '# SEDD',
      '.sedd/cache/',
      '.sedd/scripts/',
      '.sedd/templates/',
      '',
      '# SEDD config (uncomment to ignore)',
      '# sedd.config.json',
      '',
      '# Uncomment to ignore entire SEDD directory',
      '# .sedd/',
      '',
      '# Claude Code hooks output',
      '.claude/hooks/*.log',
      '.claude/hooks/*.tmp',
    ];

    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, 'utf-8');

      // Check if SEDD section already exists
      if (!gitignore.includes('# SEDD')) {
        appendFileSync(gitignorePath, '\n' + seddIgnoreEntries.join('\n') + '\n');
        console.log(chalk.green('✓'), 'Updated .gitignore with SEDD entries');
      }
    } else {
      // Create .gitignore if it doesn't exist
      writeFileSync(gitignorePath, seddIgnoreEntries.join('\n') + '\n');
      console.log(chalk.green('✓'), 'Created .gitignore with SEDD entries');
    }
  }

  console.log(chalk.blue('\n✨ SEDD initialized successfully!\n'));
  console.log(chalk.bold('Next steps:'));
  console.log();
  console.log(chalk.gray('  1. Create a feature spec:'));
  console.log(chalk.cyan('     sedd specify 001 my-feature'));
  console.log();
  console.log(chalk.gray('  2. Edit the spec file:'));
  console.log(chalk.yellow('     .sedd/001-my-feature/spec.md'));
  console.log();
  console.log(chalk.gray('  3. Open your AI assistant and implement:'));
  console.log(chalk.cyan('     claude'), chalk.gray('or'), chalk.cyan('cursor'), chalk.gray('or'), chalk.cyan('copilot'));
  console.log();
  console.log(chalk.gray('  4. Use slash commands in your AI:'));
  console.log(chalk.cyan('     /sedd.clarify'), chalk.gray('- refine requirements'));
  console.log(chalk.cyan('     /sedd.implement'), chalk.gray('- execute tasks'));
  console.log();
}

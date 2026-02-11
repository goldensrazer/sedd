import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { checkForUpdates, showUpdateNotification, getInstalledVersion } from './version-check.js';
import { loadConfig } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '../../templates');
const COMMANDS_DIR = join(__dirname, '../../commands');
const HOOKS_DIR = join(__dirname, '../../hooks');
const SCRIPTS_DIR = join(__dirname, '../../scripts');

interface UpdateOptions {
  force?: boolean;
  backup?: boolean;
}

interface FeatureScan {
  name: string;
  path: string;
  hasMetaExpectation: boolean;
  hasSpecExpectation: boolean;
  migrations: MigrationScan[];
}

interface MigrationScan {
  id: string;
  folder: string;
  path: string;
  hasAcceptance: boolean;
  taskCount: number;
}

interface FileCount {
  templates: number;
  commands: number;
  hooks: number;
  scripts: number;
  schema: boolean;
}

function countDirectoryFiles(dir: string): number {
  if (!existsSync(dir)) return 0;

  let count = 0;
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      count += countDirectoryFiles(join(dir, item.name));
    } else {
      count++;
    }
  }
  return count;
}

function copyDirectory(src: string, dest: string): number {
  if (!existsSync(src)) return 0;

  mkdirSync(dest, { recursive: true });

  let count = 0;
  for (const item of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, item.name);
    const destPath = join(dest, item.name);

    if (item.isDirectory()) {
      count += copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
      count++;
    }
  }

  return count;
}

function previewFileCounts(): FileCount {
  return {
    templates: countDirectoryFiles(TEMPLATES_DIR),
    commands: countDirectoryFiles(COMMANDS_DIR),
    hooks: countDirectoryFiles(HOOKS_DIR),
    scripts: countDirectoryFiles(SCRIPTS_DIR),
    schema: existsSync(join(TEMPLATES_DIR, 'sedd.schema.json')),
  };
}

function scanFeatures(seddDir: string): FeatureScan[] {
  const features: FeatureScan[] = [];

  if (!existsSync(seddDir)) return features;

  const items = readdirSync(seddDir, { withFileTypes: true });

  for (const item of items) {
    if (!item.isDirectory() || !/^\d{3}-/.test(item.name)) continue;
    if (item.name === 'templates' || item.name === 'scripts' || item.name === 'cache') continue;

    const featurePath = join(seddDir, item.name);
    const metaPath = join(featurePath, '_meta.json');
    const specPath = join(featurePath, 'spec.md');

    let hasMetaExpectation = false;
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
        hasMetaExpectation = !!meta.expectation;
      } catch {}
    }

    let hasSpecExpectation = false;
    if (existsSync(specPath)) {
      try {
        const spec = readFileSync(specPath, 'utf-8');
        hasSpecExpectation = /^##\s*Expectat/im.test(spec);
      } catch {}
    }

    const migrations: MigrationScan[] = [];
    const contents = readdirSync(featurePath, { withFileTypes: true });

    for (const content of contents) {
      if (!content.isDirectory()) continue;
      if (!/^\d{3}[_-]/.test(content.name)) continue;

      const migPath = join(featurePath, content.name);
      const hasAcceptance = existsSync(join(migPath, 'acceptance.md'));

      let taskCount = 0;
      const tasksPath = join(migPath, 'tasks.md');
      if (existsSync(tasksPath)) {
        try {
          const tasks = readFileSync(tasksPath, 'utf-8');
          const matches = tasks.match(/^\s*-\s*\[[\sx]\]\s*T\d{3}-\d{3}/gim);
          taskCount = matches ? matches.length : 0;
        } catch {}
      }

      const migId = content.name.split(/[_-]/)[0];
      migrations.push({
        id: migId,
        folder: content.name,
        path: migPath,
        hasAcceptance,
        taskCount,
      });
    }

    migrations.sort((a, b) => a.id.localeCompare(b.id));

    features.push({
      name: item.name,
      path: featurePath,
      hasMetaExpectation,
      hasSpecExpectation,
      migrations,
    });
  }

  return features.sort((a, b) => a.name.localeCompare(b.name));
}

interface UpdateResult {
  templates: number;
  commands: number;
  hooks: number;
  scripts: number;
  schema: boolean;
}

function updateSeddFiles(cwd: string): UpdateResult {
  const seddDir = join(cwd, '.sedd');
  const claudeDir = join(cwd, '.claude');

  console.log(chalk.cyan('\n📦 Atualizando arquivos SEDD...\n'));

  // 1. Templates
  const templatesCount = copyDirectory(TEMPLATES_DIR, join(seddDir, 'templates'));
  console.log(chalk.green(`  ✓ Templates: ${templatesCount} arquivos atualizados`));

  // 2. Commands
  const commandsCount = copyDirectory(COMMANDS_DIR, join(claudeDir, 'commands'));
  console.log(chalk.green(`  ✓ Commands: ${commandsCount} arquivos atualizados`));

  // 3. Hooks
  const hooksCount = copyDirectory(HOOKS_DIR, join(claudeDir, 'hooks'));
  console.log(chalk.green(`  ✓ Hooks: ${hooksCount} arquivos atualizados`));

  // 4. Scripts (platform specific)
  const scriptsDir = join(seddDir, 'scripts');
  const bashCount = copyDirectory(join(SCRIPTS_DIR, 'bash'), join(scriptsDir, 'bash'));
  const psCount = copyDirectory(join(SCRIPTS_DIR, 'powershell'), join(scriptsDir, 'powershell'));
  console.log(chalk.green(`  ✓ Scripts: ${bashCount + psCount} arquivos atualizados`));

  // 5. Schema
  const schemaPath = join(TEMPLATES_DIR, 'sedd.schema.json');
  let schemaUpdated = false;
  if (existsSync(schemaPath)) {
    copyFileSync(schemaPath, join(seddDir, 'sedd.schema.json'));
    console.log(chalk.green('  ✓ Schema atualizado'));
    schemaUpdated = true;
  }

  // 6. Register hooks in .claude/settings.json
  const settingsPath = join(claudeDir, 'settings.json');
  const hooksConfig = {
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node .claude/hooks/check-roadmap.js', timeout: 10 }] }],
      SessionStart: [{ matcher: 'startup|resume|compact', hooks: [{ type: 'command', command: 'node .claude/hooks/session-recovery.js', timeout: 10 }] }],
      PreCompact: [{ hooks: [{ type: 'command', command: 'node .claude/hooks/pre-compact.js', timeout: 10 }] }],
      Stop: [{ hooks: [{ type: 'command', command: 'node .claude/hooks/session-stop.js', timeout: 10 }] }],
      SubagentStart: [{ hooks: [{ type: 'command', command: 'node .claude/hooks/subagent-context.js', timeout: 10 }] }],
    },
  };

  let settings: Record<string, unknown> = hooksConfig;
  if (existsSync(settingsPath)) {
    try {
      const existing = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      settings = { ...existing, ...hooksConfig };
    } catch { /* use fresh config */ }
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  console.log(chalk.green('  ✓ Hook registrations atualizadas em .claude/settings.json'));

  console.log(chalk.cyan('\n✅ Atualização concluída!\n'));

  return {
    templates: templatesCount,
    commands: commandsCount,
    hooks: hooksCount,
    scripts: bashCount + psCount,
    schema: schemaUpdated,
  };
}

async function migrateFeature(feature: FeatureScan): Promise<void> {
  const { default: inquirer } = await import('inquirer');

  console.log(chalk.blue(`\n📝 Migrando ${feature.name}...\n`));

  let specSummary = '';
  const specPath = join(feature.path, 'spec.md');
  if (existsSync(specPath)) {
    const spec = readFileSync(specPath, 'utf-8');
    const lines = spec.split('\n').slice(0, 20);
    const descLine = lines.find(l => l.startsWith('>') || (l.length > 20 && !l.startsWith('#')));
    if (descLine) {
      specSummary = descLine.replace(/^>\s*/, '').slice(0, 100);
    }
  }

  if (specSummary) {
    console.log(chalk.gray('Resumo da feature:'));
    console.log(chalk.white(`> ${specSummary}\n`));
  }

  const { expectation } = await inquirer.prompt([{
    type: 'input',
    name: 'expectation',
    message: '🎯 Qual é a EXPECTATIVA para esta feature?',
    validate: (input: string) => input.length > 5 || 'Expectativa muito curta',
  }]);

  const metaPath = join(feature.path, '_meta.json');
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      meta.expectation = expectation;
      writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
      console.log(chalk.green('✓'), 'Adicionado ao _meta.json');
    } catch (e) {
      console.log(chalk.red('✗'), 'Erro ao atualizar _meta.json');
    }
  }

  if (existsSync(specPath) && !feature.hasSpecExpectation) {
    try {
      const spec = readFileSync(specPath, 'utf-8');
      const lines = spec.split('\n');

      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('# ')) {
          insertIndex = i + 1;
          while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
            insertIndex++;
          }
          break;
        }
      }

      const expectationSection = `\n## Expectation\n\n> ${expectation}\n`;
      lines.splice(insertIndex, 0, expectationSection);

      writeFileSync(specPath, lines.join('\n'));
      console.log(chalk.green('✓'), 'Adicionado ao spec.md');
    } catch (e) {
      console.log(chalk.red('✗'), 'Erro ao atualizar spec.md');
    }
  }

  if (feature.migrations.length > 0) {
    const migrationsWithoutAC = feature.migrations.filter(m => !m.hasAcceptance && m.taskCount > 0);

    if (migrationsWithoutAC.length > 0) {
      const { createAC } = await inquirer.prompt([{
        type: 'confirm',
        name: 'createAC',
        message: `Criar acceptance.md para ${migrationsWithoutAC.length} migration(s)?`,
        default: true,
      }]);

      if (createAC) {
        for (const mig of migrationsWithoutAC) {
          await generateAcceptance(mig, expectation);
        }
      }
    }
  }
}

async function generateAcceptance(migration: MigrationScan, expectation: string): Promise<void> {
  const tasksPath = join(migration.path, 'tasks.md');
  if (!existsSync(tasksPath)) return;

  const tasks = readFileSync(tasksPath, 'utf-8');
  const taskMatches = tasks.match(/^\s*-\s*\[[\sx]\]\s*(T\d{3}-\d{3})\s*\[?[^\]]*\]?\s*(.+)/gim) || [];

  const criteria: string[] = [];
  let acNum = 1;

  for (const match of taskMatches) {
    const parts = match.match(/^\s*-\s*\[[\sx]\]\s*(T\d{3}-\d{3})\s*\[?[^\]]*\]?\s*(.+)/i);
    if (parts && parts[2]) {
      const taskDesc = parts[2].replace(/`[^`]+`/g, '').trim();
      const acId = `AC-${String(acNum).padStart(3, '0')}`;
      criteria.push(`- [ ] **${acId}:** ${taskDesc}`);
      acNum++;
    }
  }

  if (criteria.length === 0) return;

  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const acceptance = `# Acceptance Criteria - Migration ${migration.id}

> Generated from tasks
> Timestamp: ${timestamp}

## Expectativa

> ${expectation}

---

## Checklist de Aceite

${criteria.join('\n  - Verificar: Testar manualmente\n\n')}
  - Verificar: Testar manualmente

---

## Sign-off

| Critério | Status | Verificado Por | Data |
|----------|--------|----------------|------|
${criteria.map((_, i) => `| AC-${String(i + 1).padStart(3, '0')} | pending | - | - |`).join('\n')}

---

## Notas

_Gerado automaticamente por \`sedd update\`_
`;

  writeFileSync(join(migration.path, 'acceptance.md'), acceptance);
  console.log(chalk.green('✓'), `Criado ${migration.folder}/acceptance.md (${criteria.length} critérios)`);
}

export async function update(options: UpdateOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const seddDir = join(cwd, '.sedd');
  const claudeDir = join(cwd, '.claude');

  if (!existsSync(seddDir) && !existsSync(claudeDir)) {
    console.log(chalk.red('\n❌ SEDD não inicializado neste projeto.'));
    console.log(chalk.gray('   Execute'), chalk.cyan('sedd init'), chalk.gray('primeiro.\n'));
    return;
  }

  const version = getInstalledVersion();
  console.log(chalk.blue(`\n🔄 SEDD Update - v${version}\n`));

  // Check for newer version on npm
  const versionInfo = await checkForUpdates();
  if (versionInfo?.needsUpdate) {
    showUpdateNotification(versionInfo);
  }

  // Preview files that will be updated
  const preview = previewFileCounts();
  const totalFiles = preview.templates + preview.commands + preview.hooks + preview.scripts + (preview.schema ? 1 : 0);

  console.log(chalk.white('Arquivos que serão substituídos:'));
  console.log(chalk.gray(`  .sedd/templates/      (${preview.templates} arquivos)`));
  console.log(chalk.gray(`  .sedd/scripts/        (${preview.scripts} arquivos)`));
  console.log(chalk.gray(`  .claude/commands/     (${preview.commands} arquivos)`));
  console.log(chalk.gray(`  .claude/hooks/        (${preview.hooks} arquivos)`));
  if (preview.schema) {
    console.log(chalk.gray(`  .sedd/sedd.schema.json`));
  }
  console.log(chalk.gray(`\n  Total: ${totalFiles} arquivos\n`));

  // Confirmation prompt (unless --force)
  if (!options.force) {
    const { default: inquirer } = await import('inquirer');
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Continuar com a atualização?',
      default: true,
    }]);

    if (!confirm) {
      console.log(chalk.gray('\nAbortado.\n'));
      return;
    }
  }

  console.log(chalk.gray('Escaneando projeto...\n'));

  const features = scanFeatures(seddDir);

  if (features.length === 0) {
    console.log(chalk.yellow('Nenhuma feature encontrada.\n'));
    console.log(chalk.gray('Atualizando templates/commands/hooks...\n'));
    updateSeddFiles(cwd);
    console.log(chalk.green('\n✨ Atualização concluída!\n'));
    return;
  }

  console.log(chalk.white(`📁 Features encontradas: ${features.length}`));
  for (const f of features) {
    console.log(chalk.gray(`   ${f.name}`));
  }
  console.log('');

  console.log(chalk.bold('📋 Análise de compatibilidade:\n'));

  const maxName = Math.max(...features.map(f => f.name.length), 15);

  console.log(chalk.gray(`┌${'─'.repeat(maxName + 2)}┬──────────┬────────────┬─────────────┐`));
  console.log(chalk.gray(`│ ${'Feature'.padEnd(maxName)} │ meta.exp │ spec.exp   │ migrations  │`));
  console.log(chalk.gray(`├${'─'.repeat(maxName + 2)}┼──────────┼────────────┼─────────────┤`));

  let needsMigration = 0;
  for (const f of features) {
    const metaIcon = f.hasMetaExpectation ? chalk.green('✅') : chalk.red('❌');
    const specIcon = f.hasSpecExpectation ? chalk.green('✅') : chalk.red('❌');
    const migsWithAC = f.migrations.filter(m => m.hasAcceptance).length;
    const migInfo = f.migrations.length > 0
      ? `${f.migrations.length} (${migsWithAC} c/ AC)`
      : '0';

    if (!f.hasMetaExpectation || !f.hasSpecExpectation) needsMigration++;

    console.log(chalk.gray(`│ `) + f.name.padEnd(maxName) + chalk.gray(` │ `) + metaIcon.padEnd(8) + chalk.gray(` │ `) + specIcon.padEnd(10) + chalk.gray(` │ `) + migInfo.padEnd(11) + chalk.gray(` │`));
  }

  console.log(chalk.gray(`└${'─'.repeat(maxName + 2)}┴──────────┴────────────┴─────────────┘`));

  console.log(chalk.gray('\nLegenda:'));
  console.log(chalk.gray('  meta.exp = _meta.json tem campo expectation'));
  console.log(chalk.gray('  spec.exp = spec.md tem seção ## Expectation'));
  console.log(chalk.gray('  AC = acceptance.md\n'));

  // GitHub Integration status
  try {
    const config = loadConfig(cwd);
    const gh = config.github;
    if (gh?.project) {
      const proj = gh.project;
      console.log(chalk.bold('GitHub Integration:'));
      console.log(chalk.gray(`  Engine: ${gh.engine || 'both'}`));
      console.log(chalk.gray(`  Project: ${proj.title} (#${proj.projectNumber})`));
      console.log(chalk.green('  ✓ Connected\n'));
    } else {
      console.log(chalk.gray('GitHub Integration: not configured'));
      console.log(chalk.gray('  Run "sedd github setup" to enable.\n'));
    }
  } catch {
    console.log(chalk.gray('GitHub Integration: not configured'));
    console.log(chalk.gray('  Run "sedd github setup" to enable.\n'));
  }

  if (needsMigration > 0) {
    console.log(chalk.yellow(`⚠️  ${needsMigration} feature(s) sem expectation definida\n`));
  }

  const { default: inquirer } = await import('inquirer');

  const choices = [
    { name: '1. Atualizar só templates/commands (novas features terão expectation)', value: 'templates' },
  ];

  if (needsMigration > 0) {
    choices.push({ name: '2. Migrar features existentes (perguntar expectation para cada)', value: 'migrate' });
  }

  choices.push({ name: needsMigration > 0 ? '3. Cancelar' : '2. Cancelar', value: 'cancel' });

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'O que deseja fazer?',
    choices,
  }]);

  if (action === 'cancel') {
    console.log(chalk.gray('\nAbortado.\n'));
    return;
  }

  if (action === 'migrate') {
    const featuresToMigrate = features.filter(f => !f.hasMetaExpectation || !f.hasSpecExpectation);
    for (const feature of featuresToMigrate) {
      await migrateFeature(feature);
    }
  }

  updateSeddFiles(cwd);
}

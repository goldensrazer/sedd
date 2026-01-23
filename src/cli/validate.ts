import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { GitOperations } from '../utils/git.js';
import { MigrationManager } from '../core/migration-manager.js';
import { loadConfig } from '../types/index.js';

interface ValidateOptions {
  migration?: string;
  auto?: boolean;
  fullDiff?: boolean;
  json?: boolean;
}

interface FileDiff {
  filePath: string;
  linesAdded: number;
  linesRemoved: number;
  isNewFile: boolean;
}

interface ValidationGap {
  description: string;
  expectationItem: string;
  suggestedTask: {
    id: string;
    description: string;
    priority: 'P1' | 'P2' | 'P3';
  };
  severity: 'critical' | 'important' | 'minor';
}

interface Validation {
  featureId: string;
  migrationId: string;
  createdAt: string;
  expectation: {
    summary: string;
    must: string[];
    mustNot: string[];
  };
  coveragePercentage: number;
  tasksCompleted: string[];
  tasksPending: string[];
  filesChanged: FileDiff[];
  gaps: ValidationGap[];
  violations: { rule: string; violatedBy: string; severity: 'critical' | 'warning' }[];
  recommendation: 'complete' | 'needs-followup' | 'needs-revision';
}

function generateProgressBar(percent: number, width: number = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export async function validate(options: ValidateOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const git = new GitOperations(cwd);
  const config = loadConfig(cwd);
  const specsDir = join(cwd, config.specsDir);

  if (!existsSync(specsDir)) {
    console.log(chalk.yellow(`\n⚠ No ${config.specsDir}/ directory found. Run "sedd init" first.\n`));
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
    console.log(chalk.yellow('\n⚠ No features found.\n'));
    return;
  }

  const featureDir = join(specsDir, currentFeature);
  const mm = new MigrationManager(featureDir);
  const meta = mm.loadMeta();

  if (!meta) {
    console.log(chalk.yellow('⚠ This feature uses the old structure. Run sedd migrate first.'));
    return;
  }

  const migrationId = options.migration || meta.currentMigration;
  if (!migrationId) {
    console.log(chalk.yellow('⚠ No migration to validate. Run /sedd.clarify first.'));
    return;
  }

  const migration = meta.migrations[migrationId];
  if (!migration) {
    console.log(chalk.red(`✗ Migration ${migrationId} not found.`));
    return;
  }

  const rawExpectation = migration.expectation || meta.expectation;
  let expectation: { summary: string; must: string[]; mustNot: string[] };

  if (typeof rawExpectation === 'string') {
    expectation = { summary: rawExpectation, must: [] as string[], mustNot: [] as string[] };
  } else if (rawExpectation && typeof rawExpectation === 'object') {
    expectation = {
      summary: (rawExpectation as { summary?: string }).summary || '',
      must: (rawExpectation as { must?: string[] }).must || [],
      mustNot: (rawExpectation as { mustNot?: string[] }).mustNot || [],
    };
  } else {
    expectation = { summary: '', must: [] as string[], mustNot: [] as string[] };
  }

  const tasksPath = join(featureDir, migration.folder, 'tasks.md');
  const tasksCompleted: string[] = [];
  const tasksPending: string[] = [];

  if (existsSync(tasksPath)) {
    const content = readFileSync(tasksPath, 'utf-8');
    const completedMatches = content.match(/- \[x\] (T\d{3}-\d{3})/gi) || [];
    const pendingMatches = content.match(/- \[ \] (T\d{3}-\d{3})/g) || [];

    tasksCompleted.push(...completedMatches.map((m) => m.match(/T\d{3}-\d{3}/)?.[0] || ''));
    tasksPending.push(...pendingMatches.map((m) => m.match(/T\d{3}-\d{3}/)?.[0] || ''));
  }

  const filesChanged: FileDiff[] = [];
  if (git.hasGit()) {
    try {
      const { execSync } = await import('node:child_process');
      const diffOutput = execSync('git diff --stat HEAD~10 2>/dev/null || echo ""', {
        cwd,
        encoding: 'utf-8',
      });

      const lines = diffOutput.split('\n').filter((l) => l.includes('|'));
      for (const line of lines.slice(0, 20)) {
        const match = line.match(/^\s*(.+?)\s*\|\s*(\d+)/);
        if (match) {
          const [, filePath, changes] = match;
          const added = line.includes('+') ? parseInt(changes) / 2 : 0;
          const removed = line.includes('-') ? parseInt(changes) / 2 : 0;
          filesChanged.push({
            filePath: filePath.trim(),
            linesAdded: Math.round(added),
            linesRemoved: Math.round(removed),
            isNewFile: false,
          });
        }
      }
    } catch {
    }
  }

  const totalTasks = tasksCompleted.length + tasksPending.length;
  const coveragePercentage = totalTasks > 0
    ? Math.round((tasksCompleted.length / totalTasks) * 100)
    : 0;

  const gaps: ValidationGap[] = [];
  if (tasksPending.length > 0) {
    gaps.push({
      description: `${tasksPending.length} tasks still pending`,
      expectationItem: expectation.summary,
      suggestedTask: {
        id: `T${migrationId}-NEW-001`,
        description: 'Complete remaining tasks',
        priority: 'P1',
      },
      severity: tasksPending.length > 2 ? 'critical' : 'important',
    });
  }

  const violations: { rule: string; violatedBy: string; severity: 'critical' | 'warning' }[] = [];

  let recommendation: 'complete' | 'needs-followup' | 'needs-revision' = 'complete';
  if (violations.length > 0) {
    recommendation = 'needs-revision';
  } else if (gaps.length > 0 || tasksPending.length > 0) {
    recommendation = 'needs-followup';
  }

  const validation: Validation = {
    featureId: meta.featureId,
    migrationId,
    createdAt: new Date().toISOString(),
    expectation,
    coveragePercentage,
    tasksCompleted,
    tasksPending,
    filesChanged,
    gaps,
    violations,
    recommendation,
  };

  if (options.json) {
    console.log(JSON.stringify(validation, null, 2));
    return;
  }

  console.log(chalk.blue(`\n🔍 Validação: Migration ${migrationId}\n`));

  console.log(chalk.bold('Expectativa:'));
  console.log(chalk.gray(`  > ${expectation.summary || '(não definida)'}`));
  console.log();

  console.log(chalk.bold('Cobertura:'));
  console.log(`  ${generateProgressBar(coveragePercentage)} ${coveragePercentage}%`);
  console.log(`  Tasks: ${tasksCompleted.length}/${totalTasks} completadas`);
  console.log();

  if (filesChanged.length > 0) {
    console.log(chalk.bold('Arquivos Alterados:'));
    const totalAdded = filesChanged.reduce((sum, f) => sum + f.linesAdded, 0);
    const totalRemoved = filesChanged.reduce((sum, f) => sum + f.linesRemoved, 0);
    console.log(chalk.gray(`  ${filesChanged.length} arquivos (+${totalAdded}, -${totalRemoved})`));
    for (const file of filesChanged.slice(0, 5)) {
      console.log(`    ${file.filePath}`);
    }
    if (filesChanged.length > 5) {
      console.log(chalk.gray(`    ... +${filesChanged.length - 5} more`));
    }
    console.log();
  }

  if (tasksPending.length > 0) {
    console.log(chalk.yellow('⚠ Tasks Pendentes:'));
    for (const task of tasksPending.slice(0, 5)) {
      console.log(`  - [ ] ${task}`);
    }
    if (tasksPending.length > 5) {
      console.log(chalk.gray(`  ... +${tasksPending.length - 5} more`));
    }
    console.log();
  }

  if (violations.length > 0) {
    console.log(chalk.red('❌ Violações:'));
    for (const v of violations) {
      console.log(`  - ${v.rule}: ${v.violatedBy}`);
    }
    console.log();
  }

  if (recommendation === 'complete') {
    console.log(chalk.green('✅ FEATURE COMPLETA'));
    console.log(chalk.gray('   Próximo passo: Merge para branch principal'));
  } else if (recommendation === 'needs-followup') {
    console.log(chalk.yellow('⚠️ REQUER FOLLOW-UP'));
    console.log(chalk.gray('   Próximo passo: Complete as tasks pendentes'));
  } else {
    console.log(chalk.red('❌ REQUER REVISÃO'));
    console.log(chalk.gray('   Próximo passo: Corrija as violações'));
  }
  console.log();

  const validationPath = join(featureDir, migration.folder, 'validation.md');
  const validationMd = `# Validação: Migration ${migrationId}

> Feature: ${meta.featureName}
> Validado em: ${validation.createdAt}
> Status: ${recommendation}

## Expectativa

> ${expectation.summary || '(não definida)'}

## Cobertura

**${coveragePercentage}%** - ${tasksCompleted.length}/${totalTasks} tasks

## Tasks Completadas

${tasksCompleted.map((t) => `- [x] ${t}`).join('\n') || '(nenhuma)'}

## Tasks Pendentes

${tasksPending.map((t) => `- [ ] ${t}`).join('\n') || '(nenhuma)'}

## Arquivos Alterados

${filesChanged.map((f) => `- ${f.filePath} (+${f.linesAdded}, -${f.linesRemoved})`).join('\n') || '(nenhum)'}

## Recomendação

${recommendation === 'complete' ? '✅ Feature completa' : recommendation === 'needs-followup' ? '⚠️ Requer follow-up' : '❌ Requer revisão'}
`;

  writeFileSync(validationPath, validationMd, 'utf-8');
  console.log(chalk.green(`✓ Validação salva em: ${validationPath}`));
  console.log();
}

import { existsSync, readdirSync, mkdirSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { MigrationManager } from '../core/migration-manager.js';
import { ChangelogManager } from '../core/changelog.js';
import { formatTimestamp, getSessionTimestamp } from '../core/timestamps.js';
import { loadConfig, getMigrationFolder } from '../types/index.js';

interface MigrateOptions {
  all?: boolean;
  dryRun?: boolean;
}

export async function migrate(featureDir?: string, options: MigrateOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const specsDir = join(cwd, config.specsDir);

  if (!existsSync(specsDir)) {
    console.log(chalk.red(`\n✗ No ${config.specsDir}/ directory found.\n`));
    return;
  }

  const featuresToMigrate: string[] = [];

  if (options.all) {
    const features = readdirSync(specsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{3}-/.test(d.name))
      .map((d) => d.name);

    for (const feature of features) {
      const fDir = join(specsDir, feature);
      const metaPath = join(fDir, '_meta.json');

      if (!existsSync(metaPath) && needsMigration(fDir)) {
        featuresToMigrate.push(feature);
      }
    }
  } else if (featureDir) {
    const fDir = join(specsDir, featureDir);
    if (existsSync(fDir) && needsMigration(fDir)) {
      featuresToMigrate.push(featureDir);
    } else {
      console.log(chalk.yellow(`\n⚠ ${featureDir} does not need migration or doesn't exist.\n`));
      return;
    }
  } else {
    console.log(chalk.yellow('\n⚠ Please specify a feature directory or use --all.\n'));
    return;
  }

  if (featuresToMigrate.length === 0) {
    console.log(chalk.green('\n✨ No features need migration.\n'));
    return;
  }

  console.log(chalk.blue(`\n🔄 Migrating ${featuresToMigrate.length} feature(s)...\n`));

  for (const feature of featuresToMigrate) {
    await migrateFeature(join(specsDir, feature), feature, options.dryRun ?? false);
  }

  console.log(chalk.green('\n✨ Migration complete!\n'));
}

function needsMigration(featureDir: string): boolean {
  const metaPath = join(featureDir, '_meta.json');
  if (existsSync(metaPath)) {
    return false;
  }

  return (
    existsSync(join(featureDir, 'spec.md')) ||
    existsSync(join(featureDir, 'tasks.md')) ||
    existsSync(join(featureDir, 'plan.md'))
  );
}

async function migrateFeature(featureDir: string, featureName: string, dryRun: boolean): Promise<void> {
  console.log(chalk.cyan(`📦 ${featureName}`));

  const match = featureName.match(/^(\d{3})-(.+)$/);
  const featureId = match ? match[1] : '000';
  const featureShortName = match ? match[2] : featureName;

  if (dryRun) {
    console.log(chalk.gray('  [dry-run] Would create:'));
    console.log(chalk.gray('    - _meta.json'));
    console.log(chalk.gray('    - CHANGELOG.md'));
    console.log(chalk.gray('    - 001_timestamp/ (initial migration)'));
    return;
  }

  const now = formatTimestamp();
  const sessionTimestamp = getSessionTimestamp();
  const migrationId = '001';
  const migrationFolder = getMigrationFolder(migrationId, sessionTimestamp);
  const migrationDir = join(featureDir, migrationFolder);

  mkdirSync(migrationDir, { recursive: true });

  const specPath = join(featureDir, 'spec.md');
  if (!existsSync(specPath)) {
    const defaultSpec = `# ${featureShortName}\n\nMigrated from legacy structure.\n`;
    writeFileSync(specPath, defaultSpec, 'utf-8');
    console.log(chalk.green('  ✓'), 'Created spec.md');
  } else {
    console.log(chalk.green('  ✓'), 'spec.md exists');
  }

  const planPath = join(featureDir, 'plan.md');
  if (existsSync(planPath)) {
    const planContent = readFileSync(planPath, 'utf-8');
    const decisionsContent = extractDecisions(planContent);
    writeFileSync(join(migrationDir, 'decisions.md'), decisionsContent, 'utf-8');
    renameSync(planPath, join(migrationDir, 'plan-archive.md'));
    console.log(chalk.green('  ✓'), `Moved plan.md → ${migrationFolder}/plan-archive.md`);
    console.log(chalk.green('  ✓'), `Created ${migrationFolder}/decisions.md`);
  }

  const tasksPath = join(featureDir, 'tasks.md');
  let tasksTotal = 0;
  let tasksCompleted = 0;

  if (existsSync(tasksPath)) {
    const tasksContent = readFileSync(tasksPath, 'utf-8');
    const { newContent, total, completed } = convertTaskIds(tasksContent, migrationId);
    tasksTotal = total;
    tasksCompleted = completed;
    writeFileSync(join(migrationDir, 'tasks.md'), newContent, 'utf-8');
    renameSync(tasksPath, join(featureDir, 'tasks-legacy.md'));
    console.log(chalk.green('  ✓'), `Converted tasks.md → ${migrationFolder}/tasks.md`);
  }

  const researchPath = join(featureDir, 'research.md');
  if (existsSync(researchPath)) {
    renameSync(researchPath, join(migrationDir, 'research.md'));
    console.log(chalk.green('  ✓'), `Moved research.md → ${migrationFolder}/`);
  }

  const mm = new MigrationManager(featureDir);
  mm.initFeature(featureId, featureShortName, featureName);

  const meta = mm.loadMeta();
  if (meta) {
    meta.currentMigration = migrationId;
    meta.migrations[migrationId] = {
      id: migrationId,
      timestamp: sessionTimestamp,
      folder: migrationFolder,
      status: tasksCompleted >= tasksTotal && tasksTotal > 0 ? 'completed' : 'in-progress',
      tasksTotal,
      tasksCompleted,
      createdAt: now,
      completedAt: tasksCompleted >= tasksTotal && tasksTotal > 0 ? now : undefined,
    };
    writeFileSync(join(featureDir, '_meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
  }

  console.log(chalk.green('  ✓'), 'Created _meta.json');

  const changelog = new ChangelogManager(featureDir);
  changelog.init(featureId, featureShortName);
  changelog.addEntry('Migration', [
    'Migrated from legacy speckit structure to SEDD migration-based structure',
    `Initial migration: ${migrationId}`,
    `Tasks: ${tasksCompleted}/${tasksTotal} completed`,
  ]);
  console.log(chalk.green('  ✓'), 'Created CHANGELOG.md');

  console.log();
}

function extractDecisions(planContent: string): string {
  const lines = planContent.split('\n');
  const decisions: string[] = [];

  let inDecisionSection = false;

  for (const line of lines) {
    if (line.match(/^##.*decision|choice|approach/i)) {
      inDecisionSection = true;
    } else if (line.match(/^##/)) {
      inDecisionSection = false;
    }

    if (inDecisionSection && line.trim()) {
      decisions.push(line);
    }
  }

  let content = '# Decisions\n\n';
  content += 'Decisions extracted during migration.\n\n';

  if (decisions.length > 0) {
    content += decisions.join('\n') + '\n';
  } else {
    content += 'No specific decisions extracted. Review plan-archive.md for details.\n';
  }

  return content;
}

function convertTaskIds(
  content: string,
  migrationId: string
): { newContent: string; total: number; completed: number } {
  const lines = content.split('\n');
  const newLines: string[] = [];
  let taskNum = 0;
  let completed = 0;

  for (const line of lines) {
    const pendingMatch = line.match(/^(\s*-\s*\[\s*\])\s*(T\d+)?\s*(.+)$/);
    const completedMatch = line.match(/^(\s*-\s*\[x\])\s*(T\d+)?\s*(.+)$/i);

    if (pendingMatch) {
      taskNum++;
      const taskId = `T${migrationId}-${taskNum.toString().padStart(3, '0')}`;
      newLines.push(`${pendingMatch[1]} ${taskId} ${pendingMatch[3]}`);
    } else if (completedMatch) {
      taskNum++;
      completed++;
      const taskId = `T${migrationId}-${taskNum.toString().padStart(3, '0')}`;
      newLines.push(`${completedMatch[1]} ${taskId} ${completedMatch[3]}`);
    } else {
      newLines.push(line);
    }
  }

  return {
    newContent: newLines.join('\n'),
    total: taskNum,
    completed,
  };
}

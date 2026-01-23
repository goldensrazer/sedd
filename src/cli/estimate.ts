import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { GitOperations } from '../utils/git.js';
import { MigrationManager } from '../core/migration-manager.js';
import { loadConfig } from '../types/index.js';

interface EstimateOptions {
  path?: string;
  description?: string;
  json?: boolean;
}

interface EstimationItem {
  taskId: string;
  description: string;
  humanHours: number;
  aiHours: number;
  totalHours: number;
  confidence: number;
  complexity: 'XS' | 'S' | 'M' | 'L' | 'XL';
}

interface Estimation {
  featureId: string;
  featureName: string;
  createdAt: string;
  totalHours: number;
  humanHours: number;
  aiHours: number;
  complexity: 'XS' | 'S' | 'M' | 'L' | 'XL';
  averageConfidence: number;
  breakdown: EstimationItem[];
  contextPath?: string;
  risks: string[];
  assumptions: string[];
}

function calculateComplexity(hours: number): 'XS' | 'S' | 'M' | 'L' | 'XL' {
  if (hours <= 2) return 'XS';
  if (hours <= 4) return 'S';
  if (hours <= 8) return 'M';
  if (hours <= 16) return 'L';
  return 'XL';
}

function generateProgressBar(percent: number, width: number = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export async function estimate(options: EstimateOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const git = new GitOperations(cwd);
  const config = loadConfig(cwd);
  const specsDir = join(cwd, config.specsDir);

  if (!existsSync(specsDir)) {
    console.log(chalk.yellow(`\n⚠ No ${config.specsDir}/ directory found. Run "sedd init" first.\n`));
    return;
  }

  // Find current feature
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
    console.log(chalk.yellow('\n⚠ No features found. Use /sedd.specify to create one.\n'));
    return;
  }

  const featureDir = join(specsDir, currentFeature);
  const mm = new MigrationManager(featureDir);
  const meta = mm.loadMeta();

  if (!meta) {
    console.log(chalk.yellow('⚠ This feature uses the old structure. Run sedd migrate first.'));
    return;
  }

  // Load tasks from current migration
  const breakdown: EstimationItem[] = [];
  let totalHuman = 0;
  let totalAi = 0;

  if (meta.currentMigration) {
    const migration = meta.migrations[meta.currentMigration];
    if (migration) {
      const tasksPath = join(featureDir, migration.folder, 'tasks.md');
      if (existsSync(tasksPath)) {
        const content = readFileSync(tasksPath, 'utf-8');
        const taskLines = content.match(/- \[ \] (T\d{3}-\d{3}) \[([^\]]+)\] (.+)/g) || [];

        for (const line of taskLines) {
          const match = line.match(/- \[ \] (T\d{3}-\d{3}) \[([^\]]+)\] (.+)/);
          if (match) {
            const [, taskId, category, description] = match;

            // Estimate based on category
            let human = 1;
            let ai = 2;

            if (category === 'Foundation') {
              human = 0.5;
              ai = 1.5;
            } else if (category.startsWith('US')) {
              human = 1;
              ai = 3;
            } else if (category === 'Tests') {
              human = 0.5;
              ai = 2;
            }

            const total = human + ai;
            totalHuman += human;
            totalAi += ai;

            breakdown.push({
              taskId,
              description: description.split('`')[0].trim(),
              humanHours: human,
              aiHours: ai,
              totalHours: total,
              confidence: 75,
              complexity: calculateComplexity(total),
            });
          }
        }
      }
    }
  }

  // If no tasks, estimate from spec
  if (breakdown.length === 0) {
    const specPath = join(featureDir, 'spec.md');
    if (existsSync(specPath)) {
      const content = readFileSync(specPath, 'utf-8');
      const userStories = (content.match(/### US\d+:/g) || []).length;
      const requirements = (content.match(/\| FR-\d{3}/g) || []).length;

      // Estimate based on spec content
      const estimatedTasks = Math.max(userStories * 2, requirements);
      totalHuman = estimatedTasks * 1;
      totalAi = estimatedTasks * 2;

      breakdown.push({
        taskId: 'SPEC-EST',
        description: `Estimated from ${userStories} user stories, ${requirements} requirements`,
        humanHours: totalHuman,
        aiHours: totalAi,
        totalHours: totalHuman + totalAi,
        confidence: 60,
        complexity: calculateComplexity(totalHuman + totalAi),
      });
    }
  }

  const totalHours = totalHuman + totalAi;
  const avgConfidence = breakdown.length > 0
    ? Math.round(breakdown.reduce((sum, b) => sum + b.confidence, 0) / breakdown.length)
    : 0;

  const estimation: Estimation = {
    featureId: meta.featureId,
    featureName: meta.featureName,
    createdAt: new Date().toISOString(),
    totalHours,
    humanHours: totalHuman,
    aiHours: totalAi,
    complexity: calculateComplexity(totalHours),
    averageConfidence: avgConfidence,
    breakdown,
    contextPath: options.path,
    risks: [],
    assumptions: [
      'AI assistant available for implementation',
      'No major blockers or dependencies',
      'Existing codebase patterns can be followed',
    ],
  };

  if (options.json) {
    console.log(JSON.stringify(estimation, null, 2));
    return;
  }

  // Display estimation
  console.log(chalk.blue(`\n📊 Estimativa: ${meta.featureName}\n`));

  const humanPercent = Math.round((totalHuman / totalHours) * 100) || 0;
  const aiPercent = 100 - humanPercent;

  console.log(chalk.bold('Resumo:'));
  console.log(`  Total:       ${chalk.cyan(totalHours + 'h')}`);
  console.log(`  Humano:      ${chalk.yellow(totalHuman + 'h')} (${humanPercent}%)`);
  console.log(`  AI:          ${chalk.green(totalAi + 'h')} (${aiPercent}%)`);
  console.log(`  Complexidade: ${chalk.magenta(estimation.complexity)}`);
  console.log(`  Confiança:   ${chalk.gray(avgConfidence + '%')}`);
  console.log();

  console.log(chalk.bold('Distribuição:'));
  console.log(`  Humano: ${generateProgressBar(humanPercent)} ${humanPercent}%`);
  console.log(`  AI:     ${generateProgressBar(aiPercent)} ${aiPercent}%`);
  console.log();

  if (breakdown.length > 0 && breakdown[0].taskId !== 'SPEC-EST') {
    console.log(chalk.bold('Breakdown por Task:'));
    console.log(chalk.gray('  Task       | Humano | AI    | Total | Conf'));
    console.log(chalk.gray('  -----------|--------|-------|-------|-----'));
    for (const item of breakdown.slice(0, 10)) {
      console.log(
        `  ${item.taskId} | ${item.humanHours}h     | ${item.aiHours}h    | ${item.totalHours}h    | ${item.confidence}%`
      );
    }
    if (breakdown.length > 10) {
      console.log(chalk.gray(`  ... +${breakdown.length - 10} more`));
    }
    console.log();
  }

  // Save estimate.md
  const estimatePath = join(featureDir, 'estimate.md');
  const estimateMd = `# Estimativa: ${meta.featureName}

> Feature ID: ${meta.featureId}
> Gerado: ${estimation.createdAt}
> Confiança Média: ${avgConfidence}%

## Resumo

| Métrica | Valor |
|---------|-------|
| **Total** | ${totalHours}h |
| **Humano** | ${totalHuman}h (${humanPercent}%) |
| **AI** | ${totalAi}h (${aiPercent}%) |
| **Complexidade** | ${estimation.complexity} |

## Breakdown

| Task | Descrição | Humano | AI | Total |
|------|-----------|--------|-----|-------|
${breakdown.map((b) => `| ${b.taskId} | ${b.description} | ${b.humanHours}h | ${b.aiHours}h | ${b.totalHours}h |`).join('\n')}

## Premissas

${estimation.assumptions.map((a) => `- ${a}`).join('\n')}
`;

  writeFileSync(estimatePath, estimateMd, 'utf-8');
  console.log(chalk.green(`✓ Estimativa salva em: ${estimatePath}`));
  console.log();
}

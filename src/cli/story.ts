import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadConfig, type FeatureMeta } from '../types/index.js';
import { GitOperations } from '../utils/git.js';
import { GitHubOperations } from '../utils/github.js';
import { BoardManager } from '../core/board-manager.js';

interface StoryOptions {
  title?: string;
  como?: string;
  quero?: string;
  para?: string;
  expectativas?: string;
  criterios?: string;
  contexto?: string;
  labels?: string;
  fromSpec?: boolean;
}

function buildBody(opts: {
  como: string;
  quero: string;
  para: string;
  expectativas: string[];
  criterios: string[];
  contexto?: string;
}): string {
  const lines: string[] = [];

  lines.push('## Estoria de Usuario');
  lines.push('');
  lines.push(`**Como:** ${opts.como}`);
  lines.push(`**Quero:** ${opts.quero}`);
  lines.push(`**Para:** ${opts.para}`);
  lines.push('');

  if (opts.expectativas.length > 0) {
    lines.push('## Expectativas');
    lines.push('');
    for (const exp of opts.expectativas) {
      lines.push(`- **ESPERA-SE:** ${exp.trim()}`);
    }
    lines.push('');
  }

  if (opts.criterios.length > 0) {
    lines.push('## Criterios de Aceite');
    lines.push('');
    for (const crit of opts.criterios) {
      lines.push(`- [ ] ${crit.trim()}`);
    }
    lines.push('');
  }

  if (opts.contexto) {
    lines.push('## Contexto Tecnico');
    lines.push('');
    lines.push(opts.contexto);
    lines.push('');
  }

  return lines.join('\n');
}

function parseFromSpec(featureDir: string): {
  title?: string;
  como?: string;
  quero?: string;
  para?: string;
  expectativas: string[];
  criterios: string[];
  contexto?: string;
} {
  const result: ReturnType<typeof parseFromSpec> = {
    expectativas: [],
    criterios: [],
  };

  const metaPath = join(featureDir, '_meta.json');
  if (existsSync(metaPath)) {
    try {
      const meta: FeatureMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      if (meta.featureName) {
        result.title = meta.featureName.replace(/-/g, ' ');
      }
      if (typeof meta.expectation === 'string' && meta.expectation) {
        result.expectativas.push(meta.expectation);
      } else if (meta.expectation && typeof meta.expectation === 'object') {
        const exp = meta.expectation as any;
        if (exp.summary) result.expectativas.push(exp.summary);
        if (Array.isArray(exp.must)) {
          for (const m of exp.must) result.expectativas.push(m);
        }
      }
    } catch {}
  }

  const specPath = join(featureDir, 'spec.md');
  if (existsSync(specPath)) {
    const spec = readFileSync(specPath, 'utf-8');

    const asMatch = spec.match(/\*\*(?:As a|Como)\*\*\s*(.+)/i);
    const wantMatch = spec.match(/\*\*(?:I want|Quero)\*\*\s*(.+)/i);
    const soMatch = spec.match(/\*\*(?:So that|Para)\*\*\s*(.+)/i);

    if (asMatch) result.como = asMatch[1].trim();
    if (wantMatch) result.quero = wantMatch[1].trim();
    if (soMatch) result.para = soMatch[1].trim();

    const acSection = spec.match(/##?\s*(?:Acceptance Criteria|Criterios de Aceite)[\s\S]*?(?=\n##|$)/i);
    if (acSection) {
      const criteriaLines = acSection[0].match(/- \[[ x]\]\s*(.+)/g);
      if (criteriaLines) {
        for (const line of criteriaLines) {
          const cleaned = line.replace(/^- \[[ x]\]\s*/, '').trim();
          if (cleaned && !cleaned.startsWith('[') && cleaned !== 'Criterion 1' && cleaned !== 'Criterion 2') {
            result.criterios.push(cleaned);
          }
        }
      }
    }

    const techSection = spec.match(/##?\s*(?:Technical Requirements|Architecture)[\s\S]*?(?=\n##|$)/i);
    if (techSection) {
      const content = techSection[0]
        .replace(/^##?\s*(?:Technical Requirements|Architecture)\s*\n/, '')
        .trim();
      if (content && content !== '[Describe the technical approach]') {
        result.contexto = content;
      }
    }
  }

  return result;
}

export async function story(options: StoryOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const gh = new GitHubOperations(cwd);
  const bm = new BoardManager(config, cwd);

  // Verify gh CLI
  if (!gh.hasGh()) {
    console.log(chalk.red('Error:'), 'GitHub CLI (gh) is not installed.');
    console.log(chalk.gray('Install: https://cli.github.com/'));
    process.exit(1);
  }

  if (!gh.isAuthenticated()) {
    console.log(chalk.red('Error:'), 'Not authenticated with GitHub CLI.');
    console.log(chalk.gray('Run: gh auth login'));
    process.exit(1);
  }

  let title = options.title;
  let como = options.como;
  let quero = options.quero;
  let para = options.para;
  let expectativas: string[] = options.expectativas ? options.expectativas.split(';').filter(Boolean) : [];
  let criterios: string[] = options.criterios ? options.criterios.split(';').filter(Boolean) : [];
  let contexto = options.contexto;
  const labelStr = options.labels || 'user-story';
  const labels = labelStr.split(',').map(l => l.trim()).filter(Boolean);

  // --from-spec: read from current feature spec
  if (options.fromSpec) {
    const git = new GitOperations(cwd);
    const branch = git.getCurrentBranch();
    const featureDir = join(cwd, config.specsDir, branch);

    if (!existsSync(featureDir)) {
      console.log(chalk.red('Error:'), `Feature directory not found: ${featureDir}`);
      console.log(chalk.gray('Are you on a feature branch? Run sedd specify first.'));
      process.exit(1);
    }

    console.log(chalk.blue('i'), `Reading spec from: ${featureDir}`);
    const fromSpec = parseFromSpec(featureDir);

    // Merge: CLI flags take precedence over spec values
    title = title || fromSpec.title;
    como = como || fromSpec.como;
    quero = quero || fromSpec.quero;
    para = para || fromSpec.para;
    if (expectativas.length === 0 && fromSpec.expectativas.length > 0) {
      expectativas = fromSpec.expectativas;
    }
    if (criterios.length === 0 && fromSpec.criterios.length > 0) {
      criterios = fromSpec.criterios;
    }
    contexto = contexto || fromSpec.contexto;

    console.log(chalk.green('✓'), 'Loaded data from spec');
  }

  // Validate required fields
  if (!title) {
    console.log(chalk.red('Error:'), 'Missing --title');
    process.exit(1);
  }
  if (!como) {
    console.log(chalk.red('Error:'), 'Missing --como (user type)');
    process.exit(1);
  }
  if (!quero) {
    console.log(chalk.red('Error:'), 'Missing --quero (desired action)');
    process.exit(1);
  }
  if (!para) {
    console.log(chalk.red('Error:'), 'Missing --para (expected benefit)');
    process.exit(1);
  }

  // Build issue body
  const body = buildBody({
    como,
    quero,
    para,
    expectativas,
    criterios,
    contexto,
  });

  console.log(chalk.blue('i'), 'Creating GitHub issue...');

  const issue = gh.createIssue(title, body, labels);
  if (!issue) {
    console.log(chalk.red('Error:'), 'Failed to create GitHub issue.');
    console.log(chalk.gray('Check your gh CLI authentication and repository.'));
    process.exit(1);
  }

  console.log(chalk.green('✓'), `Issue #${issue.number} created: ${issue.url}`);

  // Add to GitHub Project if configured
  if (bm.isGitHubEnabled()) {
    const ghConfig = config.github!;
    if (ghConfig.project && ghConfig.owner) {
      let itemId = gh.addIssueToProject(ghConfig.project.projectId, issue.url);
      if (!itemId && ghConfig.project.projectNumber) {
        itemId = gh.findProjectItemByIssue(ghConfig.owner, ghConfig.project.projectNumber, issue.number);
      }

      if (itemId) {
        const todoCol = ghConfig.columnMapping['pending'];
        const optionId = ghConfig.columns.options[todoCol];
        if (optionId) {
          const moved = gh.moveItem(ghConfig.project.projectId, itemId, ghConfig.columns.fieldId, optionId);
          if (moved) {
            console.log(chalk.green('✓'), `Issue added to project "${ghConfig.project.title}" → ${todoCol}`);
          }
        } else {
          console.log(chalk.green('✓'), `Issue added to project "${ghConfig.project.title}"`);
        }
      } else {
        console.log(chalk.yellow('⚠'), 'Could not add issue to project board.');
      }
    }
  }

  console.log(chalk.cyan('\n✨ User story created successfully!'));
  console.log(chalk.white(`   ${issue.url}`));
}

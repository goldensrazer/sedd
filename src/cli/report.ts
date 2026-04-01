import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { GitOperations } from '../utils/git.js';
import { loadConfig } from '../types/index.js';

interface ReportOptions {
  pdf?: boolean;
  open?: boolean;
  feature?: string;
  output?: string;
}

interface TaskItem {
  id: string;
  category: string;
  description: string;
  status: 'done' | 'pending' | 'blocked';
}

interface MigrationEntry {
  id: string;
  timestamp: string;
  status: string;
  tasksTotal: number;
  tasksCompleted: number;
  expectationSummary?: string;
}

interface ChangelogEntry {
  date: string;
  items: string[];
}

function parseTasksFromContent(content: string): TaskItem[] {
  const tasks: TaskItem[] = [];
  for (const line of content.split('\n')) {
    const doneMatch = line.match(/^\s*-\s*\[x\]\s*(T\d{3}-\d{3})\s+\[([^\]]+)\]\s+(.+)/i);
    if (doneMatch) {
      tasks.push({ id: doneMatch[1], category: doneMatch[2], description: doneMatch[3].replace(/`[^`]+`/g, '').trim(), status: 'done' });
      continue;
    }
    const pendingMatch = line.match(/^\s*-\s*\[\s*\]\s*(T\d{3}-\d{3})\s+\[([^\]]+)\]\s+(.+)/);
    if (pendingMatch) {
      tasks.push({ id: pendingMatch[1], category: pendingMatch[2], description: pendingMatch[3].replace(/`[^`]+`/g, '').trim(), status: 'pending' });
    }
  }
  return tasks;
}

function parseChangelog(content: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;

  for (const line of content.split('\n')) {
    const headerMatch = line.match(/^##\s*\[(\d{4}-\d{2}-\d{2})\]\s*[-—]\s*(.+)/);
    if (headerMatch) {
      if (current) entries.push(current);
      current = { date: `${headerMatch[1]} — ${headerMatch[2]}`, items: [] };
      continue;
    }
    if (current && /^\s*-\s+/.test(line)) {
      current.items.push(line.replace(/^\s*-\s+/, '').trim());
    }
  }
  if (current) entries.push(current);
  return entries;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getColorForPercent(pct: number): string {
  if (pct >= 80) return 'green';
  if (pct >= 50) return 'yellow';
  return 'red';
}

function renderTemplate(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

function renderSectionList(items: string[], className: string): string {
  if (!items || items.length === 0) return '';
  return `<ul class="${className}">${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
}

function renderTasks(tasks: TaskItem[]): string {
  return tasks.map(t => {
    const statusClass = t.status === 'done' ? 'done' : t.status === 'blocked' ? 'blocked' : 'pending';
    const icon = t.status === 'done' ? '✓' : t.status === 'blocked' ? '!' : '';
    return `<div class="task">
        <div class="task-checkbox ${statusClass}">${icon}</div>
        <div class="task-id">${escapeHtml(t.id)}</div>
        <span class="task-category">${escapeHtml(t.category)}</span>
        <div class="task-desc">${escapeHtml(t.description)}</div>
      </div>`;
  }).join('');
}

function renderTimeline(migrations: MigrationEntry[]): string {
  return migrations.map(m => {
    const dotClass = m.status === 'completed' ? 'completed' : 'in-progress';
    return `<div class="timeline-item">
        <div class="timeline-dot ${dotClass}"></div>
        <div class="timeline-title">Migration ${escapeHtml(m.id)}</div>
        <div class="timeline-meta">${escapeHtml(m.timestamp)} — ${m.tasksCompleted}/${m.tasksTotal} tasks — ${escapeHtml(m.status)}</div>
        ${m.expectationSummary ? `<div style="font-size: 12px; color: var(--gray-700); margin-top: 4px;">${escapeHtml(m.expectationSummary)}</div>` : ''}
      </div>`;
  }).join('');
}

function renderChangelogTimeline(entries: ChangelogEntry[]): string {
  return entries.map(e => {
    const items = e.items.map(i => `<li>${escapeHtml(i)}</li>`).join('');
    return `<div class="timeline-item">
        <div class="timeline-dot completed"></div>
        <div class="timeline-title">${escapeHtml(e.date)}</div>
        <ul style="margin: 4px 0; padding-left: 16px; font-size: 13px; color: var(--gray-700);">${items}</ul>
      </div>`;
  }).join('');
}

export async function report(options: ReportOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const specsDir = config.specsDir || '.sedd';
  const git = new GitOperations(cwd);

  // Find feature directory
  let featureDir: string;
  if (options.feature) {
    featureDir = join(cwd, specsDir, options.feature);
  } else {
    const branch = git.getCurrentBranch();
    if (!branch || !/^\d{3}-/.test(branch)) {
      console.error(chalk.red('Not on a feature branch. Use --feature to specify.'));
      process.exit(1);
    }
    featureDir = join(cwd, specsDir, branch);
  }

  if (!existsSync(featureDir)) {
    console.error(chalk.red(`Feature directory not found: ${featureDir}`));
    process.exit(1);
  }

  // Load template
  const templatePath = join(cwd, specsDir, 'templates', 'report-template.html');
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const fallbackPath = join(dirname(dirname(currentDir)), 'templates', 'report-template.html');
  let templateHtml: string;

  if (existsSync(templatePath)) {
    templateHtml = readFileSync(templatePath, 'utf8');
  } else if (existsSync(fallbackPath)) {
    templateHtml = readFileSync(fallbackPath, 'utf8');
  } else {
    console.error(chalk.red('Report template not found. Run sedd update to install templates.'));
    process.exit(1);
  }

  // Load artifacts
  const metaFile = join(featureDir, '_meta.json');
  if (!existsSync(metaFile)) {
    console.error(chalk.red('_meta.json not found. Run /sedd.specify first.'));
    process.exit(1);
  }

  const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
  const featureName = meta.featureName || 'Unknown Feature';
  const featureId = meta.featureId || '???';
  const branch = meta.branch || '';

  // Parse expectation
  const expectation = meta.expectation || {};
  const expectSummary = typeof expectation === 'string' ? expectation : (expectation.summary || 'No expectation set');
  const must: string[] = (typeof expectation === 'object' ? expectation.must : []) || [];
  const mustNot: string[] = (typeof expectation === 'object' ? expectation.mustNot : []) || [];

  // Parse migrations
  const migrations: MigrationEntry[] = [];
  let allTasks: TaskItem[] = [];
  let totalCompleted = 0;
  let totalTotal = 0;

  for (const [migId, migInfo] of Object.entries(meta.migrations || {}) as [string, any][]) {
    const mig: MigrationEntry = {
      id: migId,
      timestamp: migInfo.createdAt || '',
      status: migInfo.status || 'unknown',
      tasksTotal: migInfo.tasksTotal || 0,
      tasksCompleted: migInfo.tasksCompleted || 0,
    };

    if (migInfo.expectation) {
      mig.expectationSummary = typeof migInfo.expectation === 'string'
        ? migInfo.expectation
        : migInfo.expectation.summary;
    }

    migrations.push(mig);
    totalCompleted += mig.tasksCompleted;
    totalTotal += mig.tasksTotal;

    // Load tasks from migration folder
    const tasksFile = join(featureDir, migInfo.folder || '', 'tasks.md');
    if (existsSync(tasksFile)) {
      const taskContent = readFileSync(tasksFile, 'utf8');
      allTasks.push(...parseTasksFromContent(taskContent));
    }
  }

  const tasksPct = totalTotal > 0 ? Math.round((totalCompleted / totalTotal) * 100) : 0;

  // Parse changelog
  const changelogFile = join(featureDir, 'CHANGELOG.md');
  const changelogEntries = existsSync(changelogFile)
    ? parseChangelog(readFileSync(changelogFile, 'utf8'))
    : [];

  // Architecture contract
  const contract = meta.architectureContract || {};
  const hasTechStack = contract.techStack && Object.keys(contract.techStack).length > 0;
  const hasContract = hasTechStack || (contract.locationBindings && contract.locationBindings.length > 0);

  // Validation
  const lastValidation = meta.lastValidation || {};
  const coveragePct = lastValidation.coveragePercentage || 0;
  const qualityScore = lastValidation.overallQuality || '-';

  // Git stats
  let gitFiles = 0;
  let gitAdded = 0;
  let gitRemoved = 0;
  try {
    const diffStat = execSync('git diff --stat HEAD~10..HEAD --shortstat 2>/dev/null || echo ""', { cwd, encoding: 'utf8' }).trim();
    const filesMatch = diffStat.match(/(\d+) files? changed/);
    const addMatch = diffStat.match(/(\d+) insertions?\(\+\)/);
    const delMatch = diffStat.match(/(\d+) deletions?\(-\)/);
    if (filesMatch) gitFiles = parseInt(filesMatch[1]);
    if (addMatch) gitAdded = parseInt(addMatch[1]);
    if (delMatch) gitRemoved = parseInt(delMatch[1]);
  } catch { /* ignore */ }

  // Determine status
  let status = 'Draft';
  let statusClass = 'badge-info';
  if (totalTotal > 0 && totalCompleted === totalTotal) {
    status = 'Complete';
    statusClass = 'badge-success';
  } else if (totalCompleted > 0) {
    status = 'In Progress';
    statusClass = 'badge-warning';
  }

  // Build tech stack table
  let techStackHtml = '';
  if (hasTechStack) {
    techStackHtml = Object.entries(contract.techStack).map(([layer, info]: [string, any]) => {
      return `<tr><td>${escapeHtml(layer)}</td><td><strong>${escapeHtml(info.tech || '')}</strong></td><td><code>${escapeHtml(info.location || '')}</code></td></tr>`;
    }).join('');
  }

  // Build location bindings
  let locationBindingsHtml = '';
  if (contract.locationBindings && contract.locationBindings.length > 0) {
    locationBindingsHtml = contract.locationBindings.map((b: any) =>
      `<tr><td>${escapeHtml(b.type || '')}</td><td><code>${escapeHtml(b.mustBeIn || '')}</code></td><td style="color: var(--danger);">${escapeHtml(b.neverIn || '')}</td></tr>`
    ).join('');
  }

  // Build shared contracts
  let sharedContractsHtml = '';
  if (contract.sharedContracts && contract.sharedContracts.length > 0) {
    sharedContractsHtml = contract.sharedContracts.map((c: any) =>
      `<tr><td>${escapeHtml(c.name || '')}</td><td><code>${escapeHtml(c.location || '')}</code></td><td>${escapeHtml(Array.isArray(c.usedBy) ? c.usedBy.join(', ') : (c.usedBy || ''))}</td></tr>`
    ).join('');
  }

  // Build section HTML blocks
  // -- Expectation --
  let slotExpectation = `<div class="card">
      <h2><span class="icon">🎯</span> Expectativa</h2>
      <div class="expectation-box">${escapeHtml(expectSummary)}</div>`;
  if (must.length > 0) {
    slotExpectation += `<h3>DEVE</h3><ul class="must-list">${must.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`;
  }
  if (mustNot.length > 0) {
    slotExpectation += `<h3>NAO DEVE</h3><ul class="must-not-list">${mustNot.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`;
  }
  slotExpectation += '</div>';

  // -- Contract --
  let slotContract = '';
  if (hasContract) {
    slotContract = `<div class="card"><h2><span class="icon">📜</span> Contrato de Arquitetura</h2>
      <div class="contract-section"><span class="contract-label">Imutavel</span>
        <h3>Tech Stack</h3>
        <table><thead><tr><th>Camada</th><th>Tecnologia</th><th>Localizacao</th></tr></thead>
        <tbody>${techStackHtml}</tbody></table></div>`;
    if (locationBindingsHtml) {
      slotContract += `<h3>Location Bindings</h3>
        <table><thead><tr><th>Tipo</th><th>DEVE ficar em</th><th>NUNCA em</th></tr></thead>
        <tbody>${locationBindingsHtml}</tbody></table>`;
    }
    if (sharedContractsHtml) {
      slotContract += `<h3>Shared Contracts (FE ↔ BE)</h3>
        <table><thead><tr><th>Contrato</th><th>Localizacao</th><th>Usado por</th></tr></thead>
        <tbody>${sharedContractsHtml}</tbody></table>`;
    }
    slotContract += '</div>';
  }

  // -- Migrations --
  let slotMigrations = '';
  if (migrations.length > 0) {
    slotMigrations = `<div class="card"><h2><span class="icon">🔄</span> Migrations</h2>
      <div class="timeline">${renderTimeline(migrations)}</div></div>`;
  }

  // -- Tasks --
  let slotTasks = '';
  if (allTasks.length > 0) {
    slotTasks = `<div class="card"><h2><span class="icon">✅</span> Tasks</h2>${renderTasks(allTasks)}</div>`;
  }

  // -- Changelog --
  let slotChangelog = '';
  if (changelogEntries.length > 0) {
    slotChangelog = `<div class="card"><h2><span class="icon">📋</span> Changelog</h2>
      <div class="timeline">${renderChangelogTimeline(changelogEntries)}</div></div>`;
  }

  // -- Git Stats --
  let slotGitStats = '';
  if (gitFiles > 0) {
    slotGitStats = `<div class="card"><h2><span class="icon">📊</span> Git Stats</h2>
      <div class="metrics" style="margin-bottom: 0;">
        <div class="metric"><div class="metric-value blue">${gitFiles}</div><div class="metric-label">Arquivos</div></div>
        <div class="metric"><div class="metric-value green">+${gitAdded}</div><div class="metric-label">Adicoes</div></div>
        <div class="metric"><div class="metric-value red">-${gitRemoved}</div><div class="metric-label">Remocoes</div></div>
      </div></div>`;
  }

  // Build HTML by replacing simple slots
  const replacements: Record<string, string> = {
    FEATURE_NAME: escapeHtml(featureName),
    FEATURE_ID: escapeHtml(featureId),
    BRANCH: escapeHtml(branch),
    CREATED_AT: meta.createdAt || '',
    STATUS: status,
    STATUS_CLASS: statusClass,
    TASKS_COMPLETED: String(totalCompleted),
    TASKS_TOTAL: String(totalTotal),
    TASKS_PERCENT: String(tasksPct),
    TASKS_COLOR: getColorForPercent(tasksPct),
    COVERAGE_PERCENT: String(coveragePct),
    COVERAGE_COLOR: getColorForPercent(coveragePct),
    QUALITY_SCORE: String(qualityScore),
    QUALITY_COLOR: qualityScore === '-' ? 'blue' : 'green',
    MIGRATIONS_COUNT: String(migrations.length),
    SLOT_EXPECTATION: slotExpectation,
    SLOT_CONTRACT: slotContract,
    SLOT_MIGRATIONS: slotMigrations,
    SLOT_TASKS: slotTasks,
    SLOT_CHANGELOG: slotChangelog,
    SLOT_GIT_STATS: slotGitStats,
    GENERATED_AT: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };

  let html = renderTemplate(templateHtml, replacements);

  // Write HTML
  const outputDir = options.output ? dirname(options.output) : featureDir;
  const htmlPath = options.output || join(featureDir, 'report.html');
  writeFileSync(htmlPath, html, 'utf8');
  console.log(chalk.green(`  HTML: ${htmlPath}`));

  // Generate PDF
  if (options.pdf) {
    const pdfPath = htmlPath.replace(/\.html$/, '.pdf');
    let pdfGenerated = false;

    // Strategy 1: Try puppeteer if already installed locally
    if (!pdfGenerated) {
      try {
        const puppeteerModule = 'puppeteer';
        const puppeteer = await (Function('m', 'return import(m)')(puppeteerModule)) as any;
        const browser = await puppeteer.default.launch({ headless: true });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.pdf({
          path: pdfPath,
          format: 'A4',
          margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
          printBackground: true,
        });
        await browser.close();
        pdfGenerated = true;
      } catch { /* puppeteer not available locally, try next strategy */ }
    }

    // Strategy 2: Try npx puppeteer via a temp script
    if (!pdfGenerated) {
      try {
        console.log(chalk.gray('  Gerando PDF via npx puppeteer...'));
        const tempScript = join(featureDir, '.pdf-gen.mjs');
        const scriptContent = `
import puppeteer from 'puppeteer';
import { readFileSync, unlinkSync } from 'fs';
const html = readFileSync('${htmlPath.replace(/\\/g, '/')}', 'utf8');
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
await page.pdf({ path: '${pdfPath.replace(/\\/g, '/')}', format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }, printBackground: true });
await browser.close();
try { unlinkSync('${tempScript.replace(/\\/g, '/')}'); } catch {}
`;
        writeFileSync(tempScript, scriptContent, 'utf8');
        execSync(`npx puppeteer browsers install chrome 2>/dev/null; node "${tempScript}"`, {
          cwd,
          stdio: 'pipe',
          timeout: 120000,
        });
        pdfGenerated = true;
      } catch {
        // Clean up temp script
        try { execSync(`rm -f "${join(featureDir, '.pdf-gen.mjs')}"`, { stdio: 'ignore' }); } catch {}
      }
    }

    if (pdfGenerated) {
      console.log(chalk.green(`  PDF:  ${pdfPath}`));
    } else {
      console.log(chalk.yellow('  PDF: Nao foi possivel gerar. Instale puppeteer: npx puppeteer browsers install chrome'));
      console.log(chalk.gray('       Ou abra o HTML no browser e use Ctrl+P para salvar como PDF.'));
    }
  }

  // Open in browser
  if (options.open) {
    try {
      const openCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      execSync(`${openCmd} "${htmlPath}"`, { stdio: 'ignore' });
    } catch { /* ignore */ }
  }

  // Summary
  console.log('');
  console.log(chalk.cyan.bold('  Report gerado!'));
  console.log('');
  console.log(`  Feature: ${chalk.white.bold(featureName)} (${featureId})`);
  console.log(`  Status:  ${status}`);
  console.log(`  Tasks:   ${totalCompleted}/${totalTotal} (${tasksPct}%)`);
  if (coveragePct > 0) console.log(`  Coverage: ${coveragePct}%`);
  if (qualityScore !== '-') console.log(`  Quality: ${qualityScore}`);
}

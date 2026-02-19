#!/usr/bin/env node
/**
 * SEDD Hook - UserPromptSubmit
 * Task count display and expectation tracking for feature branches
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DEFAULT_CONFIG = {
  specsDir: '.sedd',
};

const IGNORE_PATTERNS = [
  /^\/\w+/,
  /^\s*(oi|hi|hello|hey)\s*$/i,
  /^\s*(obrigado|thanks?|thx)\s*$/i,
  /^(sim|yes|no|não|ok|okay)\s*$/i,
  /^\s*\?\s*$/,
  /^q\d+:/i,
  /^(a|b|c|d|e)\s*$/i,
  /^continue\s*$/i,
  /^prossiga\s*$/i,
];

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'can', 'will', 'should', 'must',
  'to', 'for', 'in', 'on', 'at', 'by', 'with', 'and', 'or', 'but',
  'user', 'users', 'system', 'be', 'have', 'has', 'it', 'its', 'of',
  'that', 'this', 'from', 'as', 'when', 'if', 'then', 'so', 'do',
]);

// T001-024: keyword→skill mapping
const SKILL_KEYWORDS = [
  { patterns: [/\bimplement/i, /\bexecut/i, /\bcodar/i, /\bcodific/i], skill: '/sedd.implement', desc: 'Execute Tasks' },
  { patterns: [/\bvalid/i, /\bverific/i, /\bcheck\s+impl/i], skill: '/sedd.validate', desc: 'Validate Implementation' },
  { patterns: [/\bestim/i, /\besfor[cç]o/i, /\beffort/i], skill: '/sedd.estimate', desc: 'Estimate Effort' },
  { patterns: [/\bcri(ar|e)\s+(issue|story|hist[oó]ria)/i, /\bstory\b/i], skill: '/sedd.story', desc: 'Create GitHub Issue' },
  { patterns: [/\bboard\b/i, /\bkanban\b/i, /\bquadro\b/i], skill: '/sedd.board', desc: 'View Kanban Board' },
  { patterns: [/\bspecif/i, /\bespecif/i, /\bspec\b/i], skill: '/sedd.specify', desc: 'Create Specification' },
  { patterns: [/\bclarif/i, /\bclaread/i, /\bclare/i], skill: '/sedd.clarify', desc: 'Clarify & Generate Tasks' },
  { patterns: [/\btask/i, /\btarefa/i], skill: '/sedd.tasks', desc: 'Generate Tasks' },
  { patterns: [/\bdashboard\b/i, /\bstatus\b/i, /\bpainel\b/i], skill: '/sedd.dashboard', desc: 'Status Overview' },
];

const loadConfig = (cwd) => {
  const configPath = path.join(cwd, 'sedd.config.json');
  if (!fs.existsSync(configPath)) return DEFAULT_CONFIG;

  try {
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch {
    return DEFAULT_CONFIG;
  }
};

const getCurrentBranch = (cwd) => {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const isFeatureBranch = (branch) => /^\d{3}-/.test(branch);

const shouldIgnorePrompt = (prompt) => IGNORE_PATTERNS.some((p) => p.test(prompt));

const parseTasksFromContent = (content, migrationId) => {
  const pending = [];
  let completed = 0;

  for (const line of content.split('\n')) {
    const pendingMatch = line.match(/^\s*-\s*\[\s*\]\s*(T\d{3}-\d{3})\s+(.+)/);
    if (pendingMatch) {
      pending.push({
        id: pendingMatch[1],
        migration: migrationId,
        text: pendingMatch[2].replace(/`[^`]+`/g, '').trim(),
      });
      continue;
    }

    if (/^\s*-\s*\[x\]\s*T\d{3}-\d{3}/i.test(line)) {
      completed++;
    }
  }

  return { pending, completed };
};

const parseTasksFromMigrations = (featureDir, metaData) => {
  const currentMigration = metaData.currentMigration;

  if (currentMigration) {
    const migInfo = metaData.migrations?.[currentMigration];
    if (migInfo?.status === 'completed') {
      let totalCompleted = 0;
      for (const m of Object.values(metaData.migrations || {})) {
        totalCompleted += m.tasksCompleted || 0;
      }
      return { pending: [], completed: totalCompleted };
    }

    const tasksFile = path.join(featureDir, migInfo?.folder || '', 'tasks.md');
    if (fs.existsSync(tasksFile)) {
      const content = fs.readFileSync(tasksFile, 'utf8');
      const { pending, completed } = parseTasksFromContent(content, currentMigration);

      let prevCompleted = 0;
      for (const [migId, m] of Object.entries(metaData.migrations || {})) {
        if (migId !== currentMigration && m.status === 'completed') {
          prevCompleted += m.tasksCompleted || 0;
        }
      }

      return { pending, completed: completed + prevCompleted };
    }
  }

  const allPending = [];
  let totalCompleted = 0;

  for (const [migId, migInfo] of Object.entries(metaData.migrations || {})) {
    const tasksFile = path.join(featureDir, migInfo.folder, 'tasks.md');
    if (!fs.existsSync(tasksFile)) continue;

    const content = fs.readFileSync(tasksFile, 'utf8');
    const { pending, completed } = parseTasksFromContent(content, migId);
    allPending.push(...pending);
    totalCompleted += completed;
  }

  return { pending: allPending, completed: totalCompleted };
};

const parseTasksFromLegacy = (featureDir) => {
  const tasksFile = path.join(featureDir, 'tasks.md');
  if (!fs.existsSync(tasksFile)) return { pending: [], completed: 0 };

  const content = fs.readFileSync(tasksFile, 'utf8');
  return parseTasksFromContent(content, null);
};

const findFeatureDir = (cwd, specsDir, branch) => {
  const primaryDir = path.join(cwd, specsDir, branch);
  if (fs.existsSync(primaryDir)) return primaryDir;

  const legacyDir = path.join(cwd, 'specs', branch);
  if (fs.existsSync(legacyDir)) return legacyDir;

  return null;
};

const calculateAlignmentScore = (expectation, tasks) => {
  if (!expectation || tasks.length === 0) return 0;

  const tokens = expectation
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  if (tokens.length === 0) return 100;

  const taskText = tasks.map((t) => t.text.toLowerCase()).join(' ');
  const matches = tokens.filter((token) => taskText.includes(token));

  return Math.round((matches.length / tokens.length) * 100);
};

const getScoreEmoji = (score) => {
  if (score >= 80) return '🟢';
  if (score >= 60) return '🟡';
  return '🔴';
};

const getExpectationSummary = (expectation) => {
  if (!expectation) return null;
  if (typeof expectation === 'string') return expectation;
  return expectation.summary || null;
};

const getMustNotList = (expectation) => {
  if (!expectation || typeof expectation === 'string') return [];
  return expectation.mustNot || [];
};

// T001-024/025: Detect skill suggestion from user prompt
const detectSkillSuggestion = (prompt) => {
  const lower = prompt.toLowerCase();
  for (const entry of SKILL_KEYWORDS) {
    if (entry.patterns.some((p) => p.test(lower))) {
      return entry;
    }
  }
  return null;
};

const buildSeddContext = (branch, currentMigration, completed, pending, featureExpectation, migrationExpectation) => {
  const featureSummary = getExpectationSummary(featureExpectation);
  const migrationSummary = getExpectationSummary(migrationExpectation);
  const mustNotList = getMustNotList(migrationExpectation) || getMustNotList(featureExpectation);

  if (pending.length === 0 && !featureSummary && !migrationSummary) return null;

  const total = completed + pending.length;
  const migrationInfo = currentMigration ? ` | Migration: ${currentMigration}` : '';

  let expectationBlock = '';
  const activeExpectation = migrationSummary || featureSummary;

  if (featureSummary && migrationSummary && featureSummary !== migrationSummary) {
    expectationBlock = `
🎯 **FEATURE:** ${featureSummary}
📍 **MIGRATION ${currentMigration}:** ${migrationSummary}
`;
  } else if (activeExpectation) {
    const prefix = migrationSummary ? `📍 M${currentMigration}` : '🎯';
    expectationBlock = `\n${prefix} **EXPECTATIVA:** ${activeExpectation}\n`;
  }

  // Add mustNot block if restrictions exist
  let mustNotBlock = '';
  if (mustNotList.length > 0) {
    const restrictions = mustNotList.map((item) => `- ❌ ${item}`).join('\n');
    mustNotBlock = `
⛔ **NÃO DEVE:**
${restrictions}
`;
  }

  let scoreBlock = '';
  if (activeExpectation && pending.length > 0) {
    const score = calculateAlignmentScore(activeExpectation, pending);
    const emoji = getScoreEmoji(score);
    scoreBlock = ` ${emoji} ~${score}%`;
  }

  if (pending.length === 0) {
    return `<sedd-context>
**Branch: ${branch}**${migrationInfo}${expectationBlock}${mustNotBlock}
</sedd-context>`;
  }

  // T001-027: Progressive disclosure - 3 detailed, rest compact
  const DETAILED_COUNT = 3;
  const detailedTasks = pending.slice(0, DETAILED_COUNT).map((t) => {
    const truncated = t.text.length > 60 ? `${t.text.substring(0, 60)}...` : t.text;
    return `- ${t.id}: ${truncated}`;
  }).join('\n');

  const compactTasks = pending.slice(DETAILED_COUNT, DETAILED_COUNT + 10);
  const compactLine = compactTasks.length > 0
    ? `\n> Queued: ${compactTasks.map((t) => t.id).join(', ')}`
    : '';

  const remainingCount = pending.length - DETAILED_COUNT - compactTasks.length;
  const moreText = remainingCount > 0 ? `\n... +${remainingCount} more` : '';

  const tasksList = detailedTasks;

  return `<sedd-context>
**Branch: ${branch}**${migrationInfo} | Progress: ${completed}/${total} tasks${scoreBlock}
${expectationBlock}${mustNotBlock}
Pending tasks:
${tasksList}${compactLine}${moreText}
</sedd-context>`;
};

const main = () => {
  let inputData = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { inputData += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(inputData);
      const prompt = data.prompt || '';
      const cwd = data.cwd || process.cwd();

      if (!prompt || shouldIgnorePrompt(prompt)) return;

      const config = loadConfig(cwd);
      const specsDir = config.specsDir || '.sedd';

      const branch = getCurrentBranch(cwd);
      if (!isFeatureBranch(branch)) return;

      const featureDir = findFeatureDir(cwd, specsDir, branch);
      if (!featureDir) return;

      const metaFile = path.join(featureDir, '_meta.json');
      let pending = [];
      let completed = 0;
      let currentMigration = null;
      let featureExpectation = null;
      let migrationExpectation = null;

      if (fs.existsSync(metaFile)) {
        const metaData = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        currentMigration = metaData.currentMigration;
        featureExpectation = metaData.expectation || null;

        if (currentMigration && metaData.migrations?.[currentMigration]?.expectation) {
          migrationExpectation = metaData.migrations[currentMigration].expectation;
        }

        const result = parseTasksFromMigrations(featureDir, metaData);
        pending = result.pending;
        completed = result.completed;
      } else {
        const result = parseTasksFromLegacy(featureDir);
        pending = result.pending;
        completed = result.completed;
      }

      const context = buildSeddContext(branch, currentMigration, completed, pending, featureExpectation, migrationExpectation);

      // T001-024/025: Detect skill suggestion from prompt
      const skillMatch = detectSkillSuggestion(prompt);
      let skillSuggestion = '';
      if (skillMatch) {
        const assertive = config.hooks?.assertive === true;
        if (assertive) {
          skillSuggestion = `\n<sedd-skill-hint>\nUSE ${skillMatch.skill} (${skillMatch.desc}) para esta tarefa. Execute o skill ANTES de qualquer outra acao.\n</sedd-skill-hint>`;
        } else {
          skillSuggestion = `\n<sedd-skill-hint>\nDica: ${skillMatch.skill} (${skillMatch.desc}) pode ser util para esta tarefa.\n</sedd-skill-hint>`;
        }
      }

      const message = (context || '') + skillSuggestion;
      if (message.trim()) {
        console.log(JSON.stringify({ systemMessage: '\n' + message + '\n' }));
      }
    } catch {
      return;
    }
  });
};

main();

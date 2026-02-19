#!/usr/bin/env node
/**
 * SEDD Hook - SessionStart (startup | resume | compact)
 * Re-injects SEDD context after compaction and on session start.
 * - On compact: restores full context from .session-context.json
 * - On startup/resume: injects skills reminder block
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SEDD_SKILLS = [
  '/sedd.specify - Create Feature Specification',
  '/sedd.clarify - Clarify & Generate Tasks',
  '/sedd.tasks - Generate Tasks',
  '/sedd.implement - Execute Tasks',
  '/sedd.validate - Validate Implementation',
  '/sedd.estimate - Estimate Effort',
  '/sedd.story - Create GitHub Issue',
  '/sedd.board - View Kanban Board',
  '/sedd.dashboard - Status Overview',
];

const loadConfig = (cwd) => {
  const configPath = path.join(cwd, 'sedd.config.json');
  if (!fs.existsSync(configPath)) return { specsDir: '.sedd' };
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch { return { specsDir: '.sedd' }; }
};

const getCurrentBranch = (cwd) => {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8' }).trim();
  } catch { return ''; }
};

const isFeatureBranch = (branch) => /^\d{3}-/.test(branch);

const findFeatureDir = (cwd, specsDir, branch) => {
  const primary = path.join(cwd, specsDir, branch);
  if (fs.existsSync(primary)) return primary;
  const legacy = path.join(cwd, 'specs', branch);
  if (fs.existsSync(legacy)) return legacy;
  return null;
};

const buildSkillsBlock = () => {
  const skills = SEDD_SKILLS.map(s => `  ${s}`).join('\n');
  return `<sedd-skills>\nSkills SEDD disponiveis neste projeto:\n${skills}\nUse-as SEMPRE que a tarefa se encaixar.\n</sedd-skills>`;
};

const buildRecoveryBlock = (contextData, branch) => {
  const lines = ['<sedd-recovery>', '**CONTEXTO RESTAURADO APOS COMPRESSAO**', ''];

  lines.push(`Branch: ${branch}`);
  if (contextData.migrationId) lines.push(`Migration: ${contextData.migrationId}`);

  if (contextData.expectation) {
    const exp = typeof contextData.expectation === 'string'
      ? contextData.expectation
      : contextData.expectation.summary || '';
    if (exp) lines.push('', `EXPECTATIVA: ${exp}`);

    const mustNot = typeof contextData.expectation === 'object'
      ? contextData.expectation.mustNot || []
      : [];
    if (mustNot.length > 0) {
      lines.push('', 'NAO DEVE:');
      mustNot.forEach(item => lines.push(`- ${item}`));
    }
  }

  if (contextData.pendingTasks && contextData.pendingTasks.length > 0) {
    lines.push('', 'Tasks pendentes:');
    contextData.pendingTasks.slice(0, 5).forEach(t => {
      lines.push(`- ${t.id}: ${t.description}`);
    });
    if (contextData.pendingTasks.length > 5) {
      lines.push(`... e mais ${contextData.pendingTasks.length - 5}`);
    }
  }

  if (contextData.lastAction) {
    lines.push('', `Ultima acao: ${contextData.lastAction}`);
  }

  lines.push('', buildSkillsBlock(), '</sedd-recovery>');
  return lines.join('\n');
};

const main = () => {
  let inputData = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { inputData += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(inputData);
      const cwd = data.cwd || process.cwd();
      const trigger = data.trigger || 'startup';

      const config = loadConfig(cwd);
      const specsDir = config.specsDir || '.sedd';
      const branch = getCurrentBranch(cwd);

      if (!isFeatureBranch(branch)) {
        // Still inject skills even outside feature branch
        console.log(buildSkillsBlock());
        return;
      }

      const featureDir = findFeatureDir(cwd, specsDir, branch);

      if (trigger === 'compact' && featureDir) {
        // Try to load saved context from PreCompact hook
        const contextFile = path.join(featureDir, '.session-context.json');
        if (fs.existsSync(contextFile)) {
          const contextData = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
          console.log(buildRecoveryBlock(contextData, branch));
          return;
        }
      }

      // For startup/resume or compact without saved context: inject skills + basic context
      const metaFile = path.join(featureDir || '', '_meta.json');
      let context = buildSkillsBlock();

      if (featureDir && fs.existsSync(metaFile)) {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        const exp = meta.expectation
          ? (typeof meta.expectation === 'string' ? meta.expectation : meta.expectation.summary || '')
          : '';
        if (exp) {
          context += `\n<sedd-context>\nBranch: ${branch} | Migration: ${meta.currentMigration || 'none'}\nEXPECTATIVA: ${exp}\n</sedd-context>`;
        }
      }

      console.log(context);
    } catch {
      // Silent fail - don't block session start
    }
  });
};

main();

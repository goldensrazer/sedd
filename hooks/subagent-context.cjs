#!/usr/bin/env node
/**
 * SEDD Hook - SubagentStart
 * Injects <sedd-context> into subagents so they don't lose feature context.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

const main = () => {
  let inputData = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { inputData += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(inputData);
      const cwd = data.cwd || process.cwd();

      const config = loadConfig(cwd);
      const specsDir = config.specsDir || '.sedd';
      const branch = getCurrentBranch(cwd);

      if (!isFeatureBranch(branch)) return;

      const featureDir = findFeatureDir(cwd, specsDir, branch);
      if (!featureDir) return;

      const metaFile = path.join(featureDir, '_meta.json');
      if (!fs.existsSync(metaFile)) return;

      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      const migrationId = meta.currentMigration;

      const exp = meta.expectation
        ? (typeof meta.expectation === 'string' ? meta.expectation : (meta.expectation.summary || ''))
        : '';

      const lines = [
        '<sedd-context>',
        `Branch: ${branch} | Migration: ${migrationId || 'none'}`,
      ];

      if (exp) lines.push(`EXPECTATIVA: ${exp}`);

      // Add mustNot if available
      const migExp = migrationId && meta.migrations[migrationId]?.expectation;
      const mustNot = (migExp && typeof migExp === 'object') ? migExp.mustNot || [] : [];
      if (mustNot.length > 0) {
        lines.push('NAO DEVE:');
        mustNot.forEach(item => lines.push(`- ${item}`));
      }

      lines.push('</sedd-context>');

      console.log(JSON.stringify({ systemMessage: lines.join('\n') }));
    } catch {
      // Silent fail
    }
  });
};

main();

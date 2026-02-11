#!/usr/bin/env node
/**
 * SEDD Hook - Stop
 * Generates session summary (completed, inProgress, nextSteps) in _meta.json.lastSession
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
      if (!migrationId) return;

      const migInfo = meta.migrations[migrationId];
      if (!migInfo) return;

      // Build session summary
      const summary = {
        completed: [],
        inProgress: null,
        nextSteps: [],
        filesModified: [],
        timestamp: new Date().toISOString(),
      };

      // Get recently modified files (last 30 min)
      try {
        const diff = execSync('git diff --name-only HEAD', { cwd, encoding: 'utf8' }).trim();
        if (diff) {
          summary.filesModified = diff.split('\n').filter(f => f.length > 0);
        }
      } catch { /* ignore */ }

      // Parse tasks for completed/pending
      const tasksFile = path.join(featureDir, migInfo.folder, 'tasks.md');
      if (fs.existsSync(tasksFile)) {
        const content = fs.readFileSync(tasksFile, 'utf8');
        for (const line of content.split('\n')) {
          const done = line.match(/^\s*-\s*\[x\]\s*(T\d{3}-\d{3})\s+(.+)/i);
          if (done) summary.completed.push(`${done[1]}: ${done[2].replace(/`[^`]+`/g, '').trim()}`);

          const pending = line.match(/^\s*-\s*\[\s*\]\s*(T\d{3}-\d{3})\s+(.+)/);
          if (pending && !summary.inProgress) {
            summary.inProgress = `${pending[1]}: ${pending[2].replace(/`[^`]+`/g, '').trim()}`;
          } else if (pending) {
            summary.nextSteps.push(`${pending[1]}: ${pending[2].replace(/`[^`]+`/g, '').trim()}`);
          }
        }
      }

      // Limit nextSteps to 3
      summary.nextSteps = summary.nextSteps.slice(0, 3);

      // Save to _meta.json
      meta.lastSession = summary;
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf8');
    } catch {
      // Silent fail - never block Claude from stopping
    }
  });
};

main();

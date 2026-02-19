#!/usr/bin/env node
/**
 * SEDD Hook - PreCompact
 * Extracts critical context before compaction and saves to .session-context.json
 * NOTE: PreCompact cannot inject context - it can only observe and save for later.
 * The SessionStart(compact) hook reads this file to re-inject context.
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

const parseTasksFromContent = (content) => {
  const tasks = [];
  for (const line of content.split('\n')) {
    const pending = line.match(/^\s*-\s*\[\s*\]\s*(T\d{3}-\d{3})\s+(.+)/);
    if (pending) {
      tasks.push({ id: pending[1], description: pending[2].replace(/`[^`]+`/g, '').trim(), status: 'pending' });
    }
    const done = line.match(/^\s*-\s*\[x\]\s*(T\d{3}-\d{3})\s+(.+)/i);
    if (done) {
      tasks.push({ id: done[1], description: done[2].replace(/`[^`]+`/g, '').trim(), status: 'completed' });
    }
  }
  return tasks;
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

      // Build context to save
      const context = {
        branch,
        migrationId,
        expectation: null,
        pendingTasks: [],
        completedTasks: [],
        lastAction: null,
        savedAt: new Date().toISOString(),
      };

      // Get expectation
      if (migrationId && meta.migrations[migrationId]?.expectation) {
        context.expectation = meta.migrations[migrationId].expectation;
      } else if (meta.expectation) {
        context.expectation = meta.expectation;
      }

      // Get tasks
      if (migrationId && meta.migrations[migrationId]) {
        const migInfo = meta.migrations[migrationId];
        const tasksFile = path.join(featureDir, migInfo.folder, 'tasks.md');
        if (fs.existsSync(tasksFile)) {
          const content = fs.readFileSync(tasksFile, 'utf8');
          const allTasks = parseTasksFromContent(content);
          context.pendingTasks = allTasks.filter(t => t.status === 'pending');
          context.completedTasks = allTasks.filter(t => t.status === 'completed');
        }
      }

      // Get last action from progress.md
      const progressFile = path.join(featureDir, 'progress.md');
      if (fs.existsSync(progressFile)) {
        const progress = fs.readFileSync(progressFile, 'utf8');
        const completedLines = progress.match(/- \[x\] T\d{3}-\d{3}.+/g);
        if (completedLines && completedLines.length > 0) {
          context.lastAction = completedLines[completedLines.length - 1]
            .replace(/^- \[x\] /, '').trim();
        }
      }

      // Save context
      const contextFile = path.join(featureDir, '.session-context.json');
      fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf8');
    } catch {
      // Silent fail
    }
  });
};

main();

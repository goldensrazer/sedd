import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadConfig, getTaskId, FeatureMeta } from '../types/index.js';
import { GitOperations } from '../utils/git.js';

interface TaskInput {
  story?: string;
  description: string;
}

interface TasksOptions {
  migration?: string;
}

const getNextTaskNumber = (content: string, migrationId: string): number => {
  const pattern = new RegExp(`T${migrationId}-(\\d{3})`, 'g');
  let maxNum = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const num = parseInt(match[1], 10);
    if (num > maxNum) maxNum = num;
  }

  return maxNum + 1;
};

export async function addTasks(
  tasksJson: string,
  options: TasksOptions = {}
): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const git = new GitOperations(cwd);

  const branch = git.getCurrentBranch();

  if (!git.isFeatureBranch(branch)) {
    console.log(chalk.red('Error: Not on a feature branch'));
    process.exit(1);
  }

  let featureDir = join(cwd, config.specsDir, branch);
  if (!existsSync(featureDir)) {
    featureDir = join(cwd, 'specs', branch);
  }

  if (!existsSync(featureDir)) {
    console.log(chalk.red(`Error: Feature not found: ${branch}`));
    process.exit(1);
  }

  const metaPath = join(featureDir, '_meta.json');
  if (!existsSync(metaPath)) {
    console.log(chalk.red('Error: _meta.json not found'));
    process.exit(1);
  }

  const meta: FeatureMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  const migrationId = options.migration || meta.currentMigration;

  if (!migrationId) {
    console.log(chalk.red('Error: No current migration. Run /sedd.clarify first.'));
    process.exit(1);
  }

  const migInfo = meta.migrations[migrationId];
  if (!migInfo) {
    console.log(chalk.red(`Error: Migration ${migrationId} not found`));
    process.exit(1);
  }

  const tasksFile = join(featureDir, migInfo.folder, 'tasks.md');
  if (!existsSync(tasksFile)) {
    console.log(chalk.red(`Error: tasks.md not found for migration ${migrationId}`));
    process.exit(1);
  }

  let taskList: TaskInput[];
  try {
    taskList = JSON.parse(tasksJson);
  } catch {
    console.log(chalk.red('Error: Invalid tasks JSON'));
    process.exit(1);
  }

  if (!Array.isArray(taskList) || taskList.length === 0) {
    console.log(chalk.yellow('No tasks provided'));
    return;
  }

  const content = readFileSync(tasksFile, 'utf-8');
  let nextNum = getNextTaskNumber(content, migrationId);

  const newTasks: string[] = [];
  for (const task of taskList) {
    const taskId = getTaskId(migrationId, nextNum);
    const story = task.story ? `[${task.story}] ` : '';
    const line = `- [ ] ${taskId} ${story}${task.description}`;
    newTasks.push(line);
    nextNum++;
  }

  const separator = content.endsWith('\n') ? '\n' : '\n\n';
  const newContent = content + separator + newTasks.join('\n') + '\n';
  writeFileSync(tasksFile, newContent, 'utf-8');

  console.log(chalk.green(`Added ${taskList.length} task(s) to migration ${migrationId}`));
  for (const t of newTasks) {
    console.log(chalk.white(`  ${t}`));
  }

  meta.migrations[migrationId].tasksTotal += taskList.length;
  meta.migrations[migrationId].status = 'in-progress';
  writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  console.log(chalk.gray('\n---SEDD-OUTPUT---'));
  console.log(
    JSON.stringify({
      success: true,
      migrationId,
      tasksAdded: taskList.length,
      totalTasks: meta.migrations[migrationId].tasksTotal,
    })
  );
}

export async function completeTask(taskId: string): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const git = new GitOperations(cwd);

  const branch = git.getCurrentBranch();

  if (!git.isFeatureBranch(branch)) {
    console.log(chalk.red('Error: Not on a feature branch'));
    process.exit(1);
  }

  const match = taskId.match(/^T(\d{3})-(\d{3})$/);
  if (!match) {
    console.log(chalk.red('Error: Invalid task ID format. Expected: T001-001'));
    process.exit(1);
  }

  const migId = match[1];

  let featureDir = join(cwd, config.specsDir, branch);
  if (!existsSync(featureDir)) {
    featureDir = join(cwd, 'specs', branch);
  }

  if (!existsSync(featureDir)) {
    console.log(chalk.red(`Error: Feature not found: ${branch}`));
    process.exit(1);
  }

  const metaPath = join(featureDir, '_meta.json');
  if (!existsSync(metaPath)) {
    console.log(chalk.red('Error: _meta.json not found'));
    process.exit(1);
  }

  const meta: FeatureMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  const migInfo = meta.migrations[migId];

  if (!migInfo) {
    console.log(chalk.red(`Error: Migration ${migId} not found`));
    process.exit(1);
  }

  const tasksFile = join(featureDir, migInfo.folder, 'tasks.md');
  if (!existsSync(tasksFile)) {
    console.log(chalk.red('Error: tasks.md not found'));
    process.exit(1);
  }

  let content = readFileSync(tasksFile, 'utf-8');

  if (content.includes(`[x] ${taskId}`)) {
    console.log(chalk.yellow(`Task ${taskId} is already completed`));
    return;
  }

  if (!content.includes(`[ ] ${taskId}`)) {
    console.log(chalk.red(`Error: Task ${taskId} not found`));
    process.exit(1);
  }

  content = content.replace(`- [ ] ${taskId}`, `- [x] ${taskId}`);
  writeFileSync(tasksFile, content, 'utf-8');

  console.log(chalk.green(`Completed: ${taskId}`));

  meta.migrations[migId].tasksCompleted++;

  const { tasksCompleted, tasksTotal } = meta.migrations[migId];
  if (tasksCompleted >= tasksTotal) {
    meta.migrations[migId].status = 'completed';
    meta.migrations[migId].completedAt = new Date().toISOString();
    console.log(chalk.cyan(`Migration ${migId} completed!`));
  }

  writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  console.log(chalk.white(`Progress: ${tasksCompleted}/${tasksTotal} tasks`));

  console.log(chalk.gray('\n---SEDD-OUTPUT---'));
  console.log(
    JSON.stringify({
      success: true,
      taskId,
      migrationId: migId,
      completed: tasksCompleted,
      total: tasksTotal,
      migrationStatus: meta.migrations[migId].status,
    })
  );
}

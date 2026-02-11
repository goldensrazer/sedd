import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  SeddConfig,
  FeatureMeta,
  BoardStatus,
  BoardColumn,
  BoardTask,
  WipViolation,
  FlowSuggestion,
  SyncResult,
  GitHubSyncMapping,
} from '../types/index.js';
import { GitHubOperations } from '../utils/github.js';

export class BoardManager {
  private config: SeddConfig;
  private cwd: string;
  private gh: GitHubOperations;

  constructor(config: SeddConfig, cwd: string) {
    this.config = config;
    this.cwd = cwd;
    this.gh = new GitHubOperations(cwd);
  }

  /**
   * Get board status for a feature/migration from local tasks.md
   */
  getBoard(featureDir: string, meta: FeatureMeta): BoardStatus | null {
    const migrationId = meta.currentMigration;
    if (!migrationId) return null;

    const migInfo = meta.migrations[migrationId];
    if (!migInfo) return null;

    const tasksFile = join(featureDir, migInfo.folder, 'tasks.md');
    if (!existsSync(tasksFile)) return null;

    const content = readFileSync(tasksFile, 'utf-8');
    const tasks = this.parseTasksFromMarkdown(content, migrationId);

    const mapping = this.config.github?.columnMapping || {
      pending: 'Todo',
      'in-progress': 'In Progress',
      completed: 'Done',
      blocked: 'Blocked',
    };

    const wipLimits = this.config.github?.wipLimits;

    const todoCol: BoardColumn = {
      name: mapping.pending || 'Todo',
      tasks: tasks.filter(t => t.status === 'pending'),
      wipLimit: wipLimits?.[mapping.pending] ?? undefined,
    };

    const inProgressCol: BoardColumn = {
      name: mapping['in-progress'] || 'In Progress',
      tasks: tasks.filter(t => t.status === 'in-progress'),
      wipLimit: wipLimits?.[mapping['in-progress']] ?? undefined,
    };

    const doneCol: BoardColumn = {
      name: mapping.completed || 'Done',
      tasks: tasks.filter(t => t.status === 'completed'),
      wipLimit: wipLimits?.[mapping.completed] ?? undefined,
    };

    const blockedCol: BoardColumn = {
      name: mapping.blocked || 'Blocked',
      tasks: tasks.filter(t => t.status === 'blocked'),
      wipLimit: wipLimits?.[mapping.blocked] ?? undefined,
    };

    const columns: BoardColumn[] = [todoCol, inProgressCol, doneCol];
    if (blockedCol.tasks.length > 0) {
      columns.splice(2, 0, blockedCol); 
    }

    return {
      featureName: `${meta.featureId}-${meta.featureName}`,
      migrationId,
      columns,
    };
  }

  /**
   * Parse tasks from tasks.md into BoardTask items
   */
  private parseTasksFromMarkdown(content: string, migrationId: string): BoardTask[] {
    const tasks: BoardTask[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const taskMatch = line.match(/^- \[([ x])\] (T\d{3}-\d{3})\s+(.+)$/);
      if (!taskMatch) continue;

      const [, checkmark, id, description] = taskMatch;
      let status: string;
      if (checkmark === 'x') {
        status = 'completed';
      } else if (description.toLowerCase().includes('[blocked]')) {
        status = 'blocked';
      } else {
        status = 'pending';
      }

      tasks.push({ id, description: description.trim(), status });
    }

    return tasks;
  }

  /**
   * Move a task to a different column (updates tasks.md)
   */
  moveTask(featureDir: string, meta: FeatureMeta, taskId: string, targetColumn: string): boolean {
    const migrationId = meta.currentMigration;
    if (!migrationId) return false;

    const migInfo = meta.migrations[migrationId];
    if (!migInfo) return false;

    const tasksFile = join(featureDir, migInfo.folder, 'tasks.md');
    if (!existsSync(tasksFile)) return false;

    let content = readFileSync(tasksFile, 'utf-8');

    const mapping = this.config.github?.columnMapping || {
      pending: 'Todo',
      'in-progress': 'In Progress',
      completed: 'Done',
      blocked: 'Blocked',
    };

    let targetStatus = '';
    for (const [status, colName] of Object.entries(mapping)) {
      if (colName.toLowerCase() === targetColumn.toLowerCase()) {
        targetStatus = status;
        break;
      }
    }

    if (!targetStatus) return false;

    if (targetStatus === 'completed') {
      content = content.replace(`- [ ] ${taskId}`, `- [x] ${taskId}`);
    } else {
      content = content.replace(`- [x] ${taskId}`, `- [ ] ${taskId}`);
    }

    writeFileSync(tasksFile, content, 'utf-8');
    return true;
  }

  /**
   * Check WIP limit violations
   */
  checkWipLimits(board: BoardStatus): WipViolation[] {
    const violations: WipViolation[] = [];

    for (const col of board.columns) {
      if (col.wipLimit && col.tasks.length > col.wipLimit) {
        violations.push({
          column: col.name,
          current: col.tasks.length,
          limit: col.wipLimit,
        });
      }
    }

    return violations;
  }

  /**
   * Suggest next task to work on (Lean algorithm)
   */
  suggestNext(board: BoardStatus): FlowSuggestion[] {
    const suggestions: FlowSuggestion[] = [];
    const inProgressCol = board.columns.find(c =>
      c.name.toLowerCase().includes('progress') || c.name.toLowerCase().includes('doing')
    );
    const todoCol = board.columns.find(c =>
      c.name.toLowerCase().includes('todo') || c.name.toLowerCase().includes('backlog')
    );

    if (inProgressCol && inProgressCol.wipLimit && inProgressCol.tasks.length >= inProgressCol.wipLimit) {
      for (const task of inProgressCol.tasks) {
        suggestions.push({
          taskId: task.id,
          description: task.description,
          reason: 'WIP limit reached — finish current work first',
          score: 100,
        });
      }
      return suggestions.slice(0, 3);
    }

    if (todoCol) {
      for (const task of todoCol.tasks) {
        const idMatch = task.id.match(/T\d{3}-(\d{3})/);
        const taskNum = idMatch ? parseInt(idMatch[1]) : 999;
        const score = (1000 - taskNum) * 0.1;

        suggestions.push({
          taskId: task.id,
          description: task.description,
          reason: 'Next in queue',
          score,
        });
      }
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  /**
   * Sync a specific task status to GitHub
   */
  private syncTaskToGitHub(featureDir: string, migrationFolder: string, taskId: string, targetColumn: string): boolean {
    const ghConfig = this.config.github;
    if (!ghConfig?.project) return false;

    const syncPath = join(featureDir, migrationFolder, '.github-sync.json');
    const syncData = this.loadSyncMapping(syncPath);

    const taskSync = syncData.tasks[taskId];
    if (!taskSync) return false;

    const optionId = ghConfig.columns.options[targetColumn];
    if (!optionId) return false;

    return this.gh.moveItem(
      ghConfig.project.projectId,
      taskSync.itemId,
      ghConfig.columns.fieldId,
      optionId,
    );
  }

  /**
   * Sync board state to GitHub (push local → remote)
   */
  syncToGitHub(featureDir: string, meta: FeatureMeta): SyncResult {
    const result: SyncResult = { synced: 0, created: 0, moved: 0, errors: [] };

    if (!this.isGitHubEnabled()) return result;

    const ghConfig = this.config.github!;
    const migrationId = meta.currentMigration;
    if (!migrationId || !ghConfig.project) return result;

    const migInfo = meta.migrations[migrationId];
    if (!migInfo) return result;

    const syncPath = join(featureDir, migInfo.folder, '.github-sync.json');
    const syncData = this.loadSyncMapping(syncPath);

    const board = this.getBoard(featureDir, meta);
    if (!board) return result;

    const syncTasks = this.config.github?.syncTasks || 'off';
    for (const col of board.columns) {
      for (const task of col.tasks) {
        if (!syncData.tasks[task.id]) {
          if (syncTasks === 'off') {
            result.synced++;
            continue;
          }
          const issue = this.gh.createIssue(
            `${task.id} ${task.description}`,
            `Task from SEDD migration ${migrationId}\n\nFeature: ${meta.featureId}-${meta.featureName}`,
            ghConfig.labels?.task ? [ghConfig.labels.task] : undefined,
          );

          if (issue) {
            const itemId = this.gh.addIssueToProject(ghConfig.project.projectId, issue.url);
            if (itemId) {
              syncData.tasks[task.id] = {
                issueNumber: issue.number,
                issueUrl: issue.url,
                itemId,
              };

              const optionId = ghConfig.columns.options[col.name];
              if (optionId) {
                this.gh.moveItem(ghConfig.project.projectId, itemId, ghConfig.columns.fieldId, optionId);
              }

              result.created++;
            }
          } else {
            result.errors.push(`Failed to create issue for ${task.id}`);
          }
        } else {
          const taskSync = syncData.tasks[task.id];
          const optionId = ghConfig.columns.options[col.name];
          if (optionId) {
            const moved = this.gh.moveItem(
              ghConfig.project.projectId,
              taskSync.itemId,
              ghConfig.columns.fieldId,
              optionId,
            );
            if (moved) result.moved++;
          }
          result.synced++;
        }
      }
    }

    syncData.lastSyncedAt = new Date().toISOString();
    this.saveSyncMapping(syncPath, syncData);

    return result;
  }

  /**
   * Sync from GitHub → local (pull remote state)
   */
  syncFromGitHub(featureDir: string, meta: FeatureMeta): SyncResult {
    const result: SyncResult = { synced: 0, created: 0, moved: 0, errors: [] };

    if (!this.isGitHubEnabled()) return result;

    const ghConfig = this.config.github!;
    if (!ghConfig.owner || !ghConfig.project) return result;

    const items = this.gh.listProjectItems(ghConfig.owner, ghConfig.project.projectNumber);
    result.synced = items.length;

    return result;
  }

  /**
   * Create a GitHub issue for a task and add it to the project
   */
  createIssueForTask(
    featureDir: string,
    migrationFolder: string,
    taskId: string,
    description: string,
    featureName: string,
    migrationId: string,
  ): { issueNumber: number; issueUrl: string; itemId: string } | null {
    const ghConfig = this.config.github;
    if (!ghConfig?.project) return null;

    const issue = this.gh.createIssue(
      `${taskId} ${description}`,
      `Task from SEDD migration ${migrationId}\n\nFeature: ${featureName}`,
      ghConfig.labels?.task ? [ghConfig.labels.task] : undefined,
    );
    if (!issue) return null;

    const itemId = this.gh.addIssueToProject(ghConfig.project.projectId, issue.url);
    if (!itemId) return null;

    const todoCol = ghConfig.columnMapping.pending;
    const optionId = ghConfig.columns.options[todoCol];
    if (optionId) {
      this.gh.moveItem(ghConfig.project.projectId, itemId, ghConfig.columns.fieldId, optionId);
    }

    const syncPath = join(featureDir, migrationFolder, '.github-sync.json');
    const syncData = this.loadSyncMapping(syncPath);
    syncData.tasks[taskId] = {
      issueNumber: issue.number,
      issueUrl: issue.url,
      itemId,
    };
    syncData.lastSyncedAt = new Date().toISOString();
    this.saveSyncMapping(syncPath, syncData);

    return { issueNumber: issue.number, issueUrl: issue.url, itemId };
  }

  /**
   * Check if GitHub engine is enabled
   */
  isGitHubEnabled(): boolean {
    const engine = this.config.github?.engine;
    return (engine === 'github' || engine === 'both') && this.gh.hasGh();
  }

  /**
   * Load sync mapping from file
   */
  loadSyncMapping(syncPath: string): GitHubSyncMapping {
    if (existsSync(syncPath)) {
      return JSON.parse(readFileSync(syncPath, 'utf-8'));
    }
    return { lastSyncedAt: '', tasks: {} };
  }

  /**
   * Save sync mapping to file
   */
  saveSyncMapping(syncPath: string, data: GitHubSyncMapping): void {
    writeFileSync(syncPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Get the GitHub operations instance
   */
  getGh(): GitHubOperations {
    return this.gh;
  }
}

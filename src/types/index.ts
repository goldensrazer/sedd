export type MigrationStatus = 'pending' | 'in-progress' | 'completed';

export interface MigrationInfo {
  id: string;
  timestamp: string;
  folder: string;
  parent?: string;
  status: MigrationStatus;
  tasksTotal: number;
  tasksCompleted: number;
  createdAt: string;
  completedAt?: string;
  expectation?: string;
}

export interface CommitInfo {
  migration: string;
  hash: string;
  message: string;
  timestamp: string;
}

export interface SplitInfo {
  originalFile: string;
  parts: string[];
  splitAt: string;
}

export interface FeatureMeta {
  featureId: string;
  featureName: string;
  branch: string;
  createdAt: string;
  specCreatedAt: string;
  currentMigration: string | null;
  migrations: Record<string, MigrationInfo>;
  splits: SplitInfo[];
  commits: CommitInfo[];
  expectation?: string;
}

export interface TaskInfo {
  id: string;
  migrationId: string;
  description: string;
  filePath?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  markers: string[];
  completedAt?: string;
}

export interface AutoSplitConfig {
  enabled: boolean;
  maxLines: number;
}

export interface HooksConfig {
  assertive: boolean;
  skills: string[];
}

export interface CommitConfig {
  askBeforeCommit: boolean;
  messagePattern: string;
}

export type ScriptRunner = 'auto' | 'powershell' | 'bash';

export interface SeddConfig {
  specsDir: string;
  branchPattern: string;
  scriptRunner: ScriptRunner;
  autoSplit: AutoSplitConfig;
  hooks: HooksConfig;
  commit: CommitConfig;
}

export const DEFAULT_CONFIG: SeddConfig = {
  specsDir: '.sedd',
  branchPattern: '{{id}}-{{name}}',
  scriptRunner: 'auto',
  autoSplit: {
    enabled: true,
    maxLines: 400,
  },
  hooks: {
    assertive: true,
    skills: ['langchain-expert', 'architecture-mapper', 'defect-analyzer'],
  },
  commit: {
    askBeforeCommit: true,
    messagePattern: '{{type}}({{id}}): {{message}}',
  },
};

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Load config from sedd.config.json or use defaults
 */
export const loadConfig = (projectRoot: string): SeddConfig => {
  const configPath = join(projectRoot, 'sedd.config.json');

  if (existsSync(configPath)) {
    const userConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    return { ...DEFAULT_CONFIG, ...userConfig };
  }

  return DEFAULT_CONFIG;
};

/**
 * Get feature directory path
 */
export const getFeaturePath = (config: SeddConfig, projectRoot: string, featureBranch: string): string => {
  return join(projectRoot, config.specsDir, featureBranch);
};

/**
 * Generate next migration ID (001, 002, 003...)
 */
export const getNextMigrationId = (meta: FeatureMeta): string => {
  const ids = Object.keys(meta.migrations).map((id) => parseInt(id));
  const max = ids.length > 0 ? Math.max(...ids) : 0;
  return (max + 1).toString().padStart(3, '0');
};

/**
 * Generate migration folder name: 001_2026-01-10_14-30-45
 */
export const getMigrationFolder = (id: string, timestamp: string): string => {
  return `${id}_${timestamp}`;
};

/**
 * Parse migration folder name
 */
export const parseMigrationFolder = (folder: string): { id: string; timestamp: string } | null => {
  const match = folder.match(/^(\d{3})_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})$/);
  if (!match) {
    return null;
  }
  return {
    id: match[1],
    timestamp: match[2],
  };
};

/**
 * Generate task ID: T001-001, T001-002, T002-001...
 */
export const getTaskId = (migrationId: string, taskNumber: number): string => {
  return `T${migrationId}-${taskNumber.toString().padStart(3, '0')}`;
};

/**
 * Parse task ID
 */
export const parseTaskId = (taskId: string): { migrationId: string; taskNumber: number } | null => {
  const match = taskId.match(/^T(\d{3})-(\d{3})$/);
  if (!match) {
    return null;
  }
  return {
    migrationId: match[1],
    taskNumber: parseInt(match[2]),
  };
};

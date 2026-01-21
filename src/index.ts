export { MigrationManager } from './core/migration-manager.js';
export { FileSplitter } from './core/file-splitter.js';
export { ChangelogManager } from './core/changelog.js';
export { formatTimestamp, getSessionTimestamp, formatChangelogDate } from './core/timestamps.js';
export { GitOperations } from './utils/git.js';

export type {
  MigrationInfo,
  MigrationStatus,
  FeatureMeta,
  TaskInfo,
  SeddConfig,
  AutoSplitConfig,
  HooksConfig,
  CommitConfig,
  CommitInfo,
  SplitInfo,
} from './types/index.js';

export {
  DEFAULT_CONFIG,
  loadConfig,
  getFeaturePath,
  getNextMigrationId,
  getMigrationFolder,
  parseMigrationFolder,
  getTaskId,
  parseTaskId,
} from './types/index.js';

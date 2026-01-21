import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  type FeatureMeta,
  type MigrationInfo,
  type MigrationStatus,
  getNextMigrationId,
  getMigrationFolder,
  parseMigrationFolder,
} from '../types/index.js';
import { formatTimestamp, getSessionTimestamp } from './timestamps.js';

export class MigrationManager {
  private featureDir: string;
  private metaPath: string;
  private meta: FeatureMeta | null = null;

  constructor(featureDir: string) {
    this.featureDir = featureDir;
    this.metaPath = join(featureDir, '_meta.json');
  }

  /**
   * Initialize a new feature (no migrations yet)
   */
  initFeature(featureId: string, featureName: string, branch: string): FeatureMeta {
    const now = formatTimestamp();

    this.meta = {
      featureId,
      featureName,
      branch,
      createdAt: now,
      specCreatedAt: now,
      currentMigration: null,
      migrations: {},
      splits: [],
      commits: [],
    };

    this.saveMeta();
    return this.meta;
  }

  /**
   * Load existing feature metadata
   */
  loadMeta(): FeatureMeta | null {
    if (!existsSync(this.metaPath)) {
      return null;
    }

    const content = readFileSync(this.metaPath, 'utf-8');
    this.meta = JSON.parse(content) as FeatureMeta;
    return this.meta;
  }

  /**
   * Save metadata to file
   */
  saveMeta(): void {
    if (!this.meta) {
      throw new Error('No metadata to save');
    }

    if (!existsSync(this.featureDir)) {
      mkdirSync(this.featureDir, { recursive: true });
    }

    writeFileSync(this.metaPath, JSON.stringify(this.meta, null, 2), 'utf-8');
  }

  /**
   * Create a new migration
   */
  createMigration(): MigrationInfo {
    if (!this.meta) {
      throw new Error('No feature loaded');
    }

    const timestamp = getSessionTimestamp();
    const id = getNextMigrationId(this.meta);
    const folder = getMigrationFolder(id, timestamp);

    const parent = this.meta.currentMigration;

    const migration: MigrationInfo = {
      id,
      timestamp,
      folder,
      parent: parent ?? undefined,
      status: 'in-progress',
      tasksTotal: 0,
      tasksCompleted: 0,
      createdAt: formatTimestamp(),
    };

    const migrationDir = join(this.featureDir, folder);
    mkdirSync(migrationDir, { recursive: true });

    this.meta.migrations[id] = migration;
    this.meta.currentMigration = id;
    this.saveMeta();

    return migration;
  }

  /**
   * Get current migration
   */
  getCurrentMigration(): MigrationInfo | null {
    if (!this.meta) {
      this.loadMeta();
    }

    if (!this.meta?.currentMigration) {
      return null;
    }

    return this.meta.migrations[this.meta.currentMigration] ?? null;
  }

  /**
   * Get migration by ID
   */
  getMigration(id: string): MigrationInfo | null {
    if (!this.meta) {
      this.loadMeta();
    }

    return this.meta?.migrations[id] ?? null;
  }

  /**
   * Get all migrations in order
   */
  getAllMigrations(): MigrationInfo[] {
    if (!this.meta) {
      this.loadMeta();
    }

    if (!this.meta) {
      return [];
    }

    return Object.values(this.meta.migrations).sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Get migration directory path
   */
  getMigrationDir(migrationId: string): string | null {
    const migration = this.getMigration(migrationId);
    if (!migration) {
      return null;
    }
    return join(this.featureDir, migration.folder);
  }

  /**
   * Update migration status
   */
  updateMigrationStatus(id: string, status: MigrationStatus): void {
    if (!this.meta) {
      throw new Error('No feature loaded');
    }

    const migration = this.meta.migrations[id];
    if (!migration) {
      throw new Error(`Migration ${id} not found`);
    }

    migration.status = status;
    if (status === 'completed') {
      migration.completedAt = formatTimestamp();
    }

    this.saveMeta();
  }

  /**
   * Update migration task counts
   */
  updateMigrationTasks(id: string, total: number, completed: number): void {
    if (!this.meta) {
      throw new Error('No feature loaded');
    }

    const migration = this.meta.migrations[id];
    if (!migration) {
      throw new Error(`Migration ${id} not found`);
    }

    migration.tasksTotal = total;
    migration.tasksCompleted = completed;

    if (completed >= total && total > 0) {
      migration.status = 'completed';
      migration.completedAt = formatTimestamp();
    }

    this.saveMeta();
  }

  /**
   * Record a commit
   */
  recordCommit(migrationId: string, hash: string, message: string): void {
    if (!this.meta) {
      throw new Error('No feature loaded');
    }

    this.meta.commits.push({
      migration: migrationId,
      hash,
      message,
      timestamp: formatTimestamp(),
    });

    this.saveMeta();
  }

  /**
   * Get pending migrations (not completed)
   */
  getPendingMigrations(): MigrationInfo[] {
    return this.getAllMigrations().filter((m) => m.status !== 'completed');
  }

  /**
   * Get migrations up to a specific ID
   */
  getMigrationsUpTo(id: string): MigrationInfo[] {
    return this.getAllMigrations().filter((m) => m.id <= id);
  }

  /**
   * Get feature status summary
   */
  getStatus(): {
    featureId: string;
    featureName: string;
    currentMigration: string | null;
    totalMigrations: number;
    completedMigrations: number;
    pendingTasks: number;
    completedTasks: number;
  } {
    if (!this.meta) {
      this.loadMeta();
    }

    if (!this.meta) {
      throw new Error('No feature loaded');
    }

    const migrations = Object.values(this.meta.migrations);
    const completed = migrations.filter((m) => m.status === 'completed').length;

    let pendingTasks = 0;
    let completedTasks = 0;

    for (const m of migrations) {
      completedTasks += m.tasksCompleted;
      pendingTasks += m.tasksTotal - m.tasksCompleted;
    }

    return {
      featureId: this.meta.featureId,
      featureName: this.meta.featureName,
      currentMigration: this.meta.currentMigration,
      totalMigrations: migrations.length,
      completedMigrations: completed,
      pendingTasks,
      completedTasks,
    };
  }

  /**
   * Scan feature directory for migration folders
   */
  scanMigrationFolders(): string[] {
    if (!existsSync(this.featureDir)) {
      return [];
    }

    return readdirSync(this.featureDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && parseMigrationFolder(d.name))
      .map((d) => d.name)
      .sort();
  }
}

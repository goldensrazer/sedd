import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatChangelogDate } from './timestamps.js';

export interface ChangelogEntry {
  date: string;
  phase: string;
  changes: string[];
}

export class ChangelogManager {
  private changelogPath: string;

  constructor(featureDir: string) {
    this.changelogPath = join(featureDir, 'CHANGELOG.md');
  }

  /**
   * Initialize a new changelog file
   */
  init(featureId: string, featureName: string): void {
    const content = `# Changelog - ${featureId}: ${featureName}

All notable changes to this feature will be documented in this file.

`;
    writeFileSync(this.changelogPath, content, 'utf-8');
  }

  /**
   * Add an entry to the changelog
   */
  addEntry(phase: string, changes: string[]): void {
    if (!existsSync(this.changelogPath)) {
      throw new Error('Changelog not initialized');
    }

    const date = formatChangelogDate();
    const entry = this.formatEntry({ date, phase, changes });

    const currentContent = readFileSync(this.changelogPath, 'utf-8');
    const lines = currentContent.split('\n');

    let insertIndex = lines.findIndex(
      (line) => line.startsWith('## ') || line.trim() === ''
    );

    if (insertIndex === -1 || (insertIndex < 3 && lines[insertIndex].trim() === '')) {
      while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
        insertIndex++;
      }
      if (insertIndex === lines.length) {
        insertIndex = lines.length;
      }
    }

    const header = lines.slice(0, insertIndex).join('\n');
    const rest = lines.slice(insertIndex).join('\n');

    const newContent = header + '\n' + entry + '\n' + rest;
    writeFileSync(this.changelogPath, newContent.trim() + '\n', 'utf-8');
  }

  /**
   * Format a changelog entry
   */
  private formatEntry(entry: ChangelogEntry): string {
    const lines = [`## [${entry.date}] - ${entry.phase}`, ''];

    for (const change of entry.changes) {
      lines.push(`- ${change}`);
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Get all entries from changelog
   */
  getEntries(): ChangelogEntry[] {
    if (!existsSync(this.changelogPath)) {
      return [];
    }

    const content = readFileSync(this.changelogPath, 'utf-8');
    const entries: ChangelogEntry[] = [];

    const entryPattern = /^## \[(\d{4}-\d{2}-\d{2})\] - (.+)$/gm;
    let match;

    const lines = content.split('\n');
    let currentEntry: ChangelogEntry | null = null;

    for (const line of lines) {
      const headerMatch = line.match(/^## \[(\d{4}-\d{2}-\d{2})\] - (.+)$/);
      if (headerMatch) {
        if (currentEntry) {
          entries.push(currentEntry);
        }
        currentEntry = {
          date: headerMatch[1],
          phase: headerMatch[2],
          changes: [],
        };
      } else if (currentEntry && line.startsWith('- ')) {
        currentEntry.changes.push(line.substring(2));
      }
    }

    if (currentEntry) {
      entries.push(currentEntry);
    }

    return entries;
  }

  /**
   * Check if changelog exists
   */
  exists(): boolean {
    return existsSync(this.changelogPath);
  }
}

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { DEFAULT_CONFIG } from '../types/index.js';

export interface SplitResult {
  success: boolean;
  originalFile: string;
  parts: string[];
  message: string;
}

export class FileSplitter {
  private maxLines: number;

  constructor(maxLines = DEFAULT_CONFIG.autoSplit.maxLines) {
    this.maxLines = maxLines;
  }

  /**
   * Count lines in a file
   */
  countLines(filePath: string): number {
    if (!existsSync(filePath)) {
      return 0;
    }

    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  }

  /**
   * Estimate token count (approx 4 chars per token)
   */
  estimateTokens(filePath: string): number {
    if (!existsSync(filePath)) {
      return 0;
    }

    const content = readFileSync(filePath, 'utf-8');
    return Math.ceil(content.length / 4);
  }

  /**
   * Check if file needs splitting
   */
  needsSplit(filePath: string): boolean {
    const lines = this.countLines(filePath);
    return lines > this.maxLines;
  }

  /**
   * Split a markdown file into parts
   */
  split(filePath: string): SplitResult {
    if (!existsSync(filePath)) {
      return {
        success: false,
        originalFile: filePath,
        parts: [],
        message: `File not found: ${filePath}`,
      };
    }

    const lines = this.countLines(filePath);
    if (lines <= this.maxLines) {
      return {
        success: true,
        originalFile: filePath,
        parts: [filePath],
        message: `File does not need splitting (${lines} lines)`,
      };
    }

    const content = readFileSync(filePath, 'utf-8');
    const allLines = content.split('\n');
    const dir = dirname(filePath);
    const baseName = basename(filePath, extname(filePath));
    const ext = extname(filePath);

    const parts: string[] = [];
    let partIndex = 0;
    let currentLine = 0;

    while (currentLine < allLines.length) {
      const endLine = Math.min(currentLine + this.maxLines, allLines.length);
      const chunk = allLines.slice(currentLine, endLine);

      const partFileName = `${baseName}_${partIndex}${ext}`;
      const partPath = join(dir, partFileName);

      writeFileSync(partPath, chunk.join('\n'), 'utf-8');
      parts.push(partPath);

      currentLine = endLine;
      partIndex++;
    }

    unlinkSync(filePath);

    const indexPath = join(dir, `${baseName}-index${ext}`);
    const indexContent = this.generateIndexFile(baseName, parts);
    writeFileSync(indexPath, indexContent, 'utf-8');
    parts.unshift(indexPath);

    return {
      success: true,
      originalFile: filePath,
      parts,
      message: `Split into ${partIndex} parts`,
    };
  }

  /**
   * Merge split files back into one
   */
  merge(dir: string, baseName: string): string {
    const ext = '.md';
    const pattern = new RegExp(`^${baseName}_(\\d+)${ext}$`);

    const { readdirSync } = require('node:fs');
    const files: string[] = readdirSync(dir);

    const parts = files
      .filter((f: string) => pattern.test(f))
      .sort((a: string, b: string) => {
        const numA = parseInt(a.match(pattern)![1]);
        const numB = parseInt(b.match(pattern)![1]);
        return numA - numB;
      })
      .map((f: string) => join(dir, f));

    if (parts.length === 0) {
      const singleFile = join(dir, `${baseName}${ext}`);
      if (existsSync(singleFile)) {
        return singleFile;
      }
      throw new Error(`No files found to merge for ${baseName}`);
    }

    const mergedContent: string[] = [];
    for (const part of parts) {
      const content = readFileSync(part, 'utf-8');
      mergedContent.push(content);
    }

    const outputPath = join(dir, `${baseName}${ext}`);
    writeFileSync(outputPath, mergedContent.join('\n'), 'utf-8');

    for (const part of parts) {
      unlinkSync(part);
    }

    const indexPath = join(dir, `${baseName}-index${ext}`);
    if (existsSync(indexPath)) {
      unlinkSync(indexPath);
    }

    return outputPath;
  }

  /**
   * Generate index file content
   */
  private generateIndexFile(baseName: string, parts: string[]): string {
    const lines = [
      `# ${baseName} (Split Index)`,
      '',
      'This file was automatically split due to size limits.',
      '',
      '## Parts',
      '',
    ];

    for (let i = 0; i < parts.length; i++) {
      const partName = basename(parts[i]);
      if (!partName.includes('-index')) {
        lines.push(`- [Part ${i + 1}](./${partName})`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Write content with automatic splitting if needed
   */
  writeWithAutoSplit(filePath: string, content: string): SplitResult {
    writeFileSync(filePath, content, 'utf-8');

    if (this.needsSplit(filePath)) {
      return this.split(filePath);
    }

    return {
      success: true,
      originalFile: filePath,
      parts: [filePath],
      message: 'File written successfully',
    };
  }
}

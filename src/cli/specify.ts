import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadConfig, FeatureMeta } from '../types/index.js';

interface SpecifyOptions {
  description?: string;
  expectation?: string;
}

export async function specify(
  featureId: string,
  featureName: string,
  options: SpecifyOptions = {}
): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const branchName = `${featureId}-${featureName}`;
  const featureDir = join(cwd, config.specsDir, branchName);

  if (existsSync(featureDir)) {
    console.log(chalk.yellow(`Feature already exists: ${featureDir}`));
    process.exit(1);
  }

  mkdirSync(featureDir, { recursive: true });
  console.log(chalk.green('✓'), `Created: ${featureDir}`);

  const now = new Date().toISOString();
  const description = options.description || '';
  const expectation = options.expectation || '';

  const meta: FeatureMeta = {
    featureId,
    featureName,
    branch: branchName,
    createdAt: now,
    specCreatedAt: now,
    currentMigration: null,
    migrations: {},
    splits: [],
    commits: [],
    expectation: expectation || undefined,
  };

  writeFileSync(join(featureDir, '_meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
  console.log(chalk.green('✓'), 'Created: _meta.json');

  const expectationSection = expectation
    ? `## Expectation

> ${expectation}

`
    : `## Expectation

> What do you expect as the final outcome of this feature?

[Define your expectation here]

`;

  const specContent = `# ${featureName}

## Overview

${description}

${expectationSection}## Goals

- [ ] Goal 1
- [ ] Goal 2

## Non-Goals

- Out of scope item 1

## User Stories

### US1: [Story Title]

**As a** [user type]
**I want** [action]
**So that** [benefit]

#### Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Technical Requirements

### Architecture

[Describe the technical approach]

### Dependencies

- Dependency 1
- Dependency 2

## UI/UX (if applicable)

[ASCII mockups or description]

## Open Questions

- [ ] Question 1?
- [ ] Question 2?
`;

  writeFileSync(join(featureDir, 'spec.md'), specContent, 'utf-8');
  console.log(chalk.green('✓'), 'Created: spec.md');

  const interfacesContent = `/**
 * TypeScript interfaces for ${featureName}
 * Feature ID: ${featureId}
 *
 * Define types here FIRST, then implement with Zod schemas later.
 */

// Example interface - replace with actual types
export interface Example {
  id: string;
  name: string;
  createdAt: Date;
}

// Add your interfaces below
`;

  writeFileSync(join(featureDir, 'interfaces.ts'), interfacesContent, 'utf-8');
  console.log(chalk.green('✓'), 'Created: interfaces.ts');

  const changelogContent = `# Changelog - ${featureName}

All notable changes to this feature will be documented in this file.

## [Unreleased]

### Added
- Initial feature specification created
`;

  writeFileSync(join(featureDir, 'CHANGELOG.md'), changelogContent, 'utf-8');
  console.log(chalk.green('✓'), 'Created: CHANGELOG.md');

  console.log(chalk.cyan('\n✨ Feature structure created successfully!'));
  console.log(chalk.cyan('Next steps:'));
  console.log('  1. Edit spec.md with detailed requirements');
  console.log('  2. Define interfaces in interfaces.ts');
  console.log('  3. Run /sedd.clarify to start first migration');
}

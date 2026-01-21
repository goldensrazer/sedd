#!/usr/bin/env bash
# SEDD Specify - Creates initial feature structure
# Usage: ./sedd-specify.sh <feature_id> <feature_name> [description]

set -e

FEATURE_ID="$1"
FEATURE_NAME="$2"
DESCRIPTION="${3:-}"

if [ -z "$FEATURE_ID" ] || [ -z "$FEATURE_NAME" ]; then
    echo "Usage: ./sedd-specify.sh <feature_id> <feature_name> [description]"
    exit 1
fi

# Load config
SPECS_DIR=".sedd"
if [ -f "sedd.config.json" ]; then
    SPECS_DIR=$(grep -o '"specsDir"[[:space:]]*:[[:space:]]*"[^"]*"' sedd.config.json | cut -d'"' -f4)
    [ -z "$SPECS_DIR" ] && SPECS_DIR=".sedd"
fi

BRANCH_NAME="${FEATURE_ID}-${FEATURE_NAME}"
FEATURE_DIR="${SPECS_DIR}/${BRANCH_NAME}"

# Check if exists
if [ -d "$FEATURE_DIR" ]; then
    echo "Feature already exists: $FEATURE_DIR"
    exit 1
fi

# Create directory
mkdir -p "$FEATURE_DIR"
echo "Created: $FEATURE_DIR"

# Create _meta.json
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > "$FEATURE_DIR/_meta.json" << EOF
{
  "featureId": "$FEATURE_ID",
  "featureName": "$FEATURE_NAME",
  "branch": "$BRANCH_NAME",
  "createdAt": "$NOW",
  "specCreatedAt": "$NOW",
  "currentMigration": null,
  "migrations": {},
  "splits": [],
  "commits": []
}
EOF
echo "Created: _meta.json"

# Create spec.md
cat > "$FEATURE_DIR/spec.md" << EOF
# $FEATURE_NAME

## Overview

$DESCRIPTION

## Goals

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
EOF
echo "Created: spec.md"

# Create interfaces.ts
cat > "$FEATURE_DIR/interfaces.ts" << EOF
/**
 * TypeScript interfaces for $FEATURE_NAME
 * Feature ID: $FEATURE_ID
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
EOF
echo "Created: interfaces.ts"

# Create CHANGELOG.md
cat > "$FEATURE_DIR/CHANGELOG.md" << EOF
# Changelog - $FEATURE_NAME

All notable changes to this feature will be documented in this file.

## [Unreleased]

### Added
- Initial feature specification created
EOF
echo "Created: CHANGELOG.md"

echo ""
echo "Feature structure created successfully!"
echo "Next steps:"
echo "  1. Edit spec.md with detailed requirements"
echo "  2. Define interfaces in interfaces.ts"
echo "  3. Run /sedd.clarify to start first migration"

# Output JSON
echo "---SEDD-OUTPUT---"
echo "{\"success\":true,\"featureDir\":\"$FEATURE_DIR\",\"branch\":\"$BRANCH_NAME\",\"files\":[\"_meta.json\",\"spec.md\",\"interfaces.ts\",\"CHANGELOG.md\"]}"

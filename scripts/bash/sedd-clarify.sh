#!/usr/bin/env bash
# SEDD Clarify - Creates a new migration with clarify/tasks/decisions files
# Usage: ./sedd-clarify.sh [branch]

set -e

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')}"

if [[ ! "$BRANCH" =~ ^[0-9]{3}- ]]; then
    echo "Error: Not on a feature branch (current: $BRANCH)"
    exit 1
fi

# Load config
SPECS_DIR=".sedd"
if [ -f "sedd.config.json" ]; then
    SPECS_DIR=$(grep -o '"specsDir"[[:space:]]*:[[:space:]]*"[^"]*"' sedd.config.json | cut -d'"' -f4)
    [ -z "$SPECS_DIR" ] && SPECS_DIR=".sedd"
fi

# Find feature directory
FEATURE_DIR="${SPECS_DIR}/${BRANCH}"
[ ! -d "$FEATURE_DIR" ] && FEATURE_DIR="specs/${BRANCH}"

if [ ! -d "$FEATURE_DIR" ]; then
    echo "Error: Feature directory not found for branch: $BRANCH"
    exit 1
fi

# Check meta
META_PATH="$FEATURE_DIR/_meta.json"
if [ ! -f "$META_PATH" ]; then
    echo "Error: _meta.json not found. Run /sedd.specify first."
    exit 1
fi

# Get next migration ID
get_next_migration_id() {
    local max_id=0
    if command -v jq &> /dev/null; then
        max_id=$(jq -r '.migrations | keys | map(tonumber) | max // 0' "$META_PATH")
    else
        # Fallback without jq
        max_id=$(grep -oP '"id":\s*"\K[0-9]+' "$META_PATH" | sort -n | tail -1)
        [ -z "$max_id" ] && max_id=0
    fi
    printf "%03d" $((max_id + 1))
}

MIGRATION_ID=$(get_next_migration_id)
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
MIGRATION_FOLDER="${MIGRATION_ID}_${TIMESTAMP}"
MIGRATION_DIR="$FEATURE_DIR/$MIGRATION_FOLDER"

# Create migration directory
mkdir -p "$MIGRATION_DIR"
echo "Created migration: $MIGRATION_FOLDER"

# Get current migration for parent reference
CURRENT_MIGRATION=$(grep -oP '"currentMigration":\s*"\K[^"]+' "$META_PATH" 2>/dev/null || echo "")

# Create clarify.md
cat > "$MIGRATION_DIR/clarify.md" << EOF
# Clarification Session - Migration $MIGRATION_ID

**Timestamp:** $(date +"%Y-%m-%d %H:%M:%S")
**Branch:** $BRANCH

## Questions & Answers

<!-- Questions discussed during this clarification session -->

EOF
echo "Created: clarify.md"

# Create decisions.md
cat > "$MIGRATION_DIR/decisions.md" << EOF
# Decisions - Migration $MIGRATION_ID

**Timestamp:** $(date +"%Y-%m-%d %H:%M:%S")

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|

EOF
echo "Created: decisions.md"

# Create tasks.md
cat > "$MIGRATION_DIR/tasks.md" << EOF
# Tasks - Migration $MIGRATION_ID

**Migration:** $MIGRATION_ID
**Timestamp:** $TIMESTAMP
**Parent:** ${CURRENT_MIGRATION:-none}

## Tasks

<!-- Tasks will be added here by /sedd.tasks -->
<!-- Format: - [ ] T${MIGRATION_ID}-001 [US1] Task description -->

EOF
echo "Created: tasks.md"

# Update _meta.json (simplified without jq)
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if command -v jq &> /dev/null; then
    # With jq
    jq --arg id "$MIGRATION_ID" \
       --arg ts "$TIMESTAMP" \
       --arg folder "$MIGRATION_FOLDER" \
       --arg parent "$CURRENT_MIGRATION" \
       --arg now "$NOW" \
       '.currentMigration = $id |
        .migrations[$id] = {
          "id": $id,
          "timestamp": $ts,
          "folder": $folder,
          "parent": (if $parent == "" then null else $parent end),
          "status": "pending",
          "tasksTotal": 0,
          "tasksCompleted": 0,
          "createdAt": $now
        }' "$META_PATH" > "$META_PATH.tmp" && mv "$META_PATH.tmp" "$META_PATH"
else
    echo "Warning: jq not found. Please update _meta.json manually."
fi

echo "Updated: _meta.json"

echo ""
echo "Migration $MIGRATION_ID created successfully!"
echo "Next steps:"
echo "  1. Add questions/answers to clarify.md"
echo "  2. Document decisions in decisions.md"
echo "  3. Run /sedd.tasks to generate tasks"

# Output JSON
echo "---SEDD-OUTPUT---"
echo "{\"success\":true,\"migrationId\":\"$MIGRATION_ID\",\"migrationFolder\":\"$MIGRATION_FOLDER\",\"migrationDir\":\"$MIGRATION_DIR\",\"files\":[\"clarify.md\",\"decisions.md\",\"tasks.md\"]}"

#!/usr/bin/env bash
# SEDD Complete Task - Marks a task as completed
# Usage: ./sedd-complete-task.sh <task_id>

set -e

TASK_ID="$1"

if [ -z "$TASK_ID" ]; then
    echo "Usage: ./sedd-complete-task.sh <task_id>"
    echo "Example: ./sedd-complete-task.sh T001-001"
    exit 1
fi

# Validate task ID format
if [[ ! "$TASK_ID" =~ ^T([0-9]{3})-([0-9]{3})$ ]]; then
    echo "Error: Invalid task ID format. Expected: T001-001"
    exit 1
fi

MIG_ID="${BASH_REMATCH[1]}"

# Get current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')

if [[ ! "$BRANCH" =~ ^[0-9]{3}- ]]; then
    echo "Error: Not on a feature branch"
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
    echo "Error: Feature not found: $BRANCH"
    exit 1
fi

# Load meta
META_PATH="$FEATURE_DIR/_meta.json"
if [ ! -f "$META_PATH" ]; then
    echo "Error: _meta.json not found"
    exit 1
fi

# Find migration folder
MIG_FOLDER=$(grep -oP "\"folder\":\s*\"${MIG_ID}_[^\"]+\"" "$META_PATH" | cut -d'"' -f4)

if [ -z "$MIG_FOLDER" ]; then
    echo "Error: Migration $MIG_ID not found"
    exit 1
fi

TASKS_FILE="$FEATURE_DIR/$MIG_FOLDER/tasks.md"

if [ ! -f "$TASKS_FILE" ]; then
    echo "Error: tasks.md not found"
    exit 1
fi

# Check if already completed
if grep -q "\[x\] $TASK_ID" "$TASKS_FILE"; then
    echo "Task $TASK_ID is already completed"
    exit 0
fi

# Check if task exists
if ! grep -q "\[ \] $TASK_ID" "$TASKS_FILE"; then
    echo "Error: Task $TASK_ID not found"
    exit 1
fi

# Mark as complete
sed -i "s/\[ \] $TASK_ID/[x] $TASK_ID/g" "$TASKS_FILE"
echo "Completed: $TASK_ID"

# Update meta (requires jq)
if command -v jq &> /dev/null; then
    COMPLETED=$(jq -r ".migrations[\"$MIG_ID\"].tasksCompleted" "$META_PATH")
    TOTAL=$(jq -r ".migrations[\"$MIG_ID\"].tasksTotal" "$META_PATH")
    NEW_COMPLETED=$((COMPLETED + 1))

    if [ "$NEW_COMPLETED" -ge "$TOTAL" ]; then
        NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        jq --arg id "$MIG_ID" --arg now "$NOW" \
           '.migrations[$id].tasksCompleted += 1 |
            .migrations[$id].status = "completed" |
            .migrations[$id].completedAt = $now' "$META_PATH" > "$META_PATH.tmp" && mv "$META_PATH.tmp" "$META_PATH"
        echo "Migration $MIG_ID completed!"
    else
        jq --arg id "$MIG_ID" \
           '.migrations[$id].tasksCompleted += 1' "$META_PATH" > "$META_PATH.tmp" && mv "$META_PATH.tmp" "$META_PATH"
    fi

    echo "Progress: $NEW_COMPLETED/$TOTAL tasks"
fi

# Output JSON
echo "---SEDD-OUTPUT---"
echo "{\"success\":true,\"taskId\":\"$TASK_ID\",\"migrationId\":\"$MIG_ID\"}"

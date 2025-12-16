# Usage Guide

This guide explains how to use the Requirements Tracker web UI.

## Opening the UI

```bash
req ui              # Opens on port 3000
req ui --port 8080  # Custom port
```

The UI opens automatically in your browser.

## UI Layout

The interface has three main areas:

```
+----------------------------------------------------------+
| Requirements Tracker                    [Docs] [Chat]    |
+----------------------------------------------------------+
| Filter: All | Planned | Done | Untested | Verified | ... |
+----------------------------------------------------------+
|  Requirements  |  Detail View        |  Chat (optional)  |
|  List (left)   |  (center)           |  (right)          |
+----------------------------------------------------------+
```

## Dashboard Filters

The filter bar shows counts for each category:

| Filter | Description |
|--------|-------------|
| **All** | Show all requirements |
| **Planned** | Requirements not yet implemented (`status: planned`) |
| **Done** | Requirements marked as implemented (`status: done`) |
| **Untested** | Done requirements with no linked tests |
| **Verified** | Done requirements with AI-assessed, unchanged tests |
| **Unverified** | Done requirements with tests but no AI assessment |
| **Stale** | Done requirements where tests changed after assessment |

Click a filter to show only matching requirements. Click again to clear.

## Requirements List

The left panel shows requirements grouped by folder path:

- **Requirement ID** - File name (e.g., `REQ_login.yml`)
- **Status badge** - "Planned" or "Done" with verification status
- **Test count** - Number of linked tests
- **Question indicator** - Shows if unanswered questions exist

Click a requirement to view its details.

## Detail View

The center panel shows the selected requirement:

### Header
- Requirement ID with status badges
- Coverage indicator: "Coverage OK" (green) or "Needs Coverage" (red)

### Requirement Text
The Gherkin-format specification (Given/When/Then).

### Source
Where the requirement came from:
- Source type (doc, slack, email, meeting, ticket, manual)
- Description and optional URL
- Date if provided

### Linked Tests
Tests connected to this requirement:
- Test identifier (file:name)
- Hash for change detection
- "Stale" indicator if test changed since assessment

### AI Assessment
When present, shows:
- **Sufficient**: Whether coverage is adequate (Yes/No)
- **Notes**: AI's reasoning
- **Test Comments**: Per-test feedback
- **Suggested Tests**: Recommendations for additional tests

### Questions
Clarification questions about the requirement:
- Question text
- Answer (if provided)
- Timestamp

## Chat Assistant

Click "Chat" in the header to open the AI assistant panel.

The assistant can:
- Answer questions about requirements
- Help assess test coverage
- Suggest additional tests
- Explain verification status

### Using the Chat
1. Type your message in the input field
2. Press Enter or click Send
3. The assistant streams its response
4. It can use tools (file reading, CLI commands) to help

## Understanding Status

### Implementation Status

| Status | Meaning |
|--------|---------|
| **Planned** | Requirement is defined but not yet implemented |
| **Done** | Requirement has been implemented |

Set status with: `req status <path> --done` or `req status <path> --planned`

### Verification Status

Only applies to "Done" requirements:

| Status | Meaning |
|--------|---------|
| **N/A** | No tests linked |
| **Unverified** | Has tests, no AI assessment |
| **Verified** | AI assessed, tests unchanged |
| **Stale** | Tests changed since assessment |

### Coverage Sufficiency

From AI assessment:

| Indicator | Meaning |
|-----------|---------|
| **Coverage OK** | AI determined tests adequately cover the requirement |
| **Needs Coverage** | AI found gaps in test coverage |
| *No indicator* | No AI assessment yet |

## Workflow Tips

### Adding a New Requirement

1. Use CLI to add: `req add path/REQ_name.yml --gherkin "..." --source-type doc --source-desc "..."`
2. Requirement appears in UI immediately (live reload)
3. Status starts as "planned"

### Linking Tests

1. Identify the test function to link
2. Use CLI: `req link path/REQ_name.yml test/file.test.ts:test name`
3. Test appears in detail view

### Getting Verified

1. Link relevant tests to the requirement
2. Ask the chat assistant to assess coverage
3. Or use CLI: `req assess path/REQ_name.yml --result '{"sufficient": true, "notes": "..."}'`
4. Verification status updates to "Verified"

### Handling Staleness

When tests change after assessment:
1. The requirement shows "Stale" status
2. Review the test changes
3. Re-assess coverage to return to "Verified"

## Orphaned Tests

Tests not linked to any requirement appear at the bottom of the requirements list.

To handle orphaned tests:
- Link them to requirements: `req link ...`
- Or ignore them: `req ignore-test file:name --reason "..."`

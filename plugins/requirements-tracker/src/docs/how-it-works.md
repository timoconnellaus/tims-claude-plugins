# How It Works

Deep dive into the internal mechanics of Requirements Tracker.

## Test Hash Computation

Each test is identified by a SHA-256 hash of its body. This enables change detection.

### Hash Algorithm

```typescript
import { createHash } from "crypto";

function computeTestHash(testBody: string): string {
  return createHash("sha256")
    .update(testBody)
    .digest("hex")
    .slice(0, 16);  // First 16 chars for readability
}
```

### Test Body Extraction

The system parses test files to extract individual test bodies:

1. Parse file as TypeScript AST
2. Find test calls: `test()`, `it()`, `describe()` blocks
3. Extract the callback function body
4. Normalize whitespace
5. Compute hash

**Example:**

```typescript
// src/auth.test.ts
test("validates login credentials", () => {
  const result = login("user", "pass");
  expect(result.success).toBe(true);
});
```

This extracts:
- **File:** `src/auth.test.ts`
- **Identifier:** `validates login credentials`
- **Body:** The function contents (normalized)
- **Hash:** e.g., `a1b2c3d4e5f6g7h8`

## Staleness Detection

When tests change, their assessments become "stale":

```
┌─────────────────┐      ┌─────────────────┐
│  Test v1        │      │  Requirement    │
│  hash: abc123   │─────▶│  assessment     │
└─────────────────┘      │  testHashes:    │
                         │    [abc123]     │
                         └─────────────────┘
                                │
                                ▼ Test changes
┌─────────────────┐      ┌─────────────────┐
│  Test v2        │      │  STALE!         │
│  hash: def456   │      │  testHashes:    │
└─────────────────┘      │    [abc123]     │
                         │  current: def456│
                         └─────────────────┘
```

### Staleness Check Logic

```typescript
function getVerificationStatus(requirement: Requirement, currentHashes: Map<string, string>): VerificationStatus {
  // No tests = n/a
  if (requirement.tests.length === 0) {
    return "n/a";
  }

  // No assessment = unverified
  if (!requirement.aiAssessment) {
    return "unverified";
  }

  // Check if any test hash changed
  for (const test of requirement.tests) {
    const currentHash = currentHashes.get(`${test.file}:${test.identifier}`);
    if (currentHash !== test.hash) {
      return "stale";
    }
  }

  return "verified";
}
```

## AI Assessment Workflow

The chat assistant can assess test coverage:

### 1. Read Requirement
```
Requirement: auth/REQ_login.yml
Gherkin: Given a user with valid credentials...
```

### 2. Read Linked Tests
```
Test: src/auth.test.ts:validates login
Body: const result = login("user", "pass")...
```

### 3. Analyze Coverage
Claude evaluates:
- Does the test verify the Given/When/Then?
- Are edge cases covered?
- What's missing?

### 4. Produce Assessment
```json
{
  "sufficient": true,
  "notes": "Tests cover the happy path. Consider adding tests for invalid credentials.",
  "testComments": [...],
  "suggestedTests": [...]
}
```

### 5. Store Result
Assessment saved to requirement file with timestamp.

## Real-Time Updates (SSE)

The UI stays in sync using Server-Sent Events:

### Server Side

```typescript
// server.ts
const clients = new Set<ReadableStreamController>();

// Watch for file changes
watch(".requirements/", { recursive: true }, () => {
  for (const client of clients) {
    client.enqueue("data: refresh\n\n");
  }
});

// SSE endpoint
routes["/api/events"] = {
  GET() {
    return new Response(
      new ReadableStream({
        start(controller) {
          clients.add(controller);
        },
        cancel() {
          clients.delete(controller);
        }
      }),
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }
};
```

### Client Side

```typescript
// app.tsx
useEffect(() => {
  const eventSource = new EventSource("/api/events");

  eventSource.onmessage = (event) => {
    if (event.data === "refresh") {
      fetchData();  // Re-fetch requirements
    }
  };

  return () => eventSource.close();
}, []);
```

### Watch Directories

The server watches:
- `.requirements/` - Requirement file changes
- Test directories (from `testGlob`) - Test file changes

Changes trigger immediate UI refresh.

## Orphan Detection

Tests not linked to any requirement are "orphaned":

```typescript
function findOrphanedTests(
  allTests: ExtractedTest[],
  requirements: Requirement[],
  ignoredTests: IgnoredTest[]
): ExtractedTest[] {
  // Get all linked test identifiers
  const linked = new Set<string>();
  for (const req of requirements) {
    for (const test of req.tests) {
      linked.add(`${test.file}:${test.identifier}`);
    }
  }

  // Get all ignored test identifiers
  const ignored = new Set<string>();
  for (const test of ignoredTests) {
    ignored.add(`${test.file}:${test.identifier}`);
  }

  // Find orphans
  return allTests.filter(test => {
    const id = `${test.file}:${test.identifier}`;
    return !linked.has(id) && !ignored.has(id);
  });
}
```

## Chat Integration

The chat uses Claude Agent SDK with tool access:

### Available Tools

In the chat context, Claude can:
- Read requirement files
- Read test files
- Run `req` CLI commands
- Access the requirements-tracker skill

### Session Management

```typescript
// claude-chat-handler.ts
const handler = createClaudeChatHandler({
  model: "claude-sonnet-4-5-20250929",
  maxTurns: 20,
  plugins: ["requirements-tracker"],

  onToolCall: async (tool, input) => {
    // Execute tool and return result
  }
});
```

### Streaming

Responses stream via SSE for real-time display:

```
data: {"type": "delta", "content": "Let me "}
data: {"type": "delta", "content": "analyze "}
data: {"type": "delta", "content": "the tests..."}
data: {"type": "tool_call", "name": "read_file", ...}
data: {"type": "tool_result", ...}
data: {"type": "complete"}
```

## Cache System

Test extraction is cached for performance:

### cache.json

```json
{
  "version": 1,
  "generatedAt": "2024-01-20T10:00:00Z",
  "fileMtimes": {
    "src/auth.test.ts": 1705744800000
  },
  "tests": {
    "src/auth.test.ts:validates login": "a1b2c3d4"
  }
}
```

### Cache Invalidation

Cache is invalidated when:
- File mtime changes
- `--no-cache` flag used
- Cache version mismatch

### Cache Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  req check  │────▶│  Check      │────▶│  Return     │
└─────────────┘     │  mtimes     │     │  cached     │
                    └─────────────┘     └─────────────┘
                           │
                           ▼ mtime changed
                    ┌─────────────┐     ┌─────────────┐
                    │  Re-parse   │────▶│  Update     │
                    │  file       │     │  cache      │
                    └─────────────┘     └─────────────┘
```

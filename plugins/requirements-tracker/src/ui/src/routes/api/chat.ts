import { createFileRoute } from "@tanstack/react-router";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClaudeChatHandler } from "../../../handler";

// Plugin directory for loading the requirements-tracker plugin
const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginDir = dirname(dirname(dirname(dirname(dirname(__dirname)))));

// Create chat handler lazily (initialized on first request)
let chatHandler: ReturnType<typeof createClaudeChatHandler> | null = null;

// Get user's project directory from environment variable set by ui.ts
function getProjectCwd(): string {
  return process.env.REQ_PROJECT_CWD || process.cwd();
}

function getChatHandler() {
  if (chatHandler) return chatHandler;

  const cwd = getProjectCwd();

  chatHandler = createClaudeChatHandler({
    defaultModel: 'opus',
    requireToolApproval: false,
    cwd,
    plugins: [{ type: 'local', path: pluginDir }],
    settingSources: ['user', 'project', 'local'],
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: `
You are assisting with requirements tracking and verification. You have access to the 'req' CLI tool for managing requirements.

## CLI Commands

\`\`\`
req init [options]                                    Create .requirements/ folder
req add <path> --gherkin "..." --source-type <type> --source-desc "..."
req link <path> <file:identifier>                     Link a test to a requirement
req unlink <path> <file:identifier>                   Remove a test link
req status <path> [--done | --planned]                Get or set implementation status
req check [path] [--json] [--no-cache]                Check test coverage status
req assess <path> --result '<json>'                   Update AI assessment
req move <source> <dest>                              Move requirement to new path
req rename <path> <new-name>                          Rename a requirement file
req ignore-test <file:identifier> --reason "..."      Mark test as intentionally unlinked
req unignore-test <file:identifier>                   Remove test from ignored list
req ui [--port <number>]                              Start web UI
\`\`\`

When verifying requirements, analyze linked tests to determine if they cover the requirement's gherkin.

**Suggesting scenarios:** When tests cover behaviors not documented, include them in 'suggestedScenarios':
- **name**: short snake_case identifier
- **gherkin**: Given/When/Then format
- **rationale**: why this should be documented

When creating requirements:
- ALWAYS include a 'gherkin' field with the primary scenario
- Use 'scenarios' array ONLY for additional edge cases
`,
    },
    canUseTool: async (toolName, input) => {
      if (['Read', 'Glob', 'Grep'].includes(toolName)) {
        return { behavior: 'allow', updatedInput: input };
      }
      if (toolName === 'Bash') {
        const command = (input as { command?: string }).command || '';
        if (command.trim().startsWith('req ')) {
          return { behavior: 'allow', updatedInput: input };
        }
      }
      return { behavior: 'allow', updatedInput: input };
    },
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: true,
    },
  });

  return chatHandler;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const handler = getChatHandler();
        return handler(request);
      },
    },
  },
});

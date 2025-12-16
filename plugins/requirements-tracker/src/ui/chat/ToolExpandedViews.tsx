

import * as React from "react"
import { cn } from "../lib/utils"
import { FileText, ExternalLink } from "lucide-react"

interface ToolExpandedViewProps {
  input: Record<string, unknown>
  result?: string
}

// ============ Utility Components ============

function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <pre className={cn(
      "text-xs bg-zinc-900 text-zinc-100 rounded p-3 overflow-x-auto font-mono",
      className
    )}>
      {children}
    </pre>
  )
}

function TerminalOutput({ children }: { children: React.ReactNode }) {
  return (
    <pre className="text-xs bg-zinc-950 text-zinc-300 rounded p-3 overflow-x-auto max-h-[300px] overflow-y-auto font-mono whitespace-pre-wrap">
      {children}
    </pre>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium text-muted-foreground mb-1">
      {children}
    </div>
  )
}

function FilePath({ path }: { path: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
      <FileText className="h-3 w-3" />
      <code className="bg-muted px-1.5 py-0.5 rounded">{path}</code>
    </div>
  )
}

// ============ Bash ============

function BashExpandedView({ input, result }: ToolExpandedViewProps) {
  const command = input.command as string | undefined

  return (
    <div className="space-y-3">
      {command && (
        <div>
          <Label>Command</Label>
          <CodeBlock>$ {command}</CodeBlock>
        </div>
      )}
      {result && (
        <div>
          <Label>Output</Label>
          <TerminalOutput>{result}</TerminalOutput>
        </div>
      )}
    </div>
  )
}

// ============ Read ============

function ReadExpandedView({ input, result }: ToolExpandedViewProps) {
  const filePath = input.file_path as string | undefined
  const offset = input.offset as number | undefined
  const limit = input.limit as number | undefined

  const lineInfo = offset || limit
    ? `Lines ${offset || 1}${limit ? `-${(offset || 1) + limit - 1}` : "+"}`
    : null

  return (
    <div className="space-y-3">
      {filePath && <FilePath path={filePath} />}
      {lineInfo && (
        <div className="text-xs text-muted-foreground">{lineInfo}</div>
      )}
      {result && (
        <div>
          <Label>Contents</Label>
          <CodeBlock className="max-h-[300px] overflow-y-auto">{result}</CodeBlock>
        </div>
      )}
    </div>
  )
}

// ============ Write ============

function WriteExpandedView({ input, result }: ToolExpandedViewProps) {
  const filePath = input.file_path as string | undefined
  const content = input.content as string | undefined

  // Truncate content preview
  const preview = content
    ? content.split("\n").slice(0, 20).join("\n") + (content.split("\n").length > 20 ? "\n..." : "")
    : null

  return (
    <div className="space-y-3">
      {filePath && <FilePath path={filePath} />}
      {preview && (
        <div>
          <Label>Content Written</Label>
          <CodeBlock className="max-h-[200px] overflow-y-auto">{preview}</CodeBlock>
        </div>
      )}
      {result && (
        <div className="text-xs text-green-600 dark:text-green-400">
          {result}
        </div>
      )}
    </div>
  )
}

// ============ Edit ============

function EditExpandedView({ input, result }: ToolExpandedViewProps) {
  const filePath = input.file_path as string | undefined
  const oldString = input.old_string as string | undefined
  const newString = input.new_string as string | undefined
  const replaceAll = input.replace_all as boolean | undefined

  return (
    <div className="space-y-3">
      {filePath && <FilePath path={filePath} />}
      {replaceAll && (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          Replacing all occurrences
        </div>
      )}
      <div className="grid gap-2">
        {oldString && (
          <div>
            <Label>Removed</Label>
            <pre className="text-xs bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 rounded p-2 overflow-x-auto max-h-[150px] overflow-y-auto font-mono whitespace-pre-wrap">
              {oldString}
            </pre>
          </div>
        )}
        {newString && (
          <div>
            <Label>Added</Label>
            <pre className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900 rounded p-2 overflow-x-auto max-h-[150px] overflow-y-auto font-mono whitespace-pre-wrap">
              {newString}
            </pre>
          </div>
        )}
      </div>
      {result && (
        <div className="text-xs text-green-600 dark:text-green-400">
          {result}
        </div>
      )}
    </div>
  )
}

// ============ Glob ============

function GlobExpandedView({ input, result }: ToolExpandedViewProps) {
  const pattern = input.pattern as string | undefined
  const path = input.path as string | undefined

  // Parse result as file list
  const files = result?.split("\n").filter(Boolean) || []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {pattern && (
          <div className="bg-muted px-2 py-1 rounded">
            <span className="text-muted-foreground">Pattern:</span>{" "}
            <code>{pattern}</code>
          </div>
        )}
        {path && (
          <div className="bg-muted px-2 py-1 rounded">
            <span className="text-muted-foreground">In:</span>{" "}
            <code>{path}</code>
          </div>
        )}
      </div>
      {files.length > 0 && (
        <div>
          <Label>Found {files.length} file{files.length !== 1 ? "s" : ""}</Label>
          <div className="bg-muted rounded p-2 max-h-[200px] overflow-y-auto">
            {files.map((file, i) => (
              <div key={i} className="text-xs font-mono py-0.5 flex items-center gap-2">
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                {file}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============ Grep ============

function GrepExpandedView({ input, result }: ToolExpandedViewProps) {
  const pattern = input.pattern as string | undefined
  const path = input.path as string | undefined
  const caseInsensitive = input["-i"] as boolean | undefined

  // Parse result - could be file list or content with matches
  const lines = result?.split("\n").filter(Boolean) || []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {pattern && (
          <div className="bg-muted px-2 py-1 rounded">
            <span className="text-muted-foreground">Pattern:</span>{" "}
            <code>{pattern}</code>
          </div>
        )}
        {path && (
          <div className="bg-muted px-2 py-1 rounded">
            <span className="text-muted-foreground">In:</span>{" "}
            <code>{path}</code>
          </div>
        )}
        {caseInsensitive && (
          <div className="bg-muted px-2 py-1 rounded text-muted-foreground">
            Case insensitive
          </div>
        )}
      </div>
      {lines.length > 0 && (
        <div>
          <Label>Results</Label>
          <div className="bg-zinc-900 text-zinc-100 rounded p-2 max-h-[300px] overflow-y-auto font-mono text-xs">
            {lines.map((line, i) => (
              <div key={i} className="py-0.5 whitespace-pre-wrap">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============ WebFetch ============

function WebFetchExpandedView({ input, result }: ToolExpandedViewProps) {
  const url = input.url as string | undefined
  const prompt = input.prompt as string | undefined

  return (
    <div className="space-y-3">
      {url && (
        <div>
          <Label>URL</Label>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            {url}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      {prompt && (
        <div>
          <Label>Prompt</Label>
          <div className="text-xs bg-muted rounded p-2">{prompt}</div>
        </div>
      )}
      {result && (
        <div>
          <Label>Result</Label>
          <div className="text-xs bg-muted rounded p-2 max-h-[200px] overflow-y-auto whitespace-pre-wrap">
            {result}
          </div>
        </div>
      )}
    </div>
  )
}

// ============ WebSearch ============

function WebSearchExpandedView({ input, result }: ToolExpandedViewProps) {
  const query = input.query as string | undefined

  return (
    <div className="space-y-3">
      {query && (
        <div>
          <Label>Query</Label>
          <div className="text-sm font-medium">{query}</div>
        </div>
      )}
      {result && (
        <div>
          <Label>Results</Label>
          <div className="text-xs bg-muted rounded p-2 max-h-[300px] overflow-y-auto whitespace-pre-wrap">
            {result}
          </div>
        </div>
      )}
    </div>
  )
}

// ============ Agent/Task ============

function AgentExpandedView({ input, result }: ToolExpandedViewProps) {
  const description = input.description as string | undefined
  const subagentType = input.subagent_type as string | undefined
  const model = input.model as string | undefined
  const prompt = input.prompt as string | undefined

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {subagentType && (
          <div className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded">
            {subagentType}
          </div>
        )}
        {model && (
          <div className="bg-muted px-2 py-1 rounded text-muted-foreground">
            {model}
          </div>
        )}
      </div>
      {prompt && (
        <div>
          <Label>Prompt</Label>
          <div className="text-xs bg-muted rounded p-2 max-h-[150px] overflow-y-auto whitespace-pre-wrap">
            {prompt}
          </div>
        </div>
      )}
      {result && (
        <div>
          <Label>Response</Label>
          <div className="text-xs bg-muted rounded p-2 max-h-[200px] overflow-y-auto whitespace-pre-wrap">
            {result}
          </div>
        </div>
      )}
    </div>
  )
}

// ============ TodoWrite ============

function TodoWriteExpandedView({ input, result }: ToolExpandedViewProps) {
  const todos = input.todos as Array<{ content: string; status: string }> | undefined

  return (
    <div className="space-y-3">
      {todos && todos.length > 0 && (
        <div>
          <Label>Tasks</Label>
          <div className="space-y-1">
            {todos.map((todo, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  todo.status === "completed" && "bg-green-500",
                  todo.status === "in_progress" && "bg-blue-500",
                  todo.status === "pending" && "bg-gray-400"
                )} />
                <span className={cn(
                  todo.status === "completed" && "line-through text-muted-foreground"
                )}>
                  {todo.content}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {result && (
        <div className="text-xs text-green-600 dark:text-green-400">
          {result}
        </div>
      )}
    </div>
  )
}

// ============ Default Fallback ============

function DefaultExpandedView({ input, result }: ToolExpandedViewProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Input</Label>
        <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-[150px] overflow-y-auto">
          {JSON.stringify(input, null, 2)}
        </pre>
      </div>
      {result && (
        <div>
          <Label>Result</Label>
          <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}

// ============ Main Export ============

export function ToolExpandedView({
  name,
  input,
  result,
  error,
}: {
  name: string
  input: Record<string, unknown>
  result?: string
  error?: string
}) {
  const props = { input, result }

  let content: React.ReactNode

  switch (name) {
    case "Bash":
      content = <BashExpandedView {...props} />
      break
    case "Read":
      content = <ReadExpandedView {...props} />
      break
    case "Write":
      content = <WriteExpandedView {...props} />
      break
    case "Edit":
      content = <EditExpandedView {...props} />
      break
    case "Glob":
      content = <GlobExpandedView {...props} />
      break
    case "Grep":
      content = <GrepExpandedView {...props} />
      break
    case "WebFetch":
      content = <WebFetchExpandedView {...props} />
      break
    case "WebSearch":
      content = <WebSearchExpandedView {...props} />
      break
    case "Task":
    case "Agent":
      content = <AgentExpandedView {...props} />
      break
    case "TodoWrite":
      content = <TodoWriteExpandedView {...props} />
      break
    default:
      content = <DefaultExpandedView {...props} />
  }

  return (
    <div className="px-3 pb-3 pt-1">
      {content}
      {error && (
        <div className="mt-3">
          <Label>Error</Label>
          <pre className="text-xs bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded p-2 overflow-x-auto">
            {error}
          </pre>
        </div>
      )}
    </div>
  )
}

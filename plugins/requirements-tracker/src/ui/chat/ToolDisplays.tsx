

import * as React from "react"
import {
  Terminal,
  FileText,
  FilePlus,
  FileEdit,
  Search,
  FileSearch,
  Globe,
  Bot,
  ListTodo,
  FileCode,
} from "lucide-react"

interface ToolDisplayProps {
  input: Record<string, unknown>
}

// Utility to truncate strings
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + "..."
}

// Utility to get basename from path
function basename(path: string): string {
  return path.split("/").pop() || path
}

// Utility to get domain from URL
function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

// ============ Tool Display Components ============

function BashToolDisplay({ input }: ToolDisplayProps) {
  const description = input.description as string | undefined
  const command = input.command as string | undefined

  return (
    <div className="flex items-center gap-2">
      <Terminal className="h-4 w-4 shrink-0 text-orange-500" />
      <span className="truncate">
        {description || (command ? truncate(command, 50) : "Running command")}
      </span>
    </div>
  )
}

function ReadToolDisplay({ input }: ToolDisplayProps) {
  const filePath = input.file_path as string | undefined

  return (
    <div className="flex items-center gap-2">
      <FileText className="h-4 w-4 shrink-0 text-blue-500" />
      <span className="truncate">
        Reading {filePath ? basename(filePath) : "file"}
      </span>
    </div>
  )
}

function WriteToolDisplay({ input }: ToolDisplayProps) {
  const filePath = input.file_path as string | undefined

  return (
    <div className="flex items-center gap-2">
      <FilePlus className="h-4 w-4 shrink-0 text-green-500" />
      <span className="truncate">
        Writing {filePath ? basename(filePath) : "file"}
      </span>
    </div>
  )
}

function EditToolDisplay({ input }: ToolDisplayProps) {
  const filePath = input.file_path as string | undefined

  return (
    <div className="flex items-center gap-2">
      <FileEdit className="h-4 w-4 shrink-0 text-yellow-500" />
      <span className="truncate">
        Editing {filePath ? basename(filePath) : "file"}
      </span>
    </div>
  )
}

function GlobToolDisplay({ input }: ToolDisplayProps) {
  const pattern = input.pattern as string | undefined

  return (
    <div className="flex items-center gap-2">
      <Search className="h-4 w-4 shrink-0 text-purple-500" />
      <span className="truncate">
        Finding files: {pattern ? truncate(pattern, 40) : "..."}
      </span>
    </div>
  )
}

function GrepToolDisplay({ input }: ToolDisplayProps) {
  const pattern = input.pattern as string | undefined

  return (
    <div className="flex items-center gap-2">
      <FileSearch className="h-4 w-4 shrink-0 text-purple-500" />
      <span className="truncate">
        Searching: {pattern ? truncate(pattern, 40) : "..."}
      </span>
    </div>
  )
}

function WebFetchToolDisplay({ input }: ToolDisplayProps) {
  const url = input.url as string | undefined

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 shrink-0 text-cyan-500" />
      <span className="truncate">
        Fetching {url ? getDomain(url) : "URL"}
      </span>
    </div>
  )
}

function WebSearchToolDisplay({ input }: ToolDisplayProps) {
  const query = input.query as string | undefined

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 shrink-0 text-cyan-500" />
      <span className="truncate">
        Searching: {query ? truncate(query, 40) : "..."}
      </span>
    </div>
  )
}

function AgentToolDisplay({ input }: ToolDisplayProps) {
  const description = input.description as string | undefined
  const subagentType = input.subagent_type as string | undefined

  return (
    <div className="flex items-center gap-2">
      <Bot className="h-4 w-4 shrink-0 text-indigo-500" />
      <span className="truncate">
        {description || "Running agent"}
      </span>
      {subagentType && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
          {subagentType}
        </span>
      )}
    </div>
  )
}

function TodoWriteToolDisplay({ input }: ToolDisplayProps) {
  const todos = input.todos as unknown[] | undefined

  return (
    <div className="flex items-center gap-2">
      <ListTodo className="h-4 w-4 shrink-0 text-emerald-500" />
      <span className="truncate">
        Updating tasks {todos ? `(${todos.length})` : ""}
      </span>
    </div>
  )
}

function NotebookEditToolDisplay({ input }: ToolDisplayProps) {
  const notebookPath = input.notebook_path as string | undefined
  const editMode = input.edit_mode as string | undefined

  return (
    <div className="flex items-center gap-2">
      <FileCode className="h-4 w-4 shrink-0 text-orange-500" />
      <span className="truncate">
        {editMode === "insert" ? "Adding to" : editMode === "delete" ? "Removing from" : "Editing"}{" "}
        {notebookPath ? basename(notebookPath) : "notebook"}
      </span>
    </div>
  )
}

// ============ Main Export ============

export function ToolDisplay({ name, input }: { name: string; input: Record<string, unknown> }) {
  switch (name) {
    case "Bash":
      return <BashToolDisplay input={input} />
    case "Read":
      return <ReadToolDisplay input={input} />
    case "Write":
      return <WriteToolDisplay input={input} />
    case "Edit":
      return <EditToolDisplay input={input} />
    case "Glob":
      return <GlobToolDisplay input={input} />
    case "Grep":
      return <GrepToolDisplay input={input} />
    case "WebFetch":
      return <WebFetchToolDisplay input={input} />
    case "WebSearch":
      return <WebSearchToolDisplay input={input} />
    case "Task":
    case "Agent":
      return <AgentToolDisplay input={input} />
    case "TodoWrite":
      return <TodoWriteToolDisplay input={input} />
    case "NotebookEdit":
      return <NotebookEditToolDisplay input={input} />
    default:
      return null
  }
}

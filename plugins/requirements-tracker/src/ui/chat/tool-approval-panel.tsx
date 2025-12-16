

import * as React from "react"
import { cn } from "../lib/utils"
import { Button } from "../shadcn/button"
import {
  Check,
  X,
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
  ChevronRight,
  Wrench,
} from "lucide-react"
import type { PermissionRequest } from "./types"

interface ToolApprovalPanelProps {
  permissionRequest: PermissionRequest
  onApprove: () => void
  onDeny: () => void
  className?: string
}

// Get icon for tool type
function getToolIcon(toolName: string, className: string = "h-4 w-4") {
  const iconClass = cn(className, "shrink-0")
  switch (toolName) {
    case "Bash":
      return <Terminal className={cn(iconClass, "text-orange-500")} />
    case "Read":
      return <FileText className={cn(iconClass, "text-blue-500")} />
    case "Write":
      return <FilePlus className={cn(iconClass, "text-green-500")} />
    case "Edit":
      return <FileEdit className={cn(iconClass, "text-yellow-500")} />
    case "Glob":
      return <FileSearch className={cn(iconClass, "text-purple-500")} />
    case "Grep":
      return <Search className={cn(iconClass, "text-cyan-500")} />
    case "WebFetch":
    case "WebSearch":
      return <Globe className={cn(iconClass, "text-indigo-500")} />
    case "Task":
      return <Bot className={cn(iconClass, "text-pink-500")} />
    case "TodoWrite":
      return <ListTodo className={cn(iconClass, "text-teal-500")} />
    case "NotebookEdit":
      return <FileCode className={cn(iconClass, "text-amber-500")} />
    default:
      return <Wrench className={cn(iconClass, "text-muted-foreground")} />
  }
}

// Get compact description for tool
function getToolSummary(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Bash": {
      const command = input.command as string | undefined
      const desc = input.description as string | undefined
      if (desc) return desc
      if (command) return command.length > 60 ? command.slice(0, 60) + "..." : command
      return "shell command"
    }
    case "Read": {
      const filePath = input.file_path as string | undefined
      return filePath ? filePath.split("/").pop() || filePath : "file"
    }
    case "Write": {
      const filePath = input.file_path as string | undefined
      return filePath ? filePath.split("/").pop() || filePath : "file"
    }
    case "Edit": {
      const filePath = input.file_path as string | undefined
      return filePath ? filePath.split("/").pop() || filePath : "file"
    }
    case "Glob": {
      const pattern = input.pattern as string | undefined
      return pattern || "pattern"
    }
    case "Grep": {
      const pattern = input.pattern as string | undefined
      return pattern ? `"${pattern}"` : "pattern"
    }
    case "WebFetch": {
      const url = input.url as string | undefined
      if (!url) return "URL"
      try {
        return new URL(url).hostname
      } catch {
        return url.slice(0, 30)
      }
    }
    case "WebSearch": {
      const query = input.query as string | undefined
      return query ? `"${query}"` : "query"
    }
    case "Task": {
      const description = input.description as string | undefined
      return description || "sub-agent"
    }
    default:
      return toolName
  }
}

export function ToolApprovalPanel({
  permissionRequest,
  onApprove,
  onDeny,
  className,
}: ToolApprovalPanelProps) {
  const { toolName, toolInput } = permissionRequest

  return (
    <div
      className={cn(
        // Match ChatInput: p-4 border-t bg-background, with min-h to match textarea area
        "flex items-center gap-2 p-4 border-t bg-background min-h-[92px]",
        className
      )}
    >
      {/* Tool info - matches textarea area */}
      <div className="flex items-center gap-2 min-w-0 flex-1 h-[60px] px-3 rounded-md border border-input bg-transparent">
        {getToolIcon(toolName)}
        <span className="font-medium text-sm">{toolName}</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground truncate">
          {getToolSummary(toolName, toolInput)}
        </span>
      </div>

      {/* Action buttons - match send button size */}
      <Button
        onClick={onDeny}
        variant="outline"
        size="icon"
        className="shrink-0 h-10 w-10"
        aria-label="Deny tool"
      >
        <X className="h-4 w-4" />
      </Button>
      <Button
        onClick={onApprove}
        size="icon"
        className="shrink-0 h-10 w-10"
        aria-label="Allow tool"
      >
        <Check className="h-4 w-4" />
      </Button>
    </div>
  )
}

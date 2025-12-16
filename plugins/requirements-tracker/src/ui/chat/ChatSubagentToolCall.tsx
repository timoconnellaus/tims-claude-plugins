

import * as React from "react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { cn } from "../lib/utils"
import { Button } from "../shadcn/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../shadcn/collapsible"
import { Bot, ChevronRight, Check, Loader2, AlertCircle, Copy } from "lucide-react"
import { ChatToolCall } from "./ChatToolCall"
import type { ToolCall } from "./types"

interface ChatSubagentToolCallProps {
  toolCall: ToolCall
  className?: string
  inGroup?: boolean
}

// Markdown rendering component for agent responses
function MarkdownContent({ content, id }: { content: string; id: string }) {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null)

  const copyToClipboard = async (text: string, codeId: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedCode(codeId)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <ReactMarkdown
      components={{
        p({ children }) {
          return <p className="text-foreground/80 mb-2 last:mb-0 leading-normal text-xs">{children}</p>
        },
        strong({ children }) {
          return <strong className="font-bold text-foreground">{children}</strong>
        },
        em({ children }) {
          return <em className="italic">{children}</em>
        },
        ul({ children }) {
          return <ul className="text-foreground/80 mb-2 last:mb-0 space-y-0.5 list-none text-xs">{children}</ul>
        },
        ol({ children }) {
          return <ol className="text-foreground/80 mb-2 last:mb-0 space-y-0.5 list-decimal list-inside text-xs">{children}</ol>
        },
        li({ children }) {
          return <li className="leading-normal">- {children}</li>
        },
        h1({ children }) {
          return <h1 className="text-sm font-semibold text-foreground mb-1.5 mt-3 first:mt-0">{children}</h1>
        },
        h2({ children }) {
          return <h2 className="text-xs font-semibold text-foreground mb-1.5 mt-2 first:mt-0">{children}</h2>
        },
        h3({ children }) {
          return <h3 className="text-xs font-semibold text-foreground mb-1.5 mt-2 first:mt-0">{children}</h3>
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          )
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-2 text-muted-foreground/80 italic text-xs">
              {children}
            </blockquote>
          )
        },
        hr() {
          return <hr className="my-3 border-muted-foreground/20" />
        },
        code(props) {
          const { className, children } = props
          const match = /language-(\w+)/.exec(className || "")
          const codeId = `${id}-${Math.random()}`
          const codeString = String(children).replace(/\n$/, "")
          const isMultiline = codeString.includes('\n') || match

          return isMultiline ? (
            <div className="relative group/code my-2">
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1.5 top-1.5 h-5 w-5 opacity-0 group-hover/code:opacity-100 transition-opacity z-10"
                onClick={() => copyToClipboard(codeString, codeId)}
              >
                {copiedCode === codeId ? (
                  <Check className="h-2.5 w-2.5" />
                ) : (
                  <Copy className="h-2.5 w-2.5" />
                )}
              </Button>
              <SyntaxHighlighter
                style={oneDark as any}
                language={match?.[1] || 'text'}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: '0.375rem',
                  fontSize: '0.6875rem',
                }}
              >
                {codeString}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code className="text-violet-600 font-mono text-[0.6875rem]">
              {children}
            </code>
          )
        },
        pre({ children }) {
          return <>{children}</>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// Helper to get action description for a tool
function getActionDescription(toolName: string, input?: Record<string, unknown>): string {
  switch (toolName) {
    case "Bash":
      return input?.description as string || "Running command"
    case "Read":
      const readPath = input?.file_path as string
      return readPath ? `Reading ${readPath.split("/").pop()}` : "Reading file"
    case "Write":
      const writePath = input?.file_path as string
      return writePath ? `Writing ${writePath.split("/").pop()}` : "Writing file"
    case "Edit":
      const editPath = input?.file_path as string
      return editPath ? `Editing ${editPath.split("/").pop()}` : "Editing file"
    case "Glob":
      return "Searching files"
    case "Grep":
      return "Searching code"
    case "WebFetch":
      return "Fetching URL"
    case "WebSearch":
      return "Searching web"
    case "Task":
    case "Agent":
      return input?.description as string || "Running subagent"
    default:
      return `Using ${toolName}`
  }
}

export function ChatSubagentToolCall({ toolCall, className, inGroup }: ChatSubagentToolCallProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const children = toolCall.children || []
  const hasChildren = children.length > 0

  // Find the currently running child (if any)
  const activeChild = children.find((c) => c.status === "running")
  const completedCount = children.filter((c) => c.status === "complete").length
  const errorCount = children.filter((c) => c.status === "error").length

  // Build the collapsed status text
  const getCollapsedText = (): string => {
    if (activeChild) {
      // Show current action with progress
      return `${getActionDescription(activeChild.name, activeChild.input)} (${completedCount}/${children.length})`
    }
    if (toolCall.status === "complete") {
      if (errorCount > 0) {
        return `Completed with ${errorCount} error${errorCount > 1 ? "s" : ""} (${children.length} tool calls)`
      }
      return `Completed (${children.length} tool calls)`
    }
    if (toolCall.status === "error") {
      return `Failed (${children.length} tool calls)`
    }
    if (toolCall.status === "running") {
      if (hasChildren) {
        return `Running... (${children.length} tool calls)`
      }
      return "Starting..."
    }
    return hasChildren ? `(${children.length} tool calls)` : "Pending"
  }

  const statusIcon = {
    pending: <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />,
    running: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
    complete: <Check className="h-3 w-3 text-green-500" />,
    error: <AlertCircle className="h-3 w-3 text-red-500" />,
  }

  // Extract subagent metadata
  const subagentType = toolCall.input.subagent_type as string | undefined
  const description = toolCall.input.description as string | undefined
  const prompt = toolCall.input.prompt as string | undefined
  const model = toolCall.input.model as string | undefined

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        "bg-muted/30",
        !inGroup && "my-2 rounded-lg border",
        className
      )}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-3 py-2 h-auto font-normal hover:bg-muted/50"
        >
          <div className="flex-1 min-w-0">
            {/* Header with icon, description, subagent type badge, and model */}
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 shrink-0 text-indigo-500" />
              <span className="truncate font-medium">
                {description || "Running agent"}
              </span>
              {subagentType && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 shrink-0">
                  {subagentType}
                </span>
              )}
              {model && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  {model}
                </span>
              )}
            </div>
            {/* Status text showing current action and progress */}
            <div className="text-xs text-muted-foreground mt-1 text-left">
              {getCollapsedText()}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {statusIcon[toolCall.status]}
            <ChevronRight
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-90"
              )}
            />
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Subagent prompt */}
        {prompt && (
          <div className="px-3 pb-3 border-b border-border/50 mt-2 pt-3">
            <div className="max-h-60 overflow-y-auto">
              <MarkdownContent content={prompt} id={`${toolCall.id}-prompt`} />
            </div>
          </div>
        )}

        {/* Nested tool calls */}
        {hasChildren && (
          <div className="px-3 py-2 space-y-1 border-l-2 border-indigo-300 dark:border-indigo-700 ml-4">
            {children.map((child) => {
              // Check if child is also a subagent (for deeply nested cases)
              const isChildSubagent = child.name === "Task" || child.name === "Agent"
              return isChildSubagent ? (
                <ChatSubagentToolCall
                  key={child.id}
                  toolCall={child}
                />
              ) : (
                <ChatToolCall
                  key={child.id}
                  toolCall={child}
                />
              )
            })}
          </div>
        )}

        {/* Agent response - rendered as markdown */}
        {toolCall.result && (
          <div className="px-3 pb-3 border-t border-border/50 mt-2 pt-3">
            <div className="max-h-60 overflow-y-auto">
              <MarkdownContent content={toolCall.result} id={toolCall.id} />
            </div>
          </div>
        )}

        {/* Error display */}
        {toolCall.error && (
          <div className="px-3 pb-3">
            <div className="text-xs bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded p-2">
              {toolCall.error}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

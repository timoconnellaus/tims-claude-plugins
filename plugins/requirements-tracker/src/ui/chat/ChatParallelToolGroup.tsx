

import * as React from "react"
import { cn } from "../lib/utils"
import type { ChatMessage } from "./types"

interface ChatParallelToolGroupProps {
  messages: ChatMessage[]
  children: React.ReactNode
  className?: string
}

export function ChatParallelToolGroup({
  messages,
  children,
  className,
}: ChatParallelToolGroupProps) {
  // Only render the wrapper if there are multiple tools (parallel execution)
  // For a single tool, just pass through the children without a wrapper
  if (messages.length <= 1) {
    return <>{children}</>
  }

  // Count running vs completed
  const runningCount = messages.filter((m) => m.toolCall?.status === "running").length
  const completedCount = messages.filter((m) => m.toolCall?.status === "complete").length
  const errorCount = messages.filter((m) => m.toolCall?.status === "error").length

  // Determine overall status for the header
  const getStatusText = () => {
    if (runningCount > 0) {
      return `Running ${runningCount} of ${messages.length} in parallel`
    }
    if (errorCount > 0) {
      return `Parallel execution (${completedCount} completed, ${errorCount} failed)`
    }
    return `Parallel execution (${messages.length} completed)`
  }

  // Convert children to array to apply connected styles
  const childArray = React.Children.toArray(children)

  return (
    <div className={cn("my-2", className)}>
      <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium px-1 pb-1 flex items-center gap-2">
        <div className="flex gap-0.5">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                msg.toolCall?.status === "running"
                  ? "bg-blue-500 animate-pulse"
                  : msg.toolCall?.status === "complete"
                  ? "bg-green-500"
                  : msg.toolCall?.status === "error"
                  ? "bg-red-500"
                  : "bg-gray-400"
              )}
            />
          ))}
        </div>
        <span>{getStatusText()}</span>
      </div>
      {/* Connected block - children share borders */}
      <div className="rounded-lg border bg-muted/30 overflow-hidden divide-y divide-border">
        {childArray}
      </div>
    </div>
  )
}

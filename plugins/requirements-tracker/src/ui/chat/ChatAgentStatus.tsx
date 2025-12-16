

import * as React from "react"
import { cn } from "../lib/utils"
import { Zap } from "lucide-react"

interface ChatAgentStatusProps {
  isStreaming: boolean
  currentAction?: string
  className?: string
}

export function ChatAgentStatus({
  isStreaming,
  currentAction,
  className,
}: ChatAgentStatusProps) {
  if (!isStreaming) return null

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 border-t bg-muted/30 text-sm text-muted-foreground",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
        <span className="font-medium text-foreground/80">Agent working</span>
        {currentAction && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground truncate max-w-[300px]">
              {currentAction}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

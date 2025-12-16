

import * as React from "react"
import { cn } from "../lib/utils"
import { Button } from "../shadcn/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../shadcn/collapsible"
import { Terminal, ChevronRight, Check, Loader2, AlertCircle } from "lucide-react"
import { ToolDisplay } from "./ToolDisplays"
import { ToolExpandedView } from "./ToolExpandedViews"
import type { ToolCall } from "./types"

interface ChatToolCallProps {
  toolCall: ToolCall
  className?: string
  inGroup?: boolean
}

export function ChatToolCall({ toolCall, className, inGroup }: ChatToolCallProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const statusIcon = {
    pending: <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />,
    running: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
    complete: <Check className="h-3 w-3 text-green-500" />,
    error: <AlertCircle className="h-3 w-3 text-red-500" />,
  }

  // Try to get a custom display for this tool
  const customDisplay = <ToolDisplay name={toolCall.name} input={toolCall.input} />

  // Fallback display for unknown tools
  const defaultDisplay = (
    <div className="flex items-center gap-2">
      <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="truncate">{toolCall.name}</span>
    </div>
  )

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
            {customDisplay || defaultDisplay}
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
        <ToolExpandedView
          name={toolCall.name}
          input={toolCall.input}
          result={toolCall.result}
          error={toolCall.error}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}

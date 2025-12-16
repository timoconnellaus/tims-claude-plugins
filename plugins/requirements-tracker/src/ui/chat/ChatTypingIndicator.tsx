

import * as React from "react"
import { cn } from "../lib/utils"
import { Avatar, AvatarFallback } from "../shadcn/avatar"
import { Bot } from "lucide-react"

export function ChatTypingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-3 px-4 py-3 animate-in fade-in duration-300", className)}>
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-muted">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>

      {/* Typing Indicator */}
      <div className="flex items-center gap-1 rounded-lg bg-muted px-4 py-3">
        <span className="text-sm text-muted-foreground">Claude is thinking</span>
        <div className="flex gap-1 ml-1">
          <div
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: "0ms", animationDuration: "1s" }}
          />
          <div
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: "150ms", animationDuration: "1s" }}
          />
          <div
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: "300ms", animationDuration: "1s" }}
          />
        </div>
      </div>
    </div>
  )
}

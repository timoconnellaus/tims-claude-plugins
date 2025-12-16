

import * as React from "react"
import { cn } from "../lib/utils"
import { Button } from "../shadcn/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../shadcn/alert-dialog"
import { Trash2, Bot } from "lucide-react"
import type { ChatHeaderProps } from "./types"

export function ChatHeader({
  title = "Claude Chat",
  sessionId,
  messageCount = 0,
  onClearChat,
  className,
}: ChatHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b bg-background px-4 py-3",
        className
      )}
    >
      {/* Title and Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {sessionId && (
              <>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Active
                </span>
                <span>•</span>
              </>
            )}
            <span>{messageCount} {messageCount === 1 ? "message" : "messages"}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {onClearChat && messageCount > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete all messages in this conversation. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onClearChat}>
                Clear conversation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

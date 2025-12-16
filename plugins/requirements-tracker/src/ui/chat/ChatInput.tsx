

import * as React from "react"
import { cn } from "../lib/utils"
import { Button } from "../shadcn/button"
import { Textarea } from "../shadcn/textarea"
import { Send, Square } from "lucide-react"
import type { ChatInputProps } from "./types"

export function ChatInput({
  onSendMessage,
  isLoading = false,
  isStreaming = false,
  placeholder = "Type a message...",
  className,
  disabled = false,
}: ChatInputProps) {
  const [message, setMessage] = React.useState("")
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isLoading || disabled) return

    onSendMessage(message)
    setMessage("")

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }, [message])

  const isDisabled = disabled || isLoading
  const canSend = message.trim().length > 0 && !isDisabled

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex items-end gap-2 p-4 border-t bg-background", className)}
    >
      <Textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isDisabled}
        className="min-h-[60px] max-h-[200px] resize-none"
        rows={1}
      />

      {isStreaming ? (
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="shrink-0 h-10 w-10"
          aria-label="Stop generation"
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          className="shrink-0 h-10 w-10"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
    </form>
  )
}

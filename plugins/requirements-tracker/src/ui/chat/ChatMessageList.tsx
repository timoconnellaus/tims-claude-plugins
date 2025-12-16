

import * as React from "react"
import { cn } from "../lib/utils"
import { Button } from "../shadcn/button"
import { ChevronDown, MessageSquare } from "lucide-react"
import { ChatMessage } from "./ChatMessage"
import { ChatToolCall } from "./ChatToolCall"
import { ChatSubagentToolCall } from "./ChatSubagentToolCall"
import { ChatParallelToolGroup } from "./ChatParallelToolGroup"
import type { ChatMessageListProps, ChatMessage as ChatMessageType } from "./types"

// Helper to render a single tool call (either subagent or regular)
function renderToolCall(msg: ChatMessageType) {
  const isSubagent = msg.toolCall?.name === "Task" || msg.toolCall?.name === "Agent"
  return (
    <div key={msg.id} className="px-4 py-1">
      {isSubagent ? (
        <ChatSubagentToolCall toolCall={msg.toolCall!} />
      ) : (
        <ChatToolCall toolCall={msg.toolCall!} />
      )}
    </div>
  )
}

// Helper to collect consecutive messages in the same parallel group
function collectParallelGroup(
  messages: ChatMessageType[],
  startIndex: number,
  groupId: string
): ChatMessageType[] {
  const group: ChatMessageType[] = []
  for (let i = startIndex; i < messages.length; i++) {
    const msg = messages[i]!
    if (msg.type === "tool" && msg.toolCall?.parallelGroupId === groupId) {
      group.push(msg)
    } else {
      break
    }
  }
  return group
}

// Render messages with intelligent grouping for parallel tools and nested subagents
function renderMessagesWithGrouping(messages: ChatMessageType[]): React.ReactNode[] {
  const rendered: React.ReactNode[] = []
  let i = 0

  while (i < messages.length) {
    const msg = messages[i]!

    // Skip nested tools - they are rendered inside their parent subagent
    if (msg.type === "tool" && msg.toolCall?.parentToolUseId) {
      i++
      continue
    }

    // Check for parallel tool group
    if (msg.type === "tool" && msg.toolCall?.parallelGroupId) {
      const groupId = msg.toolCall.parallelGroupId
      const group = collectParallelGroup(messages, i, groupId)

      rendered.push(
        <div key={`parallel-${groupId}`} className="px-4 py-1">
          <ChatParallelToolGroup messages={group}>
            {group.map((m) => {
              const isSubagent = m.toolCall?.name === "Task" || m.toolCall?.name === "Agent"
              return isSubagent ? (
                <ChatSubagentToolCall key={m.id} toolCall={m.toolCall!} inGroup />
              ) : (
                <ChatToolCall key={m.id} toolCall={m.toolCall!} inGroup />
              )
            })}
          </ChatParallelToolGroup>
        </div>
      )

      i += group.length
    } else if (msg.type === "tool" && msg.toolCall) {
      // Single tool call (not part of a parallel group)
      rendered.push(renderToolCall(msg))
      i++
    } else {
      // Text message
      rendered.push(
        <ChatMessage
          key={msg.id}
          message={msg}
          showTimestamp={i === messages.length - 1}
          showMetadata={false}
        />
      )
      i++
    }
  }

  return rendered
}

export function ChatMessageList({
  messages,
  isStreaming = false,
  className,
}: ChatMessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = React.useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true)

  // Auto-scroll to bottom when messages change or streaming state changes
  React.useEffect(() => {
    if (shouldAutoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, shouldAutoScroll, isStreaming])

  // Monitor scroll position
  React.useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      setShouldAutoScroll(isNearBottom)
      setShowScrollButton(!isNearBottom && messages.length > 0)
    }

    scrollElement.addEventListener("scroll", handleScroll)
    return () => scrollElement.removeEventListener("scroll", handleScroll)
  }, [messages.length])

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div className={cn("relative flex-1 overflow-hidden", className)}>
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto"
      >
        <div className="flex flex-col">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-muted-foreground">
              <MessageSquare className="h-12 w-12 opacity-20" />
              <div className="text-center">
                <p className="text-lg font-medium">No messages yet</p>
                <p className="text-sm">Start a conversation with Claude</p>
              </div>
            </div>
          ) : (
            <>
              {renderMessagesWithGrouping(messages)}
            </>
          )}
          {/* Spacer to prevent content from being hidden behind the agent status bar */}
          <div className={cn("transition-all duration-200", isStreaming ? "h-10" : "h-0")} />
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          size="icon"
          variant="outline"
          className="absolute bottom-4 right-4 h-8 w-8 rounded-full shadow-lg"
          onClick={scrollToBottom}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

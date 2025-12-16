

import * as React from "react"
import { cn } from "../lib/utils"
import { Card } from "../shadcn/card"
import { ChatHeader } from "./ChatHeader"
import { ChatMessageList } from "./ChatMessageList"
import { ChatInput } from "./ChatInput"
import { ChatAgentStatus } from "./ChatAgentStatus"
import { ToolApprovalPanel } from "./ToolApprovalPanel"
import { useClaudeChat } from "./use-claude-chat"
import type { ClaudeChatProps } from "./types"

export function ClaudeChat({
  endpoint,
  sessionId,
  className,
  placeholder = "Type a message to Claude...",
  showHeader = true,
  headerTitle = "Claude Chat",
  onSessionChange,
  initialMessages,
  persistSession = false,
  theme = "system",
}: ClaudeChatProps) {
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    session,
    currentAction,
    permissionRequest,
    sendMessage,
    stopGeneration,
    clearMessages,
    respondToPermission,
  } = useClaudeChat({
    endpoint,
    sessionId,
    onSessionChange,
    initialMessages,
    persistSession,
  })

  // Apply theme
  React.useEffect(() => {
    if (theme === "system") return

    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [theme])

  const handleSendMessage = async (content: string) => {
    try {
      await sendMessage(content)
    } catch (err) {
      console.error("Failed to send message:", err)
    }
  }

  const handleClearChat = () => {
    clearMessages()
  }

  return (
    <Card
      className={cn(
        "flex flex-col h-[600px] overflow-hidden",
        className
      )}
    >
      {/* Header */}
      {showHeader && (
        <ChatHeader
          title={headerTitle}
          sessionId={session.sessionId || undefined}
          messageCount={messages.length}
          onClearChat={handleClearChat}
        />
      )}

      {/* Message List */}
      <ChatMessageList
        messages={messages}
        isStreaming={isStreaming}
        className="flex-1"
      />

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm border-t border-destructive/20">
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {/* Agent Status - pinned above input */}
      <ChatAgentStatus
        isStreaming={isStreaming}
        currentAction={currentAction ?? undefined}
      />

      {/* Tool Approval Panel or Input */}
      {permissionRequest ? (
        <ToolApprovalPanel
          permissionRequest={permissionRequest}
          onApprove={() => respondToPermission('allow')}
          onDeny={() => respondToPermission('deny')}
        />
      ) : (
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          isStreaming={isStreaming}
          placeholder={placeholder}
        />
      )}
    </Card>
  )
}

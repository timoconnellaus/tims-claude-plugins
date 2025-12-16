// Message types
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';
export type ToolCallStatus = 'pending' | 'running' | 'complete' | 'error';
export type ChatMessageType = 'text' | 'tool';

// Tool call types
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: ToolCallStatus;
  result?: string;
  error?: string;
  // Parent-child relationships for subagent nesting
  parentToolUseId?: string | null;
  children?: ToolCall[];
  // Parallel detection
  timestamp?: number;
  parallelGroupId?: string;
}

// Content block types for structured message content
export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  toolCall?: ToolCall;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type?: ChatMessageType;  // 'text' (default) or 'tool'
  content: string;  // Plain text content for simple display
  toolCall?: ToolCall;  // Present when type === 'tool'
  timestamp: Date;
  status: MessageStatus;
  metadata?: {
    model?: string;
    tokens?: number;
    duration_ms?: number;
  };
}

// Session types
export interface ChatSession {
  id: string;
  createdAt: Date;
  lastMessageAt: Date;
  messageCount: number;
}

export interface SessionState {
  sessionId: string | null;
  isActive: boolean;
  canResume: boolean;
}

// API Request/Response types
export interface SendMessageRequest {
  message: string;
  sessionId?: string;
  options?: {
    model?: string;
    maxTurns?: number;
    systemPrompt?: string;
  };
}

export interface StreamEvent {
  type: 'init' | 'delta' | 'tool_call' | 'tool_result' | 'complete' | 'error' | 'permission_request';
  sessionId?: string;
  messageId?: string;
  content?: string;
  fullMessage?: ChatMessage;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    model?: string;
    total_cost_usd?: number;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  // Tool-related fields
  toolId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  toolError?: string;
  toolStatus?: ToolCallStatus;
  // Parent context for nested tools
  toolParentId?: string | null;
  toolTimestamp?: number;
  // Permission request fields
  permissionRequestId?: string;
}

// Permission request state for UI
export interface PermissionRequest {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  sessionId: string;
}

// Permission response sent back to server
export interface PermissionResponse {
  permissionRequestId: string;
  sessionId: string;
  decision: 'allow' | 'deny';
}

// Hook types
export interface UseClaudeChatOptions {
  endpoint: string;
  sessionId?: string;
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
  onSessionChange?: (session: SessionState) => void;
  initialMessages?: ChatMessage[];
  persistSession?: boolean;
  storageKey?: string;
}

export interface UseClaudeChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | null;
  session: SessionState;
  currentAction: string | null;
  permissionRequest: PermissionRequest | null;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  clearMessages: () => void;
  resumeSession: (sessionId: string) => Promise<void>;
  respondToPermission: (decision: 'allow' | 'deny') => void;
}

// Component props types
export interface ClaudeChatProps {
  endpoint: string;
  sessionId?: string;
  className?: string;
  placeholder?: string;
  showHeader?: boolean;
  headerTitle?: string;
  onSessionChange?: (session: SessionState) => void;
  initialMessages?: ChatMessage[];
  persistSession?: boolean;
  theme?: 'light' | 'dark' | 'system';
}

export interface ChatMessageListProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
  className?: string;
}

export interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export interface ChatHeaderProps {
  title?: string;
  sessionId?: string;
  messageCount?: number;
  onClearChat?: () => void;
  className?: string;
}

export interface MessageBubbleProps {
  message: ChatMessage;
  className?: string;
  showTimestamp?: boolean;
  showMetadata?: boolean;
}

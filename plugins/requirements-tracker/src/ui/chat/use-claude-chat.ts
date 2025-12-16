"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ChatMessage,
  SessionState,
  StreamEvent,
  ToolCall,
  UseClaudeChatOptions,
  UseClaudeChatReturn,
  PermissionRequest,
} from './types';

const STORAGE_KEY_PREFIX = 'claude-chat-session';

// Window for detecting parallel tool launches (ms)
const PARALLEL_WINDOW_MS = 150;

// Helper to generate human-readable action descriptions
function getActionDescription(toolName: string, toolInput?: Record<string, unknown>): string {
  switch (toolName) {
    case 'Bash':
      return `Running command`;
    case 'Read':
      const filePath = toolInput?.file_path as string;
      return filePath ? `Reading ${filePath.split('/').pop()}` : 'Reading file';
    case 'Write':
      const writePath = toolInput?.file_path as string;
      return writePath ? `Writing ${writePath.split('/').pop()}` : 'Writing file';
    case 'Edit':
      const editPath = toolInput?.file_path as string;
      return editPath ? `Editing ${editPath.split('/').pop()}` : 'Editing file';
    case 'Glob':
      return `Searching files`;
    case 'Grep':
      return `Searching code`;
    case 'WebFetch':
      return `Fetching URL`;
    case 'WebSearch':
      return `Searching web`;
    case 'Task':
      return `Running agent`;
    case 'TodoWrite':
      return `Updating tasks`;
    default:
      return `Using ${toolName}`;
  }
}

export function useClaudeChat(options: UseClaudeChatOptions): UseClaudeChatReturn {
  const {
    endpoint,
    sessionId: initialSessionId,
    onMessage,
    onError,
    onSessionChange,
    initialMessages = [],
    persistSession = true,
    storageKey = STORAGE_KEY_PREFIX,
  } = options;

  // State
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
  const [session, setSession] = useState<SessionState>({
    sessionId: initialSessionId || null,
    isActive: false,
    canResume: false,
  });

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track the current text message being streamed
  const currentTextMessageIdRef = useRef<string | null>(null);
  // Track recent tool launches for parallel detection
  const recentToolLaunchesRef = useRef<Map<string, number>>(new Map());
  // Buffer orphaned tools (child arrives before parent)
  const orphanedToolsRef = useRef<Map<string, ToolCall[]>>(new Map());
  // Store resolve function for permission response
  const permissionResolveRef = useRef<((decision: 'allow' | 'deny') => void) | null>(null);

  // Load session from localStorage on mount
  useEffect(() => {
    if (persistSession && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const { sessionId: storedSessionId, messages: storedMessages } = JSON.parse(stored);
          if (storedSessionId && storedMessages?.length > 0) {
            setSession({
              sessionId: storedSessionId,
              isActive: false,
              canResume: true,
            });
            setMessages(storedMessages.map((msg: ChatMessage) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            })));
          }
        }
      } catch (err) {
        console.error('Failed to load session from storage:', err);
      }
    }
  }, [persistSession, storageKey]);

  // Save session to localStorage when it changes
  useEffect(() => {
    if (persistSession && typeof window !== 'undefined' && session.sessionId) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            sessionId: session.sessionId,
            messages,
          })
        );
      } catch (err) {
        console.error('Failed to save session to storage:', err);
      }
    }
  }, [persistSession, storageKey, session.sessionId, messages]);

  // Notify session changes
  useEffect(() => {
    if (onSessionChange) {
      onSessionChange(session);
    }
  }, [session, onSessionChange]);

  // Update session state
  const updateSession = useCallback((updates: Partial<SessionState>) => {
    setSession((prev) => ({ ...prev, ...updates }));
  }, []);

  // Stop generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsStreaming(false);
    setCurrentAction(null);
    setPermissionRequest(null);
    permissionResolveRef.current = null;

    // Mark any streaming messages as complete
    setMessages((prev) =>
      prev.map((msg) =>
        msg.status === 'streaming'
          ? { ...msg, status: 'complete' as const }
          : msg
      )
    );
    currentTextMessageIdRef.current = null;
  }, []);

  // Respond to permission request
  const respondToPermission = useCallback((decision: 'allow' | 'deny') => {
    if (permissionResolveRef.current) {
      permissionResolveRef.current(decision);
      permissionResolveRef.current = null;
    }
    setPermissionRequest(null);
  }, []);

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) {
        return;
      }

      // Clear any previous errors
      setError(null);
      setIsLoading(true);

      // Create optimistic user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        type: 'text',
        content: content.trim(),
        timestamp: new Date(),
        status: 'complete',
      };

      setMessages((prev) => [...prev, userMessage]);

      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Map to track tool messages by their tool ID
      const toolMessageIds = new Map<string, string>();

      try {
        // Make request
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: content.trim(),
            sessionId: session.sessionId,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        // Set streaming state
        setIsStreaming(true);
        updateSession({ isActive: true });

        // Read stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) {
              continue;
            }

            try {
              const data = line.slice(6); // Remove 'data: ' prefix
              const event: StreamEvent = JSON.parse(data);

              switch (event.type) {
                case 'init':
                  // Initialize session
                  if (event.sessionId) {
                    updateSession({
                      sessionId: event.sessionId,
                      isActive: true,
                      canResume: true,
                    });
                  }
                  break;

                case 'delta':
                  // Text content - create or update a text message
                  if (event.content) {
                    if (currentTextMessageIdRef.current) {
                      // Update existing text message
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === currentTextMessageIdRef.current
                            ? { ...msg, content: msg.content + event.content }
                            : msg
                        )
                      );
                    } else {
                      // Create new text message
                      const textMsgId = `text-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                      currentTextMessageIdRef.current = textMsgId;

                      const textMessage: ChatMessage = {
                        id: textMsgId,
                        role: 'assistant',
                        type: 'text',
                        content: event.content,
                        timestamp: new Date(),
                        status: 'streaming',
                      };

                      setMessages((prev) => [...prev, textMessage]);
                    }
                  }
                  break;

                case 'tool_call':
                  // Tool call - finalize current text message and handle tool message
                  if (event.toolId && event.toolName) {
                    // Mark current text message as complete
                    if (currentTextMessageIdRef.current) {
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === currentTextMessageIdRef.current
                            ? { ...msg, status: 'complete' as const }
                            : msg
                        )
                      );
                      currentTextMessageIdRef.current = null;
                    }

                    // Update current action based on tool
                    setCurrentAction(getActionDescription(event.toolName, event.toolInput));

                    // Determine parallel group ID for top-level tools
                    const timestamp = event.toolTimestamp || Date.now();
                    let parallelGroupId: string | undefined;
                    if (!event.toolParentId) {
                      const key = 'root';
                      const recent = recentToolLaunchesRef.current.get(key);
                      if (recent && Math.abs(timestamp - recent) < PARALLEL_WINDOW_MS) {
                        parallelGroupId = `parallel-${recent}`;
                      } else {
                        parallelGroupId = `parallel-${timestamp}`;
                        recentToolLaunchesRef.current.set(key, timestamp);
                      }
                    }

                    // Check for any buffered orphaned children
                    const bufferedChildren = orphanedToolsRef.current.get(event.toolId) || [];
                    if (bufferedChildren.length > 0) {
                      orphanedToolsRef.current.delete(event.toolId);
                    }

                    // Create tool call object
                    const toolCall: ToolCall = {
                      id: event.toolId,
                      name: event.toolName,
                      input: event.toolInput || {},
                      status: event.toolStatus || 'running',
                      parentToolUseId: event.toolParentId || null,
                      children: bufferedChildren,
                      timestamp,
                      parallelGroupId,
                    };

                    // Handle nested vs top-level tool calls
                    if (event.toolParentId) {
                      // This is a nested tool call - add to parent's children
                      setMessages((prev) => {
                        // Find parent in messages
                        const parentExists = prev.some(
                          (msg) => msg.toolCall?.id === event.toolParentId
                        );

                        if (!parentExists) {
                          // Buffer orphaned tool until parent arrives
                          const orphans = orphanedToolsRef.current.get(event.toolParentId!) || [];
                          orphans.push(toolCall);
                          orphanedToolsRef.current.set(event.toolParentId!, orphans);
                          return prev;
                        }

                        // Add to parent's children array
                        return prev.map((msg): ChatMessage => {
                          if (msg.toolCall?.id === event.toolParentId && msg.toolCall) {
                            const parentToolCall = msg.toolCall;
                            return {
                              ...msg,
                              toolCall: {
                                id: parentToolCall.id,
                                name: parentToolCall.name,
                                input: parentToolCall.input,
                                status: parentToolCall.status,
                                result: parentToolCall.result,
                                error: parentToolCall.error,
                                parentToolUseId: parentToolCall.parentToolUseId,
                                children: [...(parentToolCall.children || []), toolCall],
                                timestamp: parentToolCall.timestamp,
                                parallelGroupId: parentToolCall.parallelGroupId,
                              },
                            };
                          }
                          return msg;
                        });
                      });

                      // Track nested tool message ID for result updates
                      toolMessageIds.set(event.toolId, `nested-${event.toolId}`);
                    } else {
                      // Top-level tool call - create new message
                      const toolMsgId = `tool-${event.toolId}`;
                      toolMessageIds.set(event.toolId, toolMsgId);

                      const toolMessage: ChatMessage = {
                        id: toolMsgId,
                        role: 'assistant',
                        type: 'tool',
                        content: '',
                        toolCall,
                        timestamp: new Date(),
                        status: 'streaming',
                      };

                      setMessages((prev) => [...prev, toolMessage]);
                    }
                  }
                  break;

                case 'tool_result':
                  // Update the tool message with result (handles both top-level and nested tools)
                  if (event.toolId) {
                    const toolMsgId = toolMessageIds.get(event.toolId);
                    const isNested = toolMsgId?.startsWith('nested-');

                    setMessages((prev) =>
                      prev.map((msg) => {
                        // Handle top-level tool result
                        if (!isNested && msg.id === toolMsgId && msg.toolCall) {
                          return {
                            ...msg,
                            status: 'complete' as const,
                            toolCall: {
                              ...msg.toolCall,
                              status: event.toolError ? 'error' : (event.toolStatus || 'complete'),
                              result: event.toolResult,
                              error: event.toolError,
                            },
                          };
                        }

                        // Handle nested tool result - search in children arrays
                        if (msg.toolCall?.children?.length) {
                          const updatedChildren = msg.toolCall.children.map((child) =>
                            child.id === event.toolId
                              ? {
                                  ...child,
                                  status: event.toolError ? 'error' as const : (event.toolStatus || 'complete' as const),
                                  result: event.toolResult,
                                  error: event.toolError,
                                }
                              : child
                          );

                          // Only update if we found the child
                          const childFound = updatedChildren.some(
                            (c, i) => c !== msg.toolCall!.children![i]
                          );
                          if (childFound) {
                            return {
                              ...msg,
                              toolCall: {
                                ...msg.toolCall,
                                children: updatedChildren,
                              },
                            };
                          }
                        }

                        return msg;
                      })
                    );
                  }
                  break;

                case 'complete':
                  // Finalize any streaming messages
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.status === 'streaming'
                        ? { ...msg, status: 'complete' as const }
                        : msg
                    )
                  );
                  currentTextMessageIdRef.current = null;
                  setCurrentAction(null);
                  updateSession({ isActive: false });
                  break;

                case 'permission_request':
                  // Handle permission request - show UI and wait for user response
                  if (event.permissionRequestId && event.toolName && event.sessionId) {
                    setCurrentAction(`Waiting for approval: ${event.toolName}`);

                    // Set permission request state for UI
                    setPermissionRequest({
                      id: event.permissionRequestId,
                      toolName: event.toolName,
                      toolInput: event.toolInput || {},
                      sessionId: event.sessionId,
                    });

                    // Wait for user decision - this creates a promise that will be resolved
                    // by respondToPermission() when user clicks approve/deny
                    const decision = await new Promise<'allow' | 'deny'>((resolve) => {
                      permissionResolveRef.current = resolve;
                    });

                    // Send the decision back to the server
                    try {
                      const permissionResponse = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          type: 'permission_response',
                          permissionRequestId: event.permissionRequestId,
                          sessionId: event.sessionId,
                          decision,
                        }),
                        signal: abortController.signal,
                      });

                      if (!permissionResponse.ok) {
                        console.error('Failed to send permission response');
                      }
                    } catch (permErr) {
                      console.error('Error sending permission response:', permErr);
                    }

                    setCurrentAction(null);
                  }
                  break;

                case 'error':
                  // Handle error
                  const errorMessage = event.error?.message || 'Unknown error occurred';
                  const err = new Error(errorMessage);
                  setError(err);

                  // Mark streaming messages as error
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.status === 'streaming'
                        ? { ...msg, status: 'error' as const }
                        : msg
                    )
                  );

                  if (onError) {
                    onError(err);
                  }

                  currentTextMessageIdRef.current = null;
                  setCurrentAction(null);
                  setPermissionRequest(null);
                  updateSession({ isActive: false });
                  break;
              }
            } catch (parseError) {
              console.error('Failed to parse SSE event:', parseError);
            }
          }
        }
      } catch (err) {
        // Handle fetch errors
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            // Request was aborted, don't set error state
            console.log('Request aborted');
          } else {
            setError(err);
            if (onError) {
              onError(err);
            }
          }
        }
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
        setCurrentAction(null);
        abortControllerRef.current = null;
        currentTextMessageIdRef.current = null;
      }
    },
    [endpoint, session.sessionId, isLoading, onMessage, onError, updateSession]
  );

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setSession({
      sessionId: null,
      isActive: false,
      canResume: false,
    });

    if (persistSession && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
      } catch (err) {
        console.error('Failed to clear storage:', err);
      }
    }
  }, [persistSession, storageKey]);

  // Resume session
  const resumeSession = useCallback(
    async (sessionId: string) => {
      setSession({
        sessionId,
        isActive: false,
        canResume: true,
      });
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
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
    resumeSession,
    respondToPermission,
  };
}

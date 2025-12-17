import {
  query,
  type CanUseTool,
  type PermissionResult,
  type SdkPluginConfig,
} from '@anthropic-ai/claude-agent-sdk';
import type { SendMessageRequest, ChatMessage, ContentBlock, PermissionResponse } from '../chat/types';
import { sessionManager } from './session-manager';
import { createSSEStreamWithCallback } from './stream-adapter';
import { dirname, join } from 'path';

// Re-export permission types for consumers
export type { CanUseTool, PermissionResult };

// Store for pending permission requests awaiting user response
const pendingPermissions = new Map<string, {
  resolve: (decision: 'allow' | 'deny') => void;
  toolName: string;
  input: Record<string, unknown>;
}>();

/**
 * Sandbox settings for secure command execution
 */
export interface SandboxSettings {
  enabled?: boolean;
  autoAllowBashIfSandboxed?: boolean;
  excludedCommands?: string[];
  allowUnsandboxedCommands?: boolean;
  network?: {
    allowLocalBinding?: boolean;
    allowUnixSockets?: string[];
    allowAllUnixSockets?: boolean;
    httpProxyPort?: number;
    socksProxyPort?: number;
  };
  // Allow additional properties for SDK compatibility
  [key: string]: unknown;
}

export interface ClaudeChatHandlerConfig {
  defaultModel?: string;
  defaultMaxTurns?: number;
  defaultSystemPrompt?: string;
  /**
   * When true, prompts the user in the UI for tool approval.
   * When false or undefined, uses the canUseTool callback if provided,
   * otherwise auto-approves all tools.
   */
  requireToolApproval?: boolean;
  /**
   * Custom permission handler for controlling tool usage.
   * Called before each tool execution to determine if it should be allowed or denied.
   * If not provided and requireToolApproval is false, all tools are auto-approved.
   * If requireToolApproval is true, this is ignored and UI approval is used instead.
   */
  canUseTool?: CanUseTool;
  /**
   * Plugins to load. Each plugin provides additional slash commands and skills.
   */
  plugins?: SdkPluginConfig[];
  /**
   * Working directory for the Claude session. Defaults to process.cwd().
   */
  cwd?: string;
  /**
   * Sandbox settings for secure command execution.
   * When enabled, bash commands run in a sandbox environment.
   */
  sandbox?: SandboxSettings;
}

/**
 * Creates a request handler for Claude chat interactions
 */
export function createClaudeChatHandler(config: ClaudeChatHandlerConfig = {}) {
  const {
    defaultModel = 'claude-sonnet-4-5-20250929',
    defaultMaxTurns = 20,
    defaultSystemPrompt,
    requireToolApproval = false,
    canUseTool: configCanUseTool,
    plugins = [],
    cwd = process.cwd(),
    sandbox,
  } = config;

  return async function handleRequest(request: Request): Promise<Response> {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    try {
      // Parse request body
      const body = await request.json();

      // Handle permission response (separate from message requests)
      if (body.type === 'permission_response') {
        const { permissionRequestId, decision } = body as PermissionResponse;
        const pending = pendingPermissions.get(permissionRequestId);
        if (pending) {
          pending.resolve(decision);
          pendingPermissions.delete(permissionRequestId);
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          return new Response(
            JSON.stringify({ error: 'Permission request not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // Handle regular message request
      const { message, sessionId, options = {} } = body as SendMessageRequest;

      if (!message || typeof message !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Message is required' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Create SSE stream
      const stream = createSSEStreamWithCallback(async (send) => {
        let sdkSessionId: string | undefined = sessionId;
        const modelToUse = options.model || defaultModel;

        const messageId = crypto.randomUUID();
        const startTime = Date.now();
        let initSent = false;

        // Create UI-based canUseTool handler if requireToolApproval is enabled
        const uiCanUseTool: CanUseTool | undefined = requireToolApproval
          ? async (toolName, input, opts) => {
              const permissionRequestId = crypto.randomUUID();
              const currentSessionId = sdkSessionId || sessionId || 'unknown';

              // Send permission request to frontend
              send({
                type: 'permission_request',
                permissionRequestId,
                sessionId: currentSessionId,
                toolName,
                toolInput: input,
              });

              // Wait for user response
              const decision = await new Promise<'allow' | 'deny'>((resolve) => {
                pendingPermissions.set(permissionRequestId, {
                  resolve,
                  toolName,
                  input,
                });
              });

              if (decision === 'allow') {
                return { behavior: 'allow', updatedInput: input };
              } else {
                return {
                  behavior: 'deny',
                  message: 'User denied tool execution',
                  interrupt: false,
                };
              }
            }
          : undefined;

        try {
          // Create query with V1 API
          const q = query({
            prompt: message,
            options: {
              model: modelToUse,
              maxTurns: defaultMaxTurns,
              resume: sdkSessionId, // Resume existing session if provided
              canUseTool: uiCanUseTool || configCanUseTool,
              plugins,
              cwd,
              sandbox,
            },
          });

          let fullContent = '';
          let inputTokens = 0;
          let outputTokens = 0;
          let actualSessionId = sdkSessionId;
          const contentBlocks: ContentBlock[] = [];
          const pendingToolCalls = new Map<string, { name: string; input: Record<string, unknown> }>();
          const seenToolIds = new Set<string>();
          let lastTextLength = 0;  // Track text length at last emission

          // Process the response stream
          for await (const sdkMessage of q) {
            // Capture the actual session ID from SDK messages
            if ('session_id' in sdkMessage && sdkMessage.session_id) {
              actualSessionId = sdkMessage.session_id;

              // Send init event with the real session ID (only once)
              if (!initSent) {
                sdkSessionId = actualSessionId;
                send({
                  type: 'init',
                  sessionId: actualSessionId,
                  messageId,
                });
                initSent = true;
              }
            }

            if (sdkMessage.type === 'assistant') {
              // Extract all content blocks from assistant message
              const content = sdkMessage.message.content;
              for (const block of content) {
                if (block.type === 'text') {
                  // Send text delta - only send what's new since last emission
                  const currentText = block.text;
                  if (currentText.length > lastTextLength) {
                    const newText = currentText.slice(lastTextLength);
                    lastTextLength = currentText.length;
                    fullContent += newText;

                    // Send delta event
                    send({
                      type: 'delta',
                      sessionId: actualSessionId,
                      messageId,
                      content: newText,
                    });
                  }
                } else if (block.type === 'tool_use') {
                  // Only send each tool call once
                  if (!seenToolIds.has(block.id)) {
                    seenToolIds.add(block.id);
                    pendingToolCalls.set(block.id, { name: block.name, input: block.input as Record<string, unknown> });

                    // Reset text tracking for new text after tool call
                    lastTextLength = 0;

                    send({
                      type: 'tool_call',
                      sessionId: actualSessionId,
                      messageId,
                      toolId: block.id,
                      toolName: block.name,
                      toolInput: block.input as Record<string, unknown>,
                      toolStatus: 'running',
                      // Include parent context for nested tool calls (subagents)
                      toolParentId: sdkMessage.parent_tool_use_id || null,
                      toolTimestamp: Date.now(),
                    });
                  }
                }
              }
            } else if (sdkMessage.type === 'user') {
              // Check for tool results in user messages
              const content = sdkMessage.message.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === 'tool_result' && 'tool_use_id' in block) {
                    const toolUseId = block.tool_use_id as string;
                    const toolInfo = pendingToolCalls.get(toolUseId);

                    // Extract result text
                    let resultText = '';
                    if (Array.isArray(block.content)) {
                      resultText = block.content
                        .filter((c: any) => c.type === 'text')
                        .map((c: any) => c.text)
                        .join('\n');
                    } else if (typeof block.content === 'string') {
                      resultText = block.content;
                    }

                    send({
                      type: 'tool_result',
                      sessionId: actualSessionId,
                      messageId,
                      toolId: toolUseId,
                      toolName: toolInfo?.name,
                      toolResult: resultText,
                      toolStatus: 'complete',
                    });
                  }
                }
              }
            } else if (sdkMessage.type === 'result') {
              // Track token usage from result
              if (sdkMessage.usage) {
                inputTokens = sdkMessage.usage.input_tokens || 0;
                outputTokens = sdkMessage.usage.output_tokens || 0;
              }
              break; // End of response
            }
          }

          const endTime = Date.now();
          const duration_ms = endTime - startTime;

          // Create complete message
          const completeMessage: ChatMessage = {
            id: messageId,
            role: 'assistant',
            content: fullContent,
            timestamp: new Date(),
            status: 'complete',
            metadata: {
              model: modelToUse,
              tokens: inputTokens + outputTokens,
              duration_ms,
            },
          };

          // Send complete event
          send({
            type: 'complete',
            sessionId: actualSessionId || sdkSessionId,
            messageId,
            fullMessage: completeMessage,
            metadata: {
              model: modelToUse,
              usage: {
                input_tokens: inputTokens,
                output_tokens: outputTokens,
              },
            },
          });
        } catch (error) {
          // Send error event
          send({
            type: 'error',
            sessionId: sdkSessionId,
            messageId,
            error: {
              code: 'AGENT_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error occurred',
            },
          });
        }
      });

      // Return SSE response
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}

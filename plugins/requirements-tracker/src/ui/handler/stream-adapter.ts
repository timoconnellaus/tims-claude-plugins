import type { StreamEvent } from '../chat/types';

export interface SSEController {
  enqueue: (chunk: Uint8Array) => void;
  close: () => void;
}

/**
 * Creates a ReadableStream for Server-Sent Events (SSE)
 */
export function createSSEStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      // Store controller for external access
      (controller as any)._isSSE = true;
    },
  });
}

/**
 * Encodes and sends an SSE event through the stream controller
 */
export function sendSSEEvent(
  controller: SSEController,
  event: StreamEvent
): void {
  const eventData = `data: ${JSON.stringify(event)}\n\n`;
  const encoded = new TextEncoder().encode(eventData);
  controller.enqueue(encoded);
}

/**
 * Creates proper headers for SSE responses
 */
export function createSSEHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable buffering in nginx
  };
}

/**
 * Wraps a ReadableStream with SSE formatting
 */
export function createSSEResponse(
  stream: ReadableStream<Uint8Array>
): Response {
  return new Response(stream, {
    headers: createSSEHeaders(),
  });
}

/**
 * Helper to create an SSE stream with a callback for sending events
 */
export function createSSEStreamWithCallback(
  callback: (send: (event: StreamEvent) => void) => Promise<void>
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        sendSSEEvent(controller as any, event);
      };

      try {
        await callback(send);
      } catch (error) {
        const errorEvent: StreamEvent = {
          type: 'error',
          error: {
            code: 'STREAM_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        };
        sendSSEEvent(controller as any, errorEvent);
      } finally {
        controller.close();
      }
    },
  });
}

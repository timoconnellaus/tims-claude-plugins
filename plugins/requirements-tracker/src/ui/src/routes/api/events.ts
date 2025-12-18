import { createFileRoute } from "@tanstack/react-router";
import { clients, initFileWatchers } from "../../api/sse";

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      GET: async () => {
        // Initialize file watchers on first connection
        await initFileWatchers();

        const stream = new ReadableStream({
          start(controller) {
            clients.add(controller);
            controller.enqueue(`data: connected\n\n`);
          },
          cancel() {
            // Client disconnected - will be cleaned up on next broadcast
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { broadcastRefresh, getProjectCwd } from "../../api/sse";

export const Route = createFileRoute("/api/pull")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const cwd = getProjectCwd();
          // Import pull command dynamically to avoid circular deps
          const { pull } = await import("../../../../commands/pull");
          const result = await pull({ cwd, force: true });

          if (!result.success) {
            return json(
              { success: false, error: result.error },
              { status: 400 }
            );
          }

          broadcastRefresh();
          return json({
            success: true,
            writtenCount: result.writtenCount
          });
        } catch (error) {
          return json(
            { success: false, error: (error as Error).message },
            { status: 500 }
          );
        }
      },
    },
  },
});

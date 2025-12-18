import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { removeRepository } from "../../../../lib/repo-store";
import { broadcastRefresh } from "../../api/sse";

export const Route = createFileRoute("/api/repositories/$id")({
  server: {
    handlers: {
      DELETE: async ({ params }) => {
        try {
          const id = decodeURIComponent(params.id);
          const result = await removeRepository(id);

          if (!result.success) {
            return json(
              { success: false, error: result.error },
              { status: 404 }
            );
          }

          broadcastRefresh();
          return json({ success: true });
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

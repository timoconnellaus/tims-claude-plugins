import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import {
  loadRepositories,
  addRepository,
} from "../../../../lib/repo-store";
import { broadcastRefresh, getProjectCwd } from "../../api/sse";

export const Route = createFileRoute("/api/repositories")({
  server: {
    handlers: {
      GET: async () => {
        const repos = await loadRepositories();
        return json(repos.repositories);
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            path: string;
            docsPath?: string;
          };

          if (!body.path) {
            return json(
              { success: false, error: "Path is required" },
              { status: 400 }
            );
          }

          const result = await addRepository(body.path, body.docsPath, getProjectCwd());

          if (!result.success) {
            return json(
              { success: false, error: result.error },
              { status: 400 }
            );
          }

          broadcastRefresh();
          return json({ success: true, repository: result.repository });
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

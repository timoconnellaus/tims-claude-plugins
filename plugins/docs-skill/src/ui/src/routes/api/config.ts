import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import {
  loadConfig,
  saveConfig,
  createDefaultConfig,
} from "../../../../lib/store";
import { broadcastRefresh, getProjectCwd } from "../../api/sse";
import type { UserConfig } from "../../../../lib/types";

export const Route = createFileRoute("/api/config")({
  server: {
    handlers: {
      GET: async () => {
        const cwd = getProjectCwd();
        const config = await loadConfig(cwd);
        return json(config || createDefaultConfig());
      },
      PUT: async ({ request }) => {
        try {
          const cwd = getProjectCwd();
          const body = (await request.json()) as { topics: string[] };

          if (!Array.isArray(body.topics)) {
            return json(
              { success: false, error: "Topics must be an array" },
              { status: 400 }
            );
          }

          const existingConfig = await loadConfig(cwd);
          const config: UserConfig = {
            version: 1,
            topics: body.topics,
            lastSync: existingConfig?.lastSync,
            source: existingConfig?.source,
          };

          await saveConfig(cwd, config);
          broadcastRefresh();

          return json({ success: true, config });
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

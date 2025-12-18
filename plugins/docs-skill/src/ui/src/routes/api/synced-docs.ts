import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { loadUserDocs } from "../../../../lib/store";
import { getProjectCwd } from "../../api/sse";

export const Route = createFileRoute("/api/synced-docs")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const cwd = getProjectCwd();
          const docs = await loadUserDocs(cwd);
          return json(docs);
        } catch {
          return json([]);
        }
      },
    },
  },
});

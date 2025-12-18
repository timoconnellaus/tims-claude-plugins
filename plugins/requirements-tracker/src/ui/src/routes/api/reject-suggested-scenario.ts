import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { loadRequirement, saveRequirement } from "../../../../lib/store";
import { broadcastRefresh, getProjectCwd } from "../../api/sse";

export const Route = createFileRoute("/api/reject-suggested-scenario")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const cwd = getProjectCwd();
          const body = (await request.json()) as {
            path: string;
            name: string;
          };

          if (!body.path || !body.name) {
            return json(
              { success: false, error: "Missing required fields: path, name" },
              { status: 400 }
            );
          }

          const requirement = await loadRequirement(cwd, body.path);
          if (!requirement) {
            return json(
              { success: false, error: `Requirement not found: ${body.path}` },
              { status: 404 }
            );
          }

          if (requirement.data.aiAssessment?.suggestedScenarios) {
            requirement.data.aiAssessment.suggestedScenarios =
              requirement.data.aiAssessment.suggestedScenarios.filter(
                (s) => s.name !== body.name
              );
            await saveRequirement(cwd, body.path, requirement.data);
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

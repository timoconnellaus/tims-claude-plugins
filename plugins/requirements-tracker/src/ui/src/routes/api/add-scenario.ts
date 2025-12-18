import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { loadRequirement, saveRequirement } from "../../../../lib/store";
import { addScenario } from "../../../../commands/add-scenario";
import { broadcastRefresh, getProjectCwd } from "../../api/sse";

export const Route = createFileRoute("/api/add-scenario")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const cwd = getProjectCwd();
          const body = (await request.json()) as {
            path: string;
            name: string;
            gherkin: string;
            suggested?: boolean;
          };

          if (!body.path || !body.name || !body.gherkin) {
            return json(
              { success: false, error: "Missing required fields: path, name, gherkin" },
              { status: 400 }
            );
          }

          await addScenario({
            cwd,
            path: body.path,
            name: body.name,
            gherkin: body.gherkin,
            suggested: body.suggested,
          });

          // Also remove from suggestedScenarios if present (scenario was accepted)
          const requirement = await loadRequirement(cwd, body.path);
          if (requirement?.data.aiAssessment?.suggestedScenarios) {
            const hadSuggestion = requirement.data.aiAssessment.suggestedScenarios.some(
              (s) => s.name === body.name
            );
            if (hadSuggestion) {
              requirement.data.aiAssessment.suggestedScenarios =
                requirement.data.aiAssessment.suggestedScenarios.filter(
                  (s) => s.name !== body.name
                );
              await saveRequirement(cwd, body.path, requirement.data);
            }
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

import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { loadRequirement } from "../../../../lib/store";
import { runTests, runMultipleTests } from "../../../../lib/test-runner";
import { broadcastRefresh, getProjectCwd } from "../../api/sse";

export const Route = createFileRoute("/api/run-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const cwd = getProjectCwd();
          const body = (await request.json()) as {
            file?: string;
            identifier?: string;
            requirementPath?: string;
          };

          let result;

          if (body.requirementPath) {
            const requirement = await loadRequirement(cwd, body.requirementPath);
            if (!requirement) {
              return json(
                { success: false, error: `Requirement not found: ${body.requirementPath}` },
                { status: 404 }
              );
            }

            if (requirement.data.tests.length === 0) {
              return json({
                success: true,
                exitCode: 0,
                summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
                message: "No tests linked to this requirement",
              });
            }

            result = await runMultipleTests(
              cwd,
              requirement.data.tests.map((t) => ({ file: t.file, identifier: t.identifier }))
            );
          } else {
            result = await runTests({
              cwd,
              file: body.file,
              identifier: body.identifier,
            });
          }

          broadcastRefresh();

          return json({
            success: result.exitCode === 0,
            exitCode: result.exitCode,
            summary: result.summary,
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

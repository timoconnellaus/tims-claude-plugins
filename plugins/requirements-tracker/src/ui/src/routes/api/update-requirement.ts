import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { loadRequirement, saveRequirement } from "../../../../lib/store";
import { broadcastRefresh, getProjectCwd } from "../../api/sse";
import type { ImplementationStatus, Priority } from "../../../../lib/types";

const VALID_STATUSES: ImplementationStatus[] = ["planned", "done"];
const VALID_PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

export const Route = createFileRoute("/api/update-requirement")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const cwd = getProjectCwd();
          const body = (await request.json()) as {
            path: string;
            status?: ImplementationStatus;
            priority?: Priority | null; // null to remove priority
          };

          if (!body.path) {
            return json(
              { success: false, error: "Missing required field: path" },
              { status: 400 }
            );
          }

          // Validate status if provided
          if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
            return json(
              { success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
              { status: 400 }
            );
          }

          // Validate priority if provided (null is allowed to clear it)
          if (body.priority !== undefined && body.priority !== null && !VALID_PRIORITIES.includes(body.priority)) {
            return json(
              { success: false, error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}` },
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

          // Update fields
          if (body.status !== undefined) {
            requirement.data.status = body.status;
          }
          if (body.priority !== undefined) {
            if (body.priority === null) {
              delete requirement.data.priority;
            } else {
              requirement.data.priority = body.priority;
            }
          }

          await saveRequirement(cwd, body.path, requirement.data);
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

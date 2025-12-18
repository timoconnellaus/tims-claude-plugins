import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

const DOC_PAGES = [
  { slug: "index", title: "Overview" },
  { slug: "usage-guide", title: "Usage Guide" },
  { slug: "cli-reference", title: "CLI Reference" },
  { slug: "architecture", title: "Architecture" },
  { slug: "how-it-works", title: "How It Works" },
];

export const Route = createFileRoute("/api/docs/")({
  server: {
    handlers: {
      GET: async () => {
        return json({ pages: DOC_PAGES });
      },
    },
  },
});

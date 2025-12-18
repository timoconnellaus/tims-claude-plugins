import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DOC_PAGES = [
  { slug: "index", title: "Overview" },
  { slug: "usage-guide", title: "Usage Guide" },
  { slug: "cli-reference", title: "CLI Reference" },
  { slug: "architecture", title: "Architecture" },
  { slug: "how-it-works", title: "How It Works" },
];

// Docs directory - navigate from routes/api to plugin root docs
const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(dirname(dirname(dirname(dirname(__dirname)))), "docs");

export const Route = createFileRoute("/api/docs/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { slug } = params;
        const validSlugs = DOC_PAGES.map((p) => p.slug);

        if (!validSlugs.includes(slug)) {
          return json({ error: "Doc page not found" }, { status: 404 });
        }

        const filePath = join(docsDir, `${slug}.md`);
        if (!existsSync(filePath)) {
          return json({ error: "Doc file not found" }, { status: 404 });
        }

        try {
          const content = readFileSync(filePath, "utf-8");
          return json({ slug, content });
        } catch {
          return json({ error: "Failed to read doc file" }, { status: 500 });
        }
      },
    },
  },
});

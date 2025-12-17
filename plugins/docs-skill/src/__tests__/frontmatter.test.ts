import { describe, it, expect } from "bun:test";
import {
  parseFrontmatter,
  isValidTopicFormat,
  generateFrontmatter,
  parseMarkdownFile,
} from "../lib/frontmatter";
import type { DocFrontmatter } from "../lib/types";

describe("parseFrontmatter", () => {
  it("parses valid frontmatter with required fields", () => {
    const content = `---
topic: nextjs/routing
title: Routing in Next.js
---

# Content here`;

    const result = parseFrontmatter(content, "test.md");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.frontmatter.topic).toBe("nextjs/routing");
      expect(result.frontmatter.title).toBe("Routing in Next.js");
      expect(result.content).toBe("# Content here");
      expect(result.lineCount).toBe(1);
    }
  });

  it("parses frontmatter with all optional fields", () => {
    const content = `---
topic: nextjs/routing/dynamic
title: Dynamic Routes
description: Learn about dynamic routing
version: "15.0"
lastUpdated: "2024-01-15"
sourceUrl: "https://nextjs.org/docs"
tags:
  - routing
  - dynamic
---

Content`;

    const result = parseFrontmatter(content, "test.md");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.frontmatter.topic).toBe("nextjs/routing/dynamic");
      expect(result.frontmatter.description).toBe("Learn about dynamic routing");
      expect(result.frontmatter.version).toBe("15.0");
      expect(result.frontmatter.lastUpdated).toBe("2024-01-15");
      expect(result.frontmatter.sourceUrl).toBe("https://nextjs.org/docs");
      expect(result.frontmatter.tags).toEqual(["routing", "dynamic"]);
    }
  });

  it("fails when frontmatter delimiter is missing at start", () => {
    const content = `topic: nextjs/routing
title: Test
---

Content`;

    const result = parseFrontmatter(content, "test.md");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("must start with YAML frontmatter");
    }
  });

  it("fails when closing delimiter is missing", () => {
    const content = `---
topic: nextjs/routing
title: Test

Content`;

    const result = parseFrontmatter(content, "test.md");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("not closed");
    }
  });

  it("fails when topic is missing", () => {
    const content = `---
title: Test
---

Content`;

    const result = parseFrontmatter(content, "test.md");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("topic");
    }
  });

  it("fails when title is missing", () => {
    const content = `---
topic: nextjs/routing
---

Content`;

    const result = parseFrontmatter(content, "test.md");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("title");
    }
  });

  it("fails on invalid topic format", () => {
    const content = `---
topic: NextJS/Routing
title: Test
---

Content`;

    const result = parseFrontmatter(content, "test.md");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid topic format");
    }
  });

  it("fails on invalid YAML", () => {
    const content = `---
topic: nextjs/routing
title: [invalid yaml
---

Content`;

    const result = parseFrontmatter(content, "test.md");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid YAML");
    }
  });

  it("fails when tags is not an array", () => {
    const content = `---
topic: nextjs/routing
title: Test
tags: not-an-array
---

Content`;

    const result = parseFrontmatter(content, "test.md");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("tags");
    }
  });

  it("fails when tags contains non-strings", () => {
    const content = `---
topic: nextjs/routing
title: Test
tags:
  - valid
  - 123
---

Content`;

    const result = parseFrontmatter(content, "test.md");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("tags");
    }
  });

  it("counts content lines correctly", () => {
    const content = `---
topic: nextjs/routing
title: Test
---

Line 1
Line 2
Line 3`;

    const result = parseFrontmatter(content, "test.md");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.lineCount).toBe(3); // Content is trimmed, so 3 lines
    }
  });

  it("handles empty content", () => {
    const content = `---
topic: nextjs/routing
title: Test
---`;

    const result = parseFrontmatter(content, "test.md");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.content).toBe("");
      expect(result.lineCount).toBe(0);
    }
  });
});

describe("isValidTopicFormat", () => {
  it("accepts valid simple topic", () => {
    expect(isValidTopicFormat("nextjs")).toBe(true);
  });

  it("accepts valid nested topic", () => {
    expect(isValidTopicFormat("nextjs/routing")).toBe(true);
  });

  it("accepts valid deeply nested topic", () => {
    expect(isValidTopicFormat("nextjs/routing/dynamic-routes")).toBe(true);
  });

  it("accepts topic with numbers", () => {
    expect(isValidTopicFormat("react19/hooks")).toBe(true);
  });

  it("accepts topic with hyphens", () => {
    expect(isValidTopicFormat("tanstack-start/data-fetching")).toBe(true);
  });

  it("rejects uppercase letters", () => {
    expect(isValidTopicFormat("NextJS/routing")).toBe(false);
  });

  it("rejects leading slash", () => {
    expect(isValidTopicFormat("/nextjs/routing")).toBe(false);
  });

  it("rejects trailing slash", () => {
    expect(isValidTopicFormat("nextjs/routing/")).toBe(false);
  });

  it("rejects consecutive slashes", () => {
    expect(isValidTopicFormat("nextjs//routing")).toBe(false);
  });

  it("rejects spaces", () => {
    expect(isValidTopicFormat("next js/routing")).toBe(false);
  });

  it("rejects special characters", () => {
    expect(isValidTopicFormat("nextjs/routing@v2")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidTopicFormat("")).toBe(false);
  });
});

describe("generateFrontmatter", () => {
  it("generates frontmatter with required fields", () => {
    const fm: DocFrontmatter = {
      topic: "nextjs/routing",
      title: "Routing",
    };

    const result = generateFrontmatter(fm);

    expect(result).toContain("---");
    expect(result).toContain("topic: nextjs/routing");
    expect(result).toContain('title: "Routing"');
  });

  it("generates frontmatter with all fields", () => {
    const fm: DocFrontmatter = {
      topic: "nextjs/routing",
      title: "Routing",
      description: "Learn routing",
      version: "15.0",
      lastUpdated: "2024-01-15",
      sourceUrl: "https://nextjs.org",
      tags: ["routing", "nav"],
    };

    const result = generateFrontmatter(fm);

    expect(result).toContain('description: "Learn routing"');
    expect(result).toContain('version: "15.0"');
    expect(result).toContain('lastUpdated: "2024-01-15"');
    expect(result).toContain('sourceUrl: "https://nextjs.org"');
    expect(result).toContain("tags:");
    expect(result).toContain("  - routing");
    expect(result).toContain("  - nav");
  });

  it("escapes quotes in title", () => {
    const fm: DocFrontmatter = {
      topic: "test",
      title: 'Title with "quotes"',
    };

    const result = generateFrontmatter(fm);

    expect(result).toContain('title: "Title with \\"quotes\\""');
  });
});

describe("parseMarkdownFile", () => {
  it("returns ParsedDoc for valid file", () => {
    const content = `---
topic: nextjs/routing
title: Routing
---

# Content`;

    const result = parseMarkdownFile(content, "routing.md");

    expect(result).not.toBeNull();
    expect(result?.path).toBe("routing.md");
    expect(result?.frontmatter.topic).toBe("nextjs/routing");
    expect(result?.content).toBe("# Content");
  });

  it("returns null for invalid file", () => {
    const content = "No frontmatter here";

    const result = parseMarkdownFile(content, "invalid.md");

    expect(result).toBeNull();
  });
});

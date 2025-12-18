import { describe, it, expect } from "bun:test";
import {
  validateDoc,
  validateRawMarkdown,
  formatValidationErrors,
  formatValidationResult,
} from "../lib/validator";
import type { ParsedDoc, ValidationError, ValidationResult } from "../lib/types";
import { MAX_LINES_PER_FILE } from "../lib/types";

describe("validateDoc", () => {
  it("returns no errors for valid doc", () => {
    const doc: ParsedDoc = {
      path: "test.md",
      frontmatter: {
        topic: "nextjs/routing",
        title: "Routing",
      },
      content: "Some content",
      lineCount: 10,
    };

    const errors = validateDoc(doc);

    expect(errors).toHaveLength(0);
  });

  it("reports missing topic", () => {
    const doc: ParsedDoc = {
      path: "test.md",
      frontmatter: {
        topic: "",
        title: "Title",
      },
      content: "Content",
      lineCount: 10,
    };

    const errors = validateDoc(doc);

    expect(errors.some((e) => e.type === "missing_topic")).toBe(true);
  });

  it("reports invalid topic format", () => {
    const doc: ParsedDoc = {
      path: "test.md",
      frontmatter: {
        topic: "NextJS/Routing",
        title: "Title",
      },
      content: "Content",
      lineCount: 10,
    };

    const errors = validateDoc(doc);

    expect(errors.some((e) => e.type === "invalid_topic_format")).toBe(true);
  });

  it("reports missing title", () => {
    const doc: ParsedDoc = {
      path: "test.md",
      frontmatter: {
        topic: "nextjs/routing",
        title: "",
      },
      content: "Content",
      lineCount: 10,
    };

    const errors = validateDoc(doc);

    expect(errors.some((e) => e.type === "missing_title")).toBe(true);
  });

  it("reports line limit exceeded", () => {
    const doc: ParsedDoc = {
      path: "test.md",
      frontmatter: {
        topic: "nextjs/routing",
        title: "Title",
      },
      content: "Content",
      lineCount: MAX_LINES_PER_FILE + 1,
    };

    const errors = validateDoc(doc);

    expect(errors.some((e) => e.type === "line_limit_exceeded")).toBe(true);
  });

  it("does not report at exactly line limit", () => {
    const doc: ParsedDoc = {
      path: "test.md",
      frontmatter: {
        topic: "nextjs/routing",
        title: "Title",
      },
      content: "Content",
      lineCount: MAX_LINES_PER_FILE,
    };

    const errors = validateDoc(doc);

    expect(errors.some((e) => e.type === "line_limit_exceeded")).toBe(false);
  });

  it("includes path in all errors", () => {
    const doc: ParsedDoc = {
      path: "nested/path/test.md",
      frontmatter: {
        topic: "",
        title: "",
      },
      content: "Content",
      lineCount: 10,
    };

    const errors = validateDoc(doc);

    for (const error of errors) {
      expect(error.path).toBe("nested/path/test.md");
    }
  });

  it("can report multiple errors at once", () => {
    const doc: ParsedDoc = {
      path: "test.md",
      frontmatter: {
        topic: "",
        title: "",
      },
      content: "Content",
      lineCount: MAX_LINES_PER_FILE + 100,
    };

    const errors = validateDoc(doc);

    expect(errors.length).toBeGreaterThan(1);
  });
});

describe("validateRawMarkdown", () => {
  it("returns no errors for valid markdown", () => {
    const content = `---
topic: nextjs/routing
title: Routing
---

# Content`;

    const errors = validateRawMarkdown(content, "test.md");

    expect(errors).toHaveLength(0);
  });

  it("reports missing frontmatter", () => {
    const content = `# No Frontmatter

Just content`;

    const errors = validateRawMarkdown(content, "test.md");

    expect(errors.some((e) => e.type === "missing_frontmatter")).toBe(true);
  });

  it("reports unclosed frontmatter", () => {
    const content = `---
topic: nextjs/routing
title: Test

Content without closing ---`;

    const errors = validateRawMarkdown(content, "test.md");

    expect(errors.some((e) => e.type === "missing_frontmatter")).toBe(true);
  });

  it("reports invalid YAML", () => {
    const content = `---
topic: [invalid
title: Test
---

Content`;

    const errors = validateRawMarkdown(content, "test.md");

    expect(errors.some((e) => e.type === "missing_frontmatter")).toBe(true);
    expect(errors[0].message).toContain("YAML");
  });

  it("validates content after parsing frontmatter", () => {
    const content = `---
topic: INVALID/FORMAT
title: Test
---

Content`;

    const errors = validateRawMarkdown(content, "test.md");

    // Invalid topic format is caught during frontmatter parsing
    expect(errors.some((e) => e.type === "missing_frontmatter")).toBe(true);
    expect(errors[0].message).toContain("Invalid topic format");
  });

  it("correctly counts lines excluding frontmatter", () => {
    // Create content that would exceed limit only if frontmatter is counted
    const frontmatter = `---
topic: nextjs/routing
title: Test
---

`;
    const contentLines = Array(MAX_LINES_PER_FILE - 10)
      .fill("Line")
      .join("\n");
    const content = frontmatter + contentLines;

    const errors = validateRawMarkdown(content, "test.md");

    expect(errors.some((e) => e.type === "line_limit_exceeded")).toBe(false);
  });
});

describe("formatValidationErrors", () => {
  it("returns message for no errors", () => {
    const result = formatValidationErrors([]);

    expect(result).toBe("No errors found.");
  });

  it("formats single error", () => {
    const errors: ValidationError[] = [
      {
        path: "test.md",
        type: "missing_topic",
        message: "Missing topic field",
      },
    ];

    const result = formatValidationErrors(errors);

    expect(result).toContain("1 validation error");
    expect(result).toContain("test.md");
    expect(result).toContain("missing_topic");
    expect(result).toContain("Missing topic field");
  });

  it("formats multiple errors", () => {
    const errors: ValidationError[] = [
      {
        path: "one.md",
        type: "missing_topic",
        message: "Error one",
      },
      {
        path: "two.md",
        type: "line_limit_exceeded",
        message: "Error two",
      },
    ];

    const result = formatValidationErrors(errors);

    expect(result).toContain("2 validation error");
    expect(result).toContain("one.md");
    expect(result).toContain("two.md");
  });

  it("includes line number when present", () => {
    const errors: ValidationError[] = [
      {
        path: "test.md",
        type: "missing_frontmatter",
        message: "No frontmatter",
        line: 1,
      },
    ];

    const result = formatValidationErrors(errors);

    expect(result).toContain("test.md:1");
  });
});

describe("formatValidationResult", () => {
  it("formats valid result", () => {
    const result: ValidationResult = {
      source: "nextjs",
      valid: true,
      errors: [],
      docCount: 10,
      topicCount: 8,
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain("nextjs");
    expect(formatted).toContain("VALID");
    expect(formatted).toContain("Documents: 10");
    expect(formatted).toContain("Topics: 8");
  });

  it("formats invalid result with errors", () => {
    const result: ValidationResult = {
      source: "nextjs",
      valid: false,
      errors: [
        {
          path: "bad.md",
          type: "missing_topic",
          message: "Missing topic",
        },
      ],
      docCount: 9,
      topicCount: 7,
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain("nextjs");
    expect(formatted).toContain("INVALID");
    expect(formatted).toContain("Errors: 1");
    expect(formatted).toContain("bad.md");
    expect(formatted).toContain("Missing topic");
  });

  it("formats result with multiple errors", () => {
    const result: ValidationResult = {
      source: "docs",
      valid: false,
      errors: [
        { path: "a.md", type: "missing_topic", message: "Error 1" },
        { path: "b.md", type: "missing_title", message: "Error 2" },
        { path: "c.md", type: "line_limit_exceeded", message: "Error 3" },
      ],
      docCount: 5,
      topicCount: 3,
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain("Errors: 3");
    expect(formatted).toContain("a.md");
    expect(formatted).toContain("b.md");
    expect(formatted).toContain("c.md");
  });

  it("includes line numbers in error output", () => {
    const result: ValidationResult = {
      source: "test",
      valid: false,
      errors: [
        { path: "test.md", type: "missing_frontmatter", message: "Error", line: 5 },
      ],
      docCount: 0,
      topicCount: 0,
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain("test.md:5");
  });
});

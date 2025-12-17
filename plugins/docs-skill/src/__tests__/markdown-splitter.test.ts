import { describe, it, expect } from "bun:test";
import {
  splitByHeadings,
  mergeSections,
  splitLargeSection,
  extractHeadingText,
  headingToSlug,
  buildTableOfContents,
  getContentLineCount,
} from "../lib/markdown-splitter";
import type { DocSection } from "../lib/types";

describe("splitByHeadings", () => {
  it("splits content at h2 headings by default", () => {
    const content = `# Title

Intro text

## Section One

Content one

## Section Two

Content two`;

    const sections = splitByHeadings(content);

    // maxLevel=2 means split at h1 AND h2, so # Title is a section
    expect(sections).toHaveLength(3);
    expect(sections[0].heading).toBe("# Title");
    expect(sections[0].content).toContain("Intro text");
    expect(sections[1].heading).toBe("## Section One");
    expect(sections[1].content).toContain("Content one");
    expect(sections[2].heading).toBe("## Section Two");
    expect(sections[2].content).toContain("Content two");
  });

  it("respects maxLevel option", () => {
    const content = `# Title

## Section

### Subsection

Content`;

    const sections = splitByHeadings(content, { maxLevel: 3 });

    expect(sections).toHaveLength(3);
    expect(sections[0].heading).toBe("# Title");
    expect(sections[1].heading).toBe("## Section");
    expect(sections[2].heading).toBe("### Subsection");
  });

  it("captures heading level correctly", () => {
    const content = `## Heading Two

Content

### Heading Three

More content`;

    const sections = splitByHeadings(content, { maxLevel: 3 });

    expect(sections[0].level).toBe(2);
    expect(sections[1].level).toBe(3);
  });

  it("tracks line numbers", () => {
    const content = `## First

Line 1
Line 2

## Second

Line 3`;

    const sections = splitByHeadings(content);

    expect(sections[0].startLine).toBe(1);
    expect(sections[1].startLine).toBeGreaterThan(sections[0].startLine);
  });

  it("handles content with no headings", () => {
    const content = `Just some content
without any headings
at all`;

    const sections = splitByHeadings(content);

    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("");
    expect(sections[0].level).toBe(0);
    expect(sections[0].content).toContain("Just some content");
  });

  it("handles empty content", () => {
    const sections = splitByHeadings("");

    // Empty string still produces one section with empty content
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("");
    expect(sections[0].content).toBe("");
  });

  it("handles content with only headings", () => {
    const content = `## One

## Two

## Three`;

    const sections = splitByHeadings(content);

    expect(sections).toHaveLength(3);
    expect(sections[0].heading).toBe("## One");
    expect(sections[1].heading).toBe("## Two");
    expect(sections[2].heading).toBe("## Three");
  });

  it("does not split on h3+ when maxLevel is 2", () => {
    const content = `## Section

### Subsection

Content under subsection

#### Deep

Even deeper`;

    const sections = splitByHeadings(content, { maxLevel: 2 });

    expect(sections).toHaveLength(1);
    expect(sections[0].content).toContain("### Subsection");
    expect(sections[0].content).toContain("#### Deep");
  });

  it("handles headings with special characters", () => {
    const content = `## What's New in v2.0?

Content

## FAQ & Help

More content`;

    const sections = splitByHeadings(content);

    expect(sections).toHaveLength(2);
    expect(sections[0].heading).toBe("## What's New in v2.0?");
    expect(sections[1].heading).toBe("## FAQ & Help");
  });
});

describe("mergeSections", () => {
  it("merges small consecutive sections", () => {
    const sections: DocSection[] = [
      { heading: "## One", level: 2, content: "Short", startLine: 1, endLine: 2 },
      { heading: "## Two", level: 2, content: "Also short", startLine: 3, endLine: 4 },
    ];

    const merged = mergeSections(sections, 50);

    expect(merged).toHaveLength(1);
    expect(merged[0].content).toContain("Short");
    expect(merged[0].content).toContain("## Two");
    expect(merged[0].content).toContain("Also short");
  });

  it("does not merge sections that exceed minLines", () => {
    const longContent = Array(60).fill("Line").join("\n");
    const sections: DocSection[] = [
      { heading: "## One", level: 2, content: longContent, startLine: 1, endLine: 60 },
      { heading: "## Two", level: 2, content: "Short", startLine: 61, endLine: 62 },
    ];

    const merged = mergeSections(sections, 50);

    expect(merged).toHaveLength(2);
  });

  it("handles empty sections array", () => {
    const merged = mergeSections([], 50);
    expect(merged).toHaveLength(0);
  });

  it("preserves end line from merged sections", () => {
    const sections: DocSection[] = [
      { heading: "## One", level: 2, content: "A", startLine: 1, endLine: 5 },
      { heading: "## Two", level: 2, content: "B", startLine: 6, endLine: 10 },
    ];

    const merged = mergeSections(sections, 50);

    expect(merged[0].endLine).toBe(10);
  });
});

describe("splitLargeSection", () => {
  it("returns unchanged if under limit", () => {
    const section: DocSection = {
      heading: "## Test",
      level: 2,
      content: "Short content",
      startLine: 1,
      endLine: 2,
    };

    const parts = splitLargeSection(section, 100);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual(section);
  });

  it("splits large section into parts", () => {
    const lines = Array(150).fill("Content line").join("\n");
    const section: DocSection = {
      heading: "## Large Section",
      level: 2,
      content: lines,
      startLine: 1,
      endLine: 150,
    };

    const parts = splitLargeSection(section, 50);

    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0].heading).toBe("## Large Section");
    expect(parts[1].heading).toContain("Part 2");
  });

  it("preserves level in split parts", () => {
    const lines = Array(150).fill("Line").join("\n");
    const section: DocSection = {
      heading: "### Deep Section",
      level: 3,
      content: lines,
      startLine: 1,
      endLine: 150,
    };

    const parts = splitLargeSection(section, 50);

    for (const part of parts) {
      expect(part.level).toBe(3);
    }
  });
});

describe("extractHeadingText", () => {
  it("extracts text from h1", () => {
    expect(extractHeadingText("# Title")).toBe("Title");
  });

  it("extracts text from h2", () => {
    expect(extractHeadingText("## Section")).toBe("Section");
  });

  it("extracts text from h6", () => {
    expect(extractHeadingText("###### Deep")).toBe("Deep");
  });

  it("handles extra spaces", () => {
    expect(extractHeadingText("##   Spaced   ")).toBe("Spaced");
  });

  it("returns trimmed input for non-heading", () => {
    expect(extractHeadingText("Not a heading")).toBe("Not a heading");
  });

  it("handles empty heading text", () => {
    // When heading has no text after #, returns trimmed input
    expect(extractHeadingText("## ")).toBe("##");
  });
});

describe("headingToSlug", () => {
  it("converts to lowercase", () => {
    expect(headingToSlug("## Title")).toBe("title");
  });

  it("replaces spaces with hyphens", () => {
    expect(headingToSlug("## Multiple Words Here")).toBe("multiple-words-here");
  });

  it("removes special characters", () => {
    expect(headingToSlug("## What's New?")).toBe("whats-new");
  });

  it("handles numbers", () => {
    expect(headingToSlug("## Version 2.0")).toBe("version-20");
  });

  it("collapses multiple hyphens", () => {
    expect(headingToSlug("## A   B   C")).toBe("a-b-c");
  });

  it("removes leading and trailing hyphens", () => {
    expect(headingToSlug("## -Test- ")).toBe("test");
  });
});

describe("buildTableOfContents", () => {
  it("builds TOC from sections", () => {
    const sections: DocSection[] = [
      { heading: "# Title", level: 1, content: "", startLine: 1, endLine: 1 },
      { heading: "## Section One", level: 2, content: "", startLine: 2, endLine: 2 },
      { heading: "## Section Two", level: 2, content: "", startLine: 3, endLine: 3 },
    ];

    const toc = buildTableOfContents(sections);

    expect(toc).toContain("[Title](#title)");
    expect(toc).toContain("[Section One](#section-one)");
    expect(toc).toContain("[Section Two](#section-two)");
  });

  it("indents based on heading level", () => {
    const sections: DocSection[] = [
      { heading: "# Top", level: 1, content: "", startLine: 1, endLine: 1 },
      { heading: "## Sub", level: 2, content: "", startLine: 2, endLine: 2 },
      { heading: "### Deep", level: 3, content: "", startLine: 3, endLine: 3 },
    ];

    const toc = buildTableOfContents(sections);
    const lines = toc.split("\n");

    expect(lines[0]).toBe("- [Top](#top)");
    expect(lines[1]).toBe("  - [Sub](#sub)");
    expect(lines[2]).toBe("    - [Deep](#deep)");
  });

  it("skips sections without headings", () => {
    const sections: DocSection[] = [
      { heading: "", level: 0, content: "Intro", startLine: 1, endLine: 1 },
      { heading: "## Real Section", level: 2, content: "", startLine: 2, endLine: 2 },
    ];

    const toc = buildTableOfContents(sections);

    expect(toc).not.toContain("Intro");
    expect(toc).toContain("[Real Section]");
  });

  it("handles empty sections array", () => {
    const toc = buildTableOfContents([]);
    expect(toc).toBe("");
  });
});

describe("getContentLineCount", () => {
  it("counts lines in content", () => {
    expect(getContentLineCount("Line 1\nLine 2\nLine 3")).toBe(3);
  });

  it("returns 0 for empty content", () => {
    expect(getContentLineCount("")).toBe(0);
  });

  it("returns 0 for whitespace-only content", () => {
    expect(getContentLineCount("   \n  \n   ")).toBe(0);
  });

  it("trims content before counting", () => {
    expect(getContentLineCount("\n\nLine 1\nLine 2\n\n")).toBe(2);
  });

  it("counts single line correctly", () => {
    expect(getContentLineCount("Single line")).toBe(1);
  });
});

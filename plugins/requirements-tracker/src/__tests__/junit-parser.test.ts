/**
 * Tests for JUnit XML parser
 */

import { describe, expect, test } from "bun:test";
import { parse, canParse } from "../lib/result-parsers/junit-xml";

describe("JUnit XML Parser", () => {
  describe("canParse", () => {
    test("returns true for XML with declaration", () => {
      const xml = `<?xml version="1.0"?>
<testsuites></testsuites>`;
      expect(canParse(xml)).toBe(true);
    });

    test("returns true for testsuites element", () => {
      expect(canParse("<testsuites></testsuites>")).toBe(true);
    });

    test("returns true for testsuite element", () => {
      expect(canParse("<testsuite></testsuite>")).toBe(true);
    });

    test("returns false for non-XML content", () => {
      expect(canParse("just some text")).toBe(false);
      expect(canParse('{"json": true}')).toBe(false);
      expect(canParse("<html></html>")).toBe(false);
    });

    test("handles whitespace", () => {
      expect(canParse("  <?xml version='1.0'?>")).toBe(true);
      expect(canParse("\n<testsuites>")).toBe(true);
    });
  });

  describe("parse", () => {
    test("parses simple passing test", () => {
      const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="src/auth.test.ts" tests="1" failures="0">
    <testcase name="validates user login" classname="src/auth.test.ts" time="0.05"/>
  </testsuite>
</testsuites>`;

      const { results, summary } = parse(xml);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        file: "src/auth.test.ts",
        identifier: "validates user login",
        status: "passed",
        duration: 50, // 0.05s = 50ms
        errorMessage: undefined,
      });
      expect(summary).toEqual({
        total: 1,
        passed: 1,
        failed: 0,
        skipped: 0,
      });
    });

    test("parses failing test", () => {
      const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="tests" tests="1" failures="1">
    <testcase name="should fail" classname="src/math.test.ts" time="0.01">
      <failure message="Expected 2 but got 3">AssertionError: values not equal</failure>
    </testcase>
  </testsuite>
</testsuites>`;

      const { results, summary } = parse(xml);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("failed");
      expect(results[0].errorMessage).toContain("Expected 2 but got 3");
      expect(summary.failed).toBe(1);
      expect(summary.passed).toBe(0);
    });

    test("parses error test", () => {
      const xml = `<testsuites>
  <testsuite name="tests" tests="1" errors="1">
    <testcase name="throws error" classname="src/api.test.ts" time="0.02">
      <error message="TypeError: Cannot read property">stack trace here</error>
    </testcase>
  </testsuite>
</testsuites>`;

      const { results, summary } = parse(xml);

      expect(results[0].status).toBe("error");
      expect(results[0].errorMessage).toContain("TypeError");
      expect(summary.failed).toBe(1);
    });

    test("parses skipped test", () => {
      const xml = `<testsuites>
  <testsuite name="tests" tests="1" skipped="1">
    <testcase name="todo test" classname="src/feature.test.ts">
      <skipped/>
    </testcase>
  </testsuite>
</testsuites>`;

      const { results, summary } = parse(xml);

      expect(results[0].status).toBe("skipped");
      expect(summary.skipped).toBe(1);
    });

    test("parses multiple test cases", () => {
      const xml = `<testsuites>
  <testsuite name="suite1" tests="3">
    <testcase name="test 1" classname="src/a.test.ts" time="0.1"/>
    <testcase name="test 2" classname="src/b.test.ts" time="0.2">
      <failure message="failed"/>
    </testcase>
    <testcase name="test 3" classname="src/c.test.ts">
      <skipped/>
    </testcase>
  </testsuite>
</testsuites>`;

      const { results, summary } = parse(xml);

      expect(results).toHaveLength(3);
      expect(summary).toEqual({
        total: 3,
        passed: 1,
        failed: 1,
        skipped: 1,
      });
    });

    test("handles XML entities in messages", () => {
      const xml = `<testsuites>
  <testsuite tests="1">
    <testcase name="test &amp; &lt;special&gt;" classname="test.ts">
      <failure message="Expected &lt;div&gt; but got &amp;nbsp;"/>
    </testcase>
  </testsuite>
</testsuites>`;

      const { results } = parse(xml);

      expect(results[0].identifier).toBe("test & <special>");
      expect(results[0].errorMessage).toContain("<div>");
    });

    test("handles self-closing testcase tags", () => {
      const xml = `<testsuites>
  <testsuite tests="1">
    <testcase name="quick test" classname="src/fast.test.ts" time="0.001"/>
  </testsuite>
</testsuites>`;

      const { results } = parse(xml);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("passed");
    });

    test("handles Bun-style output", () => {
      // Bun uses the file path as classname
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="bun test" tests="2" failures="0" errors="0" time="0.5">
  <testsuite name="src/lib/utils.test.ts" tests="2" failures="0" errors="0" time="0.3">
    <testcase classname="src/lib/utils.test.ts" name="formatDate formats correctly" time="0.1"/>
    <testcase classname="src/lib/utils.test.ts" name="parseDate parses ISO strings" time="0.2"/>
  </testsuite>
</testsuites>`;

      const { results, summary } = parse(xml);

      expect(results).toHaveLength(2);
      expect(results[0].file).toBe("src/lib/utils.test.ts");
      expect(results[1].file).toBe("src/lib/utils.test.ts");
      expect(summary.total).toBe(2);
      expect(summary.passed).toBe(2);
    });

    test("converts dot-separated classname to file path", () => {
      // Some runners use dots instead of slashes
      const xml = `<testsuites>
  <testsuite tests="1">
    <testcase name="test" classname="src.lib.auth.test" time="0.1"/>
  </testsuite>
</testsuites>`;

      const { results } = parse(xml);

      // Should convert dots to path separators
      expect(results[0].file).toBe("src/lib/auth/test.ts");
    });

    test("handles empty testsuites", () => {
      const xml = `<testsuites></testsuites>`;

      const { results, summary } = parse(xml);

      expect(results).toHaveLength(0);
      expect(summary.total).toBe(0);
    });
  });
});

/**
 * Tests for test result parsers
 */

import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { parseResults, detectFormat, bunJson, junitXml } from "../lib/result-parsers";

const fixturesDir = join(import.meta.dir, "fixtures");

describe("JUnit XML Parser", () => {
  const junitContent = readFileSync(join(fixturesDir, "junit-results.xml"), "utf-8");

  it("detects JUnit XML format", () => {
    expect(junitXml.canParse(junitContent)).toBe(true);
    expect(junitXml.canParse('<?xml version="1.0"?><testsuites/>')).toBe(true);
    expect(junitXml.canParse("<testsuite></testsuite>")).toBe(true);
  });

  it("does not detect JSON as XML", () => {
    expect(junitXml.canParse('{"tests": []}')).toBe(false);
  });

  it("parses test results", () => {
    const result = junitXml.parse(junitContent);
    expect(result.results).toHaveLength(5);
  });

  it("extracts correct file paths", () => {
    const result = junitXml.parse(junitContent);
    const files = new Set(result.results.map((r) => r.file));
    expect(files).toContain("src/auth.test.ts");
    expect(files).toContain("src/utils.test.ts");
  });

  it("extracts test identifiers", () => {
    const result = junitXml.parse(junitContent);
    const identifiers = result.results.map((r) => r.identifier);
    expect(identifiers).toContain("validates login credentials");
    expect(identifiers).toContain("rejects invalid password");
    expect(identifiers).toContain("handles empty username");
    expect(identifiers).toContain("formats date correctly");
    expect(identifiers).toContain("throws on invalid date");
  });

  it("determines correct status", () => {
    const result = junitXml.parse(junitContent);

    const passed = result.results.filter((r) => r.status === "passed");
    const failed = result.results.filter((r) => r.status === "failed");
    const errored = result.results.filter((r) => r.status === "error");

    expect(passed).toHaveLength(3);
    expect(failed).toHaveLength(1);
    expect(errored).toHaveLength(1);
  });

  it("extracts failure messages", () => {
    const result = junitXml.parse(junitContent);
    const failedTest = result.results.find(
      (r) => r.identifier === "rejects invalid password"
    );
    expect(failedTest).toBeDefined();
    expect(failedTest!.status).toBe("failed");
    expect(failedTest!.errorMessage).toContain("Expected true to be false");
  });

  it("extracts error messages", () => {
    const result = junitXml.parse(junitContent);
    const errorTest = result.results.find(
      (r) => r.identifier === "throws on invalid date"
    );
    expect(errorTest).toBeDefined();
    expect(errorTest!.status).toBe("error");
    expect(errorTest!.errorMessage).toContain("Cannot read property");
  });

  it("calculates summary correctly", () => {
    const result = junitXml.parse(junitContent);
    expect(result.summary.total).toBe(5);
    expect(result.summary.passed).toBe(3);
    expect(result.summary.failed).toBe(2); // 1 failure + 1 error
    expect(result.summary.skipped).toBe(0);
  });

  it("handles skipped tests", () => {
    const xml = `
      <testsuites>
        <testsuite name="test">
          <testcase name="skipped test" classname="test.ts">
            <skipped/>
          </testcase>
        </testsuite>
      </testsuites>
    `;
    const result = junitXml.parse(xml);
    expect(result.results[0].status).toBe("skipped");
    expect(result.summary.skipped).toBe(1);
  });

  it("handles self-closing testcase elements", () => {
    const xml = `
      <testsuites>
        <testsuite name="test">
          <testcase name="quick test" classname="test.ts" time="0.01"/>
        </testsuite>
      </testsuites>
    `;
    const result = junitXml.parse(xml);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe("passed");
  });
});

describe("Bun JSON Parser (Jest format)", () => {
  const jsonContent = readFileSync(join(fixturesDir, "bun-results.json"), "utf-8");

  it("detects JSON format", () => {
    expect(bunJson.canParse(jsonContent)).toBe(true);
    expect(bunJson.canParse('{"testResults": []}')).toBe(true);
  });

  it("does not detect XML as JSON", () => {
    expect(bunJson.canParse('<?xml version="1.0"?>')).toBe(false);
  });

  it("parses test results", () => {
    const result = bunJson.parse(jsonContent);
    expect(result.results).toHaveLength(5);
  });

  it("extracts correct file paths", () => {
    const result = bunJson.parse(jsonContent);
    const files = new Set(result.results.map((r) => r.file));
    expect(files).toContain("src/auth.test.ts");
    expect(files).toContain("src/utils.test.ts");
  });

  it("extracts test identifiers", () => {
    const result = bunJson.parse(jsonContent);
    const identifiers = result.results.map((r) => r.identifier);
    expect(identifiers).toContain("validates login credentials");
    expect(identifiers).toContain("rejects invalid password");
  });

  it("determines correct status", () => {
    const result = bunJson.parse(jsonContent);

    const passed = result.results.filter((r) => r.status === "passed");
    const failed = result.results.filter((r) => r.status === "failed");

    expect(passed).toHaveLength(3);
    expect(failed).toHaveLength(2);
  });

  it("extracts failure messages", () => {
    const result = bunJson.parse(jsonContent);
    const failedTest = result.results.find(
      (r) => r.identifier === "rejects invalid password"
    );
    expect(failedTest).toBeDefined();
    expect(failedTest!.errorMessage).toContain("Expected true to be false");
  });

  it("calculates summary correctly", () => {
    const result = bunJson.parse(jsonContent);
    expect(result.summary.total).toBe(5);
    expect(result.summary.passed).toBe(3);
    expect(result.summary.failed).toBe(2);
    expect(result.summary.skipped).toBe(0);
  });
});

describe("Bun JSON Parser (simple format)", () => {
  const simpleContent = readFileSync(join(fixturesDir, "simple-results.json"), "utf-8");

  it("parses simple format", () => {
    const result = bunJson.parse(simpleContent);
    expect(result.results).toHaveLength(4);
  });

  it("normalizes status values", () => {
    const result = bunJson.parse(simpleContent);
    const statuses = result.results.map((r) => r.status);
    expect(statuses).toContain("passed");
    expect(statuses).toContain("failed");
    expect(statuses).toContain("skipped");
  });

  it("extracts error messages", () => {
    const result = bunJson.parse(simpleContent);
    const failedTest = result.results.find(
      (r) => r.identifier === "rejects invalid password"
    );
    expect(failedTest).toBeDefined();
    expect(failedTest!.errorMessage).toBe("Expected true to be false");
  });

  it("calculates summary with skipped tests", () => {
    const result = bunJson.parse(simpleContent);
    expect(result.summary.total).toBe(4);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.failed).toBe(1);
    expect(result.summary.skipped).toBe(1);
  });
});

describe("Format Detection", () => {
  it("detects JUnit XML", () => {
    expect(detectFormat('<?xml version="1.0"?><testsuites/>')).toBe("junit-xml");
    expect(detectFormat("<testsuites></testsuites>")).toBe("junit-xml");
    expect(detectFormat("<testsuite></testsuite>")).toBe("junit-xml");
  });

  it("detects JSON", () => {
    expect(detectFormat('{"testResults": []}')).toBe("bun-json");
    expect(detectFormat('{"tests": []}')).toBe("bun-json");
  });

  it("returns null for unknown formats", () => {
    expect(detectFormat("hello world")).toBe(null);
    expect(detectFormat("")).toBe(null);
  });
});

describe("parseResults", () => {
  const junitContent = readFileSync(join(fixturesDir, "junit-results.xml"), "utf-8");
  const jsonContent = readFileSync(join(fixturesDir, "bun-results.json"), "utf-8");

  it("auto-detects and parses JUnit XML", () => {
    const result = parseResults(junitContent);
    expect(result.format).toBe("junit-xml");
    expect(result.results).toHaveLength(5);
  });

  it("auto-detects and parses JSON", () => {
    const result = parseResults(jsonContent);
    expect(result.format).toBe("bun-json");
    expect(result.results).toHaveLength(5);
  });

  it("uses explicit format when provided", () => {
    const result = parseResults(jsonContent, "bun-json");
    expect(result.format).toBe("bun-json");
  });

  it("throws on unknown format", () => {
    expect(() => parseResults("hello world")).toThrow("Could not detect");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseResults('{"invalid": }', "bun-json")).toThrow();
  });

  it("throws on JSON with wrong structure", () => {
    expect(() => parseResults('{"foo": "bar"}', "bun-json")).toThrow(
      "Unknown JSON format"
    );
  });
});

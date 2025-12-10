/**
 * Test suite for modular parser system
 */

import { describe, it, expect } from "bun:test";
import { extractTestsFromContent } from "../lib/test-parsers";
import { standardParser } from "../lib/test-parsers/standard";
import { modifiersParser } from "../lib/test-parsers/modifiers";
import { eachParser } from "../lib/test-parsers/each";
import { templateParser } from "../lib/test-parsers/template";

describe("Test Parsers", () => {
  describe("standardParser", () => {
    it("matches it() with single quotes", () => {
      const content = `it('should work', () => { expect(1).toBe(1); });`;
      const matches = standardParser.findMatches(content);
      expect(matches.length).toBe(1);
      expect(matches[0].identifier).toBe("should work");
    });

    it("matches test() with double quotes", () => {
      const content = `test("validates input", () => { expect(true).toBeTruthy(); });`;
      const matches = standardParser.findMatches(content);
      expect(matches.length).toBe(1);
      expect(matches[0].identifier).toBe("validates input");
    });

    it("matches Bun.test() with backticks", () => {
      const content = "Bun.test(`async operation`, async () => { await foo(); });";
      const matches = standardParser.findMatches(content);
      expect(matches.length).toBe(1);
      expect(matches[0].identifier).toBe("async operation");
    });

    it("handles multiple tests", () => {
      const content = `
        it('test 1', () => {});
        test('test 2', () => {});
        Bun.test('test 3', () => {});
      `;
      const matches = standardParser.findMatches(content);
      expect(matches.length).toBe(3);
    });

    it("handles whitespace variations", () => {
      const content = `it  (  'spaced out'  ,  () => {});`;
      const matches = standardParser.findMatches(content);
      expect(matches.length).toBe(1);
      expect(matches[0].identifier).toBe("spaced out");
    });
  });

  describe("modifiersParser", () => {
    it("matches it.only()", () => {
      const content = `it.only('focused test', () => { expect(1).toBe(1); });`;
      const matches = modifiersParser.findMatches(content);
      expect(matches.length).toBe(1);
      expect(matches[0].identifier).toBe("focused test");
    });

    it("matches test.skip()", () => {
      const content = `test.skip("disabled test", () => { expect(false).toBe(true); });`;
      const matches = modifiersParser.findMatches(content);
      expect(matches.length).toBe(1);
      expect(matches[0].identifier).toBe("disabled test");
    });

    it("matches Bun.test.only()", () => {
      const content = "Bun.test.only(`focused bun test`, () => {});";
      const matches = modifiersParser.findMatches(content);
      expect(matches.length).toBe(1);
      expect(matches[0].identifier).toBe("focused bun test");
    });

    it("does not match standard tests", () => {
      const content = `it('normal test', () => {});`;
      const matches = modifiersParser.findMatches(content);
      expect(matches.length).toBe(0);
    });
  });

  describe("eachParser", () => {
    it("matches it.each() with array", () => {
      const content = `
        it.each([
          [1, 2, 3],
          [4, 5, 9],
        ])('adds %i + %i to equal %i', (a, b, expected) => {
          expect(a + b).toBe(expected);
        });
      `;
      const matches = eachParser.findMatches(content);
      expect(matches.length).toBe(1);
      expect(matches[0].identifier).toBe("adds %i + %i to equal %i");
    });

    it("matches test.each() with simple array", () => {
      const content = `test.each([1, 2, 3])('number %s is positive', (num) => {});`;
      const matches = eachParser.findMatches(content);
      expect(matches.length).toBe(1);
      expect(matches[0].identifier).toBe("number %s is positive");
    });

    it("matches describe.each()", () => {
      const content = `describe.each([{user: 'alice'}, {user: 'bob'}])('user %s tests', (user) => {});`;
      const matches = eachParser.findMatches(content);
      expect(matches.length).toBe(1);
      expect(matches[0].identifier).toBe("user %s tests");
    });

    it("does not match standard tests", () => {
      const content = `it('normal test', () => {});`;
      const matches = eachParser.findMatches(content);
      expect(matches.length).toBe(0);
    });
  });

  describe("templateParser", () => {
    it("matches it() with template literal", () => {
      const content = "it(`template test`, () => { expect(1).toBe(1); });";
      const matches = templateParser.findMatches(content);
      expect(matches.length).toBe(1);
      expect(matches[0].identifier).toBe("template test");
    });

    it("matches test() with template literal containing expressions", () => {
      const content = 'test(`test with ${variable}`, () => {});';
      const matches = templateParser.findMatches(content);
      expect(matches.length).toBe(1);
      expect(matches[0].identifier).toBe("test with ${variable}");
    });

    it("does not match tests with regular quotes", () => {
      const content = `it('regular quotes', () => {});`;
      const matches = templateParser.findMatches(content);
      expect(matches.length).toBe(0);
    });
  });

  describe("extractTestsFromContent integration", () => {
    it("extracts all standard tests", () => {
      const content = `
        it('test 1', () => { return 1; });
        test("test 2", () => { return 2; });
      `;
      const tests = extractTestsFromContent(content, "/fake/path.test.ts", "path.test.ts");
      expect(tests.length).toBe(2);
      expect(tests[0].identifier).toBe("test 1");
      expect(tests[1].identifier).toBe("test 2");
      expect(tests[0].hash).toBeDefined();
      expect(tests[0].hash.length).toBe(64); // SHA-256 hex length
    });

    it("extracts modified tests", () => {
      const content = `
        it.only('focused test', () => { return 1; });
        test.skip('skipped test', () => { return 2; });
      `;
      const tests = extractTestsFromContent(content, "/fake/path.test.ts", "path.test.ts");
      expect(tests.length).toBe(2);
      expect(tests[0].identifier).toBe("focused test");
      expect(tests[1].identifier).toBe("skipped test");
    });

    it("extracts parametrized tests", () => {
      const content = `
        it.each([1, 2, 3])('number %s', (n) => { expect(n).toBeGreaterThan(0); });
      `;
      const tests = extractTestsFromContent(content, "/fake/path.test.ts", "path.test.ts");
      expect(tests.length).toBe(1);
      expect(tests[0].identifier).toBe("number %s");
    });

    it("deduplicates by identifier (first match wins)", () => {
      const content = `
        it('duplicate test', () => { return 1; });
        it('duplicate test', () => { return 2; });
      `;
      const tests = extractTestsFromContent(content, "/fake/path.test.ts", "path.test.ts");
      expect(tests.length).toBe(1);
      expect(tests[0].body).toContain("return 1"); // First one wins
    });

    it("deduplicates .only variant with standard variant", () => {
      const content = `
        it.only('same test', () => { return 1; });
        it('same test', () => { return 2; });
      `;
      const tests = extractTestsFromContent(content, "/fake/path.test.ts", "path.test.ts");
      expect(tests.length).toBe(1);
      // standardParser runs first and matches the second test (it('same test', ...))
      // Then modifiersParser runs and matches the first test (it.only('same test', ...))
      // But by then 'same test' is already in seenIdentifiers, so it's skipped
      // Result: the standard test wins (return 2)
      expect(tests[0].body).toContain("return 2"); // Standard test appears first in processing
    });

    it("extracts body and computes hash correctly", () => {
      const content = `
        it('hash test', () => {
          const x = 1;
          expect(x).toBe(1);
        });
      `;
      const tests = extractTestsFromContent(content, "/fake/path.test.ts", "path.test.ts");
      expect(tests.length).toBe(1);
      expect(tests[0].body).toContain("const x = 1");
      expect(tests[0].body).toContain("expect(x).toBe(1)");
      expect(tests[0].hash.length).toBe(64);
    });

    it("handles nested braces in function body", () => {
      const content = `
        it('nested test', () => {
          if (true) {
            const obj = { a: 1, b: { c: 2 } };
            expect(obj.b.c).toBe(2);
          }
        });
      `;
      const tests = extractTestsFromContent(content, "/fake/path.test.ts", "path.test.ts");
      expect(tests.length).toBe(1);
      expect(tests[0].body).toContain("{ a: 1, b: { c: 2 } }");
    });

    it("sets correct file path", () => {
      const content = `it('test', () => {});`;
      const tests = extractTestsFromContent(
        content,
        "/absolute/path/to/file.test.ts",
        "relative/file.test.ts"
      );
      expect(tests.length).toBe(1);
      expect(tests[0].file).toBe("relative/file.test.ts");
    });

    it("handles mixed test styles", () => {
      const content = `
        it('standard it', () => {});
        test('standard test', () => {});
        it.only('focused it', () => {});
        test.skip('skipped test', () => {});
        it.each([1, 2])('parametrized %s', (n) => {});
      `;
      const tests = extractTestsFromContent(content, "/fake/path.test.ts", "path.test.ts");
      expect(tests.length).toBe(5);
      expect(tests.map((t) => t.identifier)).toEqual([
        "standard it",
        "standard test",
        "focused it",
        "skipped test",
        "parametrized %s",
      ]);
    });

    it("produces different hashes for different test bodies", () => {
      const content = `
        it('test 1', () => { return 1; });
        it('test 2', () => { return 2; });
      `;
      const tests = extractTestsFromContent(content, "/fake/path.test.ts", "path.test.ts");
      expect(tests.length).toBe(2);
      expect(tests[0].hash).not.toBe(tests[1].hash);
    });

    it("produces same hash for identical test bodies", () => {
      const content1 = `it('test a', () => { const x = 1; expect(x).toBe(1); });`;
      const content2 = `test('test b', () => { const x = 1; expect(x).toBe(1); });`;

      const tests1 = extractTestsFromContent(content1, "/fake/a.test.ts", "a.test.ts");
      const tests2 = extractTestsFromContent(content2, "/fake/b.test.ts", "b.test.ts");

      expect(tests1[0].hash).toBe(tests2[0].hash);
    });
  });
});

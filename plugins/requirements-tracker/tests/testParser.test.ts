import { describe, it, expect } from "bun:test";
import { extractTestBodyFromContent, hashTestBody } from "../src/lib/testParser";

describe("extractTestBodyFromContent", () => {
  describe("Jest/Vitest style", () => {
    it("extracts test() with arrow function", () => {
      const content = `
        test("my test", () => {
          expect(1).toBe(1);
        });
      `;
      const body = extractTestBodyFromContent(content, "my test");
      expect(body).not.toBeNull();
      expect(body).toContain('test("my test"');
      expect(body).toContain("expect(1).toBe(1)");
    });

    it("extracts it() with arrow function", () => {
      const content = `
        it("should work", () => {
          const x = 1;
          expect(x).toBe(1);
        });
      `;
      const body = extractTestBodyFromContent(content, "should work");
      expect(body).not.toBeNull();
      expect(body).toContain('it("should work"');
    });

    it("extracts describe() block", () => {
      const content = `
        describe("my suite", () => {
          it("nested test", () => {});
        });
      `;
      const body = extractTestBodyFromContent(content, "my suite");
      expect(body).not.toBeNull();
      expect(body).toContain('describe("my suite"');
      expect(body).toContain("nested test");
    });
  });

  describe("Bun.test style", () => {
    it("extracts Bun.test()", () => {
      const content = `
        Bun.test("bun test", () => {
          expect(true).toBe(true);
        });
      `;
      const body = extractTestBodyFromContent(content, "bun test");
      expect(body).not.toBeNull();
      expect(body).toContain('Bun.test("bun test"');
    });
  });

  describe("async tests", () => {
    it("extracts async arrow function", () => {
      const content = `
        test("async test", async () => {
          await someAsyncOp();
          expect(result).toBe(true);
        });
      `;
      const body = extractTestBodyFromContent(content, "async test");
      expect(body).not.toBeNull();
      expect(body).toContain("async");
      expect(body).toContain("await someAsyncOp()");
    });
  });

  describe("multi-line with nested braces", () => {
    it("handles nested objects", () => {
      const content = `
        test("complex test", () => {
          const obj = { a: { b: 1 } };
          expect(obj.a.b).toBe(1);
        });
      `;
      const body = extractTestBodyFromContent(content, "complex test");
      expect(body).not.toBeNull();
      expect(body).toContain("{ a: { b: 1 } }");
    });

    it("handles nested control flow", () => {
      const content = `
        test("with if", () => {
          if (true) {
            if (false) {
              doThing();
            }
          }
        });
      `;
      const body = extractTestBodyFromContent(content, "with if");
      expect(body).not.toBeNull();
      expect(body).toContain("if (true)");
      expect(body).toContain("if (false)");
    });
  });

  describe("arrow vs function keyword", () => {
    it("extracts arrow function", () => {
      const content = `test("arrow", () => { return 1; });`;
      const body = extractTestBodyFromContent(content, "arrow");
      expect(body).not.toBeNull();
      expect(body).toContain("() =>");
    });

    it("extracts function keyword", () => {
      const content = `test("function", function() { return 1; });`;
      const body = extractTestBodyFromContent(content, "function");
      expect(body).not.toBeNull();
      expect(body).toContain("function()");
    });
  });

  describe("string quote variations", () => {
    it("handles double quotes", () => {
      const content = `test("double quotes", () => {});`;
      const body = extractTestBodyFromContent(content, "double quotes");
      expect(body).not.toBeNull();
    });

    it("handles single quotes", () => {
      const content = `test('single quotes', () => {});`;
      const body = extractTestBodyFromContent(content, "single quotes");
      expect(body).not.toBeNull();
    });

    it("handles template literals", () => {
      const content = "test(`template literal`, () => {});";
      const body = extractTestBodyFromContent(content, "template literal");
      expect(body).not.toBeNull();
    });
  });

  describe("edge cases", () => {
    it("returns null for non-existent test", () => {
      const content = `test("existing", () => {});`;
      const body = extractTestBodyFromContent(content, "non-existent");
      expect(body).toBeNull();
    });

    it("handles strings with parentheses inside test body", () => {
      const content = `
        test("with parens", () => {
          const s = "hello (world)";
          console.log("(nested)");
        });
      `;
      const body = extractTestBodyFromContent(content, "with parens");
      expect(body).not.toBeNull();
      expect(body).toContain('"hello (world)"');
    });

    it("handles comments inside test", () => {
      const content = `
        test("with comments", () => {
          // single line comment
          /* multi
             line
             comment */
          doThing();
        });
      `;
      const body = extractTestBodyFromContent(content, "with comments");
      expect(body).not.toBeNull();
      expect(body).toContain("// single line comment");
      expect(body).toContain("doThing()");
    });

    it("handles special regex characters in test name", () => {
      const content = `test("test (with) [special] chars?", () => {});`;
      const body = extractTestBodyFromContent(content, "test (with) [special] chars?");
      expect(body).not.toBeNull();
    });

    it("extracts correct test when multiple tests exist", () => {
      const content = `
        test("first test", () => { return 1; });
        test("second test", () => { return 2; });
        test("third test", () => { return 3; });
      `;
      const body = extractTestBodyFromContent(content, "second test");
      expect(body).not.toBeNull();
      expect(body).toContain("return 2");
      expect(body).not.toContain("return 1");
      expect(body).not.toContain("return 3");
    });
  });
});

describe("hashTestBody", () => {
  it("produces consistent hash for same content", () => {
    const body = `test("my test", () => { expect(1).toBe(1); });`;
    const hash1 = hashTestBody(body);
    const hash2 = hashTestBody(body);
    expect(hash1).toBe(hash2);
  });

  it("produces different hash for different content", () => {
    const body1 = `test("my test", () => { expect(1).toBe(1); });`;
    const body2 = `test("my test", () => { expect(2).toBe(2); });`;
    const hash1 = hashTestBody(body1);
    const hash2 = hashTestBody(body2);
    expect(hash1).not.toBe(hash2);
  });

  it("hash is stable across whitespace changes", () => {
    const body1 = `test("my test", () => { expect(1).toBe(1); });`;
    const body2 = `test("my test",   ()   =>   {   expect(1).toBe(1);   });`;
    const body3 = `test("my test", () => {
      expect(1).toBe(1);
    });`;
    const hash1 = hashTestBody(body1);
    const hash2 = hashTestBody(body2);
    const hash3 = hashTestBody(body3);
    expect(hash1).toBe(hash2);
    expect(hash1).toBe(hash3);
  });

  it("hash changes when actual code changes", () => {
    const body1 = `test("my test", () => { expect(1).toBe(1); });`;
    const body2 = `test("my test", () => { expect(1).toBe(2); });`;
    expect(hashTestBody(body1)).not.toBe(hashTestBody(body2));
  });
});

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  computeHash,
  extractFunctionBody,
  extractTestsFromFile,
  extractAllTests,
  findTest,
} from "../lib/test-parser";

describe("Test Parser", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-parser-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("computeHash", () => {
    it("produces consistent SHA-256 hash", () => {
      const hash1 = computeHash("test content");
      const hash2 = computeHash("test content");
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 hex length
    });

    it("produces different hashes for different content", () => {
      const hash1 = computeHash("content A");
      const hash2 = computeHash("content B");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("extractFunctionBody", () => {
    it("extracts simple function body", () => {
      const code = `function test() { return 1; }`;
      const body = extractFunctionBody(code, 15);
      expect(body).toBe("{ return 1; }");
    });

    it("handles nested braces", () => {
      const code = `const fn = () => { if (true) { return { a: 1 }; } }`;
      const body = extractFunctionBody(code, 16);
      expect(body).toBe("{ if (true) { return { a: 1 }; } }");
    });

    it("handles string literals with braces", () => {
      const code = `const fn = () => { const s = "{not a brace}"; return s; }`;
      const body = extractFunctionBody(code, 16);
      expect(body).toContain("{not a brace}");
      expect(body).toContain("return s;");
    });
  });

  describe("extractTestsFromFile", () => {
    it("extracts it() style tests", async () => {
      const testFile = join(tempDir, "it.test.ts");
      await writeFile(
        testFile,
        `
        it("should work", () => {
          expect(true).toBe(true);
        });

        it("handles errors", () => {
          expect(false).toBe(false);
        });
      `
      );

      const tests = await extractTestsFromFile(testFile, tempDir);
      expect(tests.length).toBe(2);
      expect(tests[0].identifier).toBe("should work");
      expect(tests[1].identifier).toBe("handles errors");
    });

    it("extracts test() style tests", async () => {
      const testFile = join(tempDir, "test.test.ts");
      await writeFile(
        testFile,
        `
        test("validates input", () => {
          expect(1).toBe(1);
        });
      `
      );

      const tests = await extractTestsFromFile(testFile, tempDir);
      expect(tests.length).toBe(1);
      expect(tests[0].identifier).toBe("validates input");
    });

    it("extracts Bun.test() style tests", async () => {
      const testFile = join(tempDir, "bun.test.ts");
      await writeFile(
        testFile,
        `
        Bun.test("bun specific test", () => {
          expect(1).toBe(1);
        });
      `
      );

      const tests = await extractTestsFromFile(testFile, tempDir);
      expect(tests.length).toBe(1);
      expect(tests[0].identifier).toBe("bun specific test");
    });

    it("computes hash for each test", async () => {
      const testFile = join(tempDir, "hash.test.ts");
      await writeFile(
        testFile,
        `
        it("test 1", () => { return 1; });
        it("test 2", () => { return 2; });
      `
      );

      const tests = await extractTestsFromFile(testFile, tempDir);
      expect(tests[0].hash).not.toBe(tests[1].hash);
      expect(tests[0].hash.length).toBe(64);
    });

    it("uses relative file path", async () => {
      const testFile = join(tempDir, "relative.test.ts");
      await writeFile(testFile, `it("test", () => {});`);

      const tests = await extractTestsFromFile(testFile, tempDir);
      expect(tests[0].file).toBe("relative.test.ts");
    });
  });

  describe("extractAllTests", () => {
    it("finds tests across multiple files", async () => {
      await writeFile(join(tempDir, "a.test.ts"), `it("a test", () => {});`);
      await writeFile(join(tempDir, "b.test.ts"), `it("b test", () => {});`);
      await writeFile(join(tempDir, "not-a-test.ts"), `// no tests here`);

      const tests = await extractAllTests(tempDir, "**/*.test.ts");
      expect(tests.length).toBe(2);
    });

    it("ignores node_modules", async () => {
      await mkdir(join(tempDir, "node_modules"));
      await writeFile(
        join(tempDir, "node_modules", "pkg.test.ts"),
        `it("ignore me", () => {});`
      );
      await writeFile(join(tempDir, "real.test.ts"), `it("include me", () => {});`);

      const tests = await extractAllTests(tempDir, "**/*.test.ts");
      expect(tests.length).toBe(1);
      expect(tests[0].identifier).toBe("include me");
    });
  });

  describe("findTest", () => {
    it("finds specific test by file and identifier", async () => {
      await writeFile(
        join(tempDir, "find.test.ts"),
        `
        it("first test", () => { return 1; });
        it("second test", () => { return 2; });
      `
      );

      const found = await findTest(tempDir, "find.test.ts", "second test");
      expect(found).not.toBe(null);
      expect(found?.identifier).toBe("second test");
    });

    it("returns null for non-existent test", async () => {
      await writeFile(join(tempDir, "find.test.ts"), `it("only test", () => {});`);

      const found = await findTest(tempDir, "find.test.ts", "nonexistent");
      expect(found).toBe(null);
    });

    it("returns null for non-existent file", async () => {
      const found = await findTest(tempDir, "nonexistent.test.ts", "test");
      expect(found).toBe(null);
    });
  });
});

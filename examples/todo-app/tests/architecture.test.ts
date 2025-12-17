import { describe, test, expect } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";

describe("Architecture", () => {
  test("uses Bun monorepo with workspaces", async () => {
    // Find the root package.json by walking up from the current directory
    const rootPackageJsonPath = join(import.meta.dir, "../../../package.json");

    expect(existsSync(rootPackageJsonPath)).toBe(true);

    const rootPackageJson = await Bun.file(rootPackageJsonPath).json();

    // Bun monorepos use the "workspaces" field
    expect(rootPackageJson.workspaces).toBeDefined();
    expect(Array.isArray(rootPackageJson.workspaces)).toBe(true);
    expect(rootPackageJson.workspaces.length).toBeGreaterThan(0);
  });
});

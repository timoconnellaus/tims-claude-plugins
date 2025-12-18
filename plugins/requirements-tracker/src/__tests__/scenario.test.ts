import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parse as parseYaml } from "yaml";
import {
  createRequirementsDir,
  saveConfig,
  saveRequirement,
  loadRequirement,
  getRequirementsDir,
} from "../lib/store";
import { addScenario, AddScenarioError } from "../commands/add-scenario";
import { acceptScenario, AcceptScenarioError } from "../commands/accept-scenario";
import { rejectScenario, RejectScenarioError } from "../commands/reject-scenario";
import type { Requirement } from "../lib/types";

describe("Scenario Commands", () => {
  let tempDir: string;
  let consoleOutput: string[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-scenario-test-"));
    consoleOutput = [];

    // Capture console output
    spyOn(console, "log").mockImplementation((...args) => {
      consoleOutput.push(args.join(" "));
    });
    spyOn(console, "error").mockImplementation((...args) => {
      consoleOutput.push(args.join(" "));
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function setupRequirements() {
    await createRequirementsDir(tempDir);
    await saveConfig(tempDir, { testRunner: "bun test", testGlob: "**/*.test.ts" });
  }

  async function createRequirement(path: string, data: Partial<Requirement> = {}) {
    const requirement: Requirement = {
      gherkin: "Given a user\nWhen they login\nThen they are authenticated",
      source: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
      ...data,
    };
    await saveRequirement(tempDir, path, requirement);
    return requirement;
  }

  describe("addScenario", () => {
    it("adds a scenario to a requirement", async () => {
      await setupRequirements();
      await createRequirement("auth/REQ_login.yml");

      await addScenario({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        name: "invalid_password",
        gherkin: "Given user enters wrong password\nWhen they submit\nThen error is shown",
      });

      const req = await loadRequirement(tempDir, "auth/REQ_login.yml");
      expect(req?.data.scenarios).toHaveLength(1);
      expect(req?.data.scenarios![0].name).toBe("invalid_password");
      expect(req?.data.scenarios![0].gherkin).toContain("Given user enters wrong password");
    });

    it("auto-formats gherkin with multiple keywords per line", async () => {
      await setupRequirements();
      await createRequirement("auth/REQ_login.yml");

      await addScenario({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        name: "compact_gherkin",
        gherkin: "Given user exists When they login Then they see dashboard",
      });

      const req = await loadRequirement(tempDir, "auth/REQ_login.yml");
      const scenario = req?.data.scenarios![0];
      // Should be formatted to one keyword per line
      expect(scenario?.gherkin).toBe("Given user exists\nWhen they login\nThen they see dashboard");
    });

    it("adds scenario with suggested flag", async () => {
      await setupRequirements();
      await createRequirement("auth/REQ_login.yml");

      await addScenario({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        name: "suggested_scenario",
        gherkin: "Given something\nWhen action\nThen result",
        suggested: true,
      });

      const req = await loadRequirement(tempDir, "auth/REQ_login.yml");
      expect(req?.data.scenarios![0].suggested).toBe(true);
    });

    it("does not add suggested flag when false", async () => {
      await setupRequirements();
      await createRequirement("auth/REQ_login.yml");

      await addScenario({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        name: "regular_scenario",
        gherkin: "Given something\nWhen action\nThen result",
        suggested: false,
      });

      const req = await loadRequirement(tempDir, "auth/REQ_login.yml");
      expect(req?.data.scenarios![0].suggested).toBeUndefined();
    });

    it("throws error for duplicate scenario name", async () => {
      await setupRequirements();
      await createRequirement("auth/REQ_login.yml", {
        scenarios: [{ name: "existing", gherkin: "Given X\nWhen Y\nThen Z" }],
      });

      await expect(
        addScenario({
          cwd: tempDir,
          path: "auth/REQ_login.yml",
          name: "existing",
          gherkin: "Given A\nWhen B\nThen C",
        })
      ).rejects.toThrow(AddScenarioError);
    });

    it("throws error for invalid gherkin", async () => {
      await setupRequirements();
      await createRequirement("auth/REQ_login.yml");

      await expect(
        addScenario({
          cwd: tempDir,
          path: "auth/REQ_login.yml",
          name: "bad_gherkin",
          gherkin: "This is not valid gherkin at all",
        })
      ).rejects.toThrow(AddScenarioError);
    });

    it("throws error for invalid path format", async () => {
      await setupRequirements();

      await expect(
        addScenario({
          cwd: tempDir,
          path: "invalid.yml",
          name: "test",
          gherkin: "Given X\nWhen Y\nThen Z",
        })
      ).rejects.toThrow(AddScenarioError);
    });

    it("throws error when requirement not found", async () => {
      await setupRequirements();

      await expect(
        addScenario({
          cwd: tempDir,
          path: "auth/REQ_nonexistent.yml",
          name: "test",
          gherkin: "Given X\nWhen Y\nThen Z",
        })
      ).rejects.toThrow(AddScenarioError);
    });

    it("throws error when not initialized", async () => {
      await expect(
        addScenario({
          cwd: tempDir,
          path: "auth/REQ_login.yml",
          name: "test",
          gherkin: "Given X\nWhen Y\nThen Z",
        })
      ).rejects.toThrow(AddScenarioError);
    });
  });

  describe("acceptScenario", () => {
    it("removes suggested flag from scenario", async () => {
      await setupRequirements();
      await createRequirement("auth/REQ_login.yml", {
        scenarios: [
          { name: "pending", gherkin: "Given X\nWhen Y\nThen Z", suggested: true },
        ],
      });

      await acceptScenario({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        scenarioName: "pending",
      });

      const req = await loadRequirement(tempDir, "auth/REQ_login.yml");
      expect(req?.data.scenarios![0].suggested).toBeUndefined();
    });

    it("throws error when scenario not found", async () => {
      await setupRequirements();
      await createRequirement("auth/REQ_login.yml", {
        scenarios: [{ name: "other", gherkin: "Given X\nWhen Y\nThen Z" }],
      });

      await expect(
        acceptScenario({
          cwd: tempDir,
          path: "auth/REQ_login.yml",
          scenarioName: "nonexistent",
        })
      ).rejects.toThrow(AcceptScenarioError);
    });

    it("throws error when scenario is not suggested", async () => {
      await setupRequirements();
      await createRequirement("auth/REQ_login.yml", {
        scenarios: [{ name: "regular", gherkin: "Given X\nWhen Y\nThen Z" }],
      });

      await expect(
        acceptScenario({
          cwd: tempDir,
          path: "auth/REQ_login.yml",
          scenarioName: "regular",
        })
      ).rejects.toThrow(AcceptScenarioError);
    });
  });

  describe("rejectScenario", () => {
    it("removes suggested scenario from list", async () => {
      await setupRequirements();
      await createRequirement("auth/REQ_login.yml", {
        scenarios: [
          { name: "keep", gherkin: "Given A\nWhen B\nThen C" },
          { name: "reject_me", gherkin: "Given X\nWhen Y\nThen Z", suggested: true },
        ],
      });

      await rejectScenario({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        scenarioName: "reject_me",
      });

      const req = await loadRequirement(tempDir, "auth/REQ_login.yml");
      expect(req?.data.scenarios).toHaveLength(1);
      expect(req?.data.scenarios![0].name).toBe("keep");
    });

    it("throws error when scenario not found", async () => {
      await setupRequirements();
      await createRequirement("auth/REQ_login.yml", {
        scenarios: [{ name: "other", gherkin: "Given X\nWhen Y\nThen Z", suggested: true }],
      });

      await expect(
        rejectScenario({
          cwd: tempDir,
          path: "auth/REQ_login.yml",
          scenarioName: "nonexistent",
        })
      ).rejects.toThrow(RejectScenarioError);
    });

    it("throws error when scenario is not suggested", async () => {
      await setupRequirements();
      await createRequirement("auth/REQ_login.yml", {
        scenarios: [{ name: "regular", gherkin: "Given X\nWhen Y\nThen Z" }],
      });

      await expect(
        rejectScenario({
          cwd: tempDir,
          path: "auth/REQ_login.yml",
          scenarioName: "regular",
        })
      ).rejects.toThrow(RejectScenarioError);
    });
  });

  describe("UI workflow simulation", () => {
    it("accepts a suggested scenario from aiAssessment.suggestedScenarios", async () => {
      await setupRequirements();
      // Create requirement with existing scenarios and aiAssessment.suggestedScenarios
      await createRequirement("auth/REQ_login.yml", {
        scenarios: [
          { name: "existing_scenario", gherkin: "Given A\nWhen B\nThen C" },
        ],
        aiAssessment: {
          sufficient: true,
          notes: "Good coverage",
          assessedAt: new Date().toISOString(),
          suggestedScenarios: [
            {
              name: "malformed_config_handling",
              gherkin: "Given .docs folder contains a config without topics field\nWhen they load the config\nThen topics defaults to empty array",
              rationale: "Test covers graceful handling of malformed configs",
            },
          ],
        },
      });

      // Simulate what the UI does: call addScenario with data from suggestedScenarios
      await addScenario({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        name: "malformed_config_handling",
        gherkin: "Given .docs folder contains a config without topics field\nWhen they load the config\nThen topics defaults to empty array",
      });

      const req = await loadRequirement(tempDir, "auth/REQ_login.yml");

      // Should have 2 scenarios now
      expect(req?.data.scenarios).toHaveLength(2);
      expect(req?.data.scenarios![1].name).toBe("malformed_config_handling");
      // Should NOT have suggested flag since we didn't pass suggested: true
      expect(req?.data.scenarios![1].suggested).toBeUndefined();
    });

    it("handles multiline gherkin from YAML correctly", async () => {
      await setupRequirements();
      await createRequirement("auth/REQ_login.yml");

      // This is how YAML multiline strings come through (with actual newlines)
      const yamlMultilineGherkin = `Given .docs folder contains a config without topics field
When they load the config
Then topics defaults to empty array`;

      await addScenario({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        name: "from_yaml",
        gherkin: yamlMultilineGherkin,
      });

      const req = await loadRequirement(tempDir, "auth/REQ_login.yml");
      expect(req?.data.scenarios![0].name).toBe("from_yaml");
      // Should preserve the multiline format
      expect(req?.data.scenarios![0].gherkin).toContain("\n");
    });
  });
});

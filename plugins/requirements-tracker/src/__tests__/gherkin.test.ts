import { describe, it, expect } from "bun:test";
import {
  parseGherkin,
  formatGherkin,
  validateGherkinStructure,
  parseAndFormat,
  isValidGherkinFormat,
  type GherkinStep,
} from "../lib/gherkin";

describe("Gherkin Parser", () => {
  describe("parseGherkin", () => {
    it("parses single-line input with all keywords inline", () => {
      const result = parseGherkin(
        "Given a user When they click Then something happens"
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.steps).toHaveLength(3);
        expect(result.steps[0]).toEqual({ keyword: "Given", text: "a user" });
        expect(result.steps[1]).toEqual({ keyword: "When", text: "they click" });
        expect(result.steps[2]).toEqual({
          keyword: "Then",
          text: "something happens",
        });
      }
    });

    it("parses multi-line input already formatted", () => {
      const result = parseGherkin(
        "Given a user is logged in\nWhen they click logout\nThen they are logged out"
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.steps).toHaveLength(3);
        expect(result.steps[0]).toEqual({
          keyword: "Given",
          text: "a user is logged in",
        });
        expect(result.steps[1]).toEqual({
          keyword: "When",
          text: "they click logout",
        });
        expect(result.steps[2]).toEqual({
          keyword: "Then",
          text: "they are logged out",
        });
      }
    });

    it("parses input with And/But keywords", () => {
      const result = parseGherkin(
        "Given a user And they have a cart When they checkout But payment fails Then error is shown"
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.steps).toHaveLength(5);
        expect(result.steps[0]).toEqual({ keyword: "Given", text: "a user" });
        expect(result.steps[1]).toEqual({
          keyword: "And",
          text: "they have a cart",
        });
        expect(result.steps[2]).toEqual({
          keyword: "When",
          text: "they checkout",
        });
        expect(result.steps[3]).toEqual({
          keyword: "But",
          text: "payment fails",
        });
        expect(result.steps[4]).toEqual({
          keyword: "Then",
          text: "error is shown",
        });
      }
    });

    it("handles mixed case keywords", () => {
      const result = parseGherkin(
        "GIVEN a user WHEN they click THEN something happens"
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.steps[0].keyword).toBe("Given");
        expect(result.steps[1].keyword).toBe("When");
        expect(result.steps[2].keyword).toBe("Then");
      }
    });

    it("handles extra whitespace", () => {
      const result = parseGherkin(
        "  Given   a user   \n\n  When   they click  \n  Then   result  "
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.steps[0].text).toBe("a user");
        expect(result.steps[1].text).toBe("they click");
        expect(result.steps[2].text).toBe("result");
      }
    });

    it("returns error for empty input", () => {
      const result = parseGherkin("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("empty");
      }
    });

    it("returns error for input without keywords", () => {
      const result = parseGherkin("This has no gherkin keywords at all");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("No Gherkin keywords found");
      }
    });

    it("returns error for empty step text", () => {
      const result = parseGherkin("Given When Then");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Empty step text");
      }
    });
  });

  describe("formatGherkin", () => {
    it("formats steps to one keyword per line", () => {
      const steps: GherkinStep[] = [
        { keyword: "Given", text: "a user is logged in" },
        { keyword: "When", text: "they click logout" },
        { keyword: "Then", text: "they are logged out" },
      ];

      const result = formatGherkin(steps);
      expect(result).toBe(
        "Given a user is logged in\nWhen they click logout\nThen they are logged out"
      );
    });

    it("formats steps with And/But", () => {
      const steps: GherkinStep[] = [
        { keyword: "Given", text: "a user" },
        { keyword: "And", text: "they have items" },
        { keyword: "When", text: "they checkout" },
        { keyword: "Then", text: "success" },
        { keyword: "And", text: "email sent" },
      ];

      const result = formatGherkin(steps);
      expect(result).toBe(
        "Given a user\nAnd they have items\nWhen they checkout\nThen success\nAnd email sent"
      );
    });

    it("handles empty steps array", () => {
      const result = formatGherkin([]);
      expect(result).toBe("");
    });
  });

  describe("validateGherkinStructure", () => {
    it("validates correct Given/When/Then sequence", () => {
      const steps: GherkinStep[] = [
        { keyword: "Given", text: "a user" },
        { keyword: "When", text: "they click" },
        { keyword: "Then", text: "result" },
      ];

      const result = validateGherkinStructure(steps);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates sequence with And/But", () => {
      const steps: GherkinStep[] = [
        { keyword: "Given", text: "a user" },
        { keyword: "And", text: "they have items" },
        { keyword: "When", text: "they checkout" },
        { keyword: "But", text: "card invalid" },
        { keyword: "Then", text: "error shown" },
        { keyword: "And", text: "cart preserved" },
      ];

      const result = validateGherkinStructure(steps);
      expect(result.valid).toBe(true);
    });

    it("rejects starting with When", () => {
      const steps: GherkinStep[] = [
        { keyword: "When", text: "they click" },
        { keyword: "Then", text: "result" },
      ];

      const result = validateGherkinStructure(steps);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Must start with 'Given', found 'When'");
    });

    it("rejects And before any primary keyword", () => {
      const steps: GherkinStep[] = [
        { keyword: "And", text: "something" },
        { keyword: "Given", text: "a user" },
        { keyword: "When", text: "they click" },
        { keyword: "Then", text: "result" },
      ];

      const result = validateGherkinStructure(steps);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("cannot appear before"))).toBe(
        true
      );
    });

    it("rejects missing When", () => {
      const steps: GherkinStep[] = [
        { keyword: "Given", text: "a user" },
        { keyword: "Then", text: "result" },
      ];

      const result = validateGherkinStructure(steps);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing 'When' keyword");
    });

    it("rejects missing Then", () => {
      const steps: GherkinStep[] = [
        { keyword: "Given", text: "a user" },
        { keyword: "When", text: "they click" },
      ];

      const result = validateGherkinStructure(steps);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing 'Then' keyword");
    });

    it("warns about multiple Given/When/Then blocks", () => {
      const steps: GherkinStep[] = [
        { keyword: "Given", text: "a user" },
        { keyword: "When", text: "they click" },
        { keyword: "Then", text: "result" },
        { keyword: "Given", text: "another scenario" },
        { keyword: "When", text: "action" },
        { keyword: "Then", text: "outcome" },
      ];

      const result = validateGherkinStructure(steps);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("Multiple Given/When/Then"))
      ).toBe(true);
    });

    it("rejects empty steps", () => {
      const result = validateGherkinStructure([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("No steps provided");
    });
  });

  describe("parseAndFormat", () => {
    it("auto-formats single-line input", () => {
      const result = parseAndFormat(
        "Given a user When they click Then result"
      );

      expect("formatted" in result).toBe(true);
      if ("formatted" in result) {
        expect(result.formatted).toBe(
          "Given a user\nWhen they click\nThen result"
        );
      }
    });

    it("normalizes already formatted input", () => {
      const input = "Given a user\nWhen they click\nThen result";
      const result = parseAndFormat(input);

      expect("formatted" in result).toBe(true);
      if ("formatted" in result) {
        expect(result.formatted).toBe(input);
      }
    });

    it("returns error for invalid structure", () => {
      const result = parseAndFormat("Given a user Then result");

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("Missing 'When'");
      }
    });

    it("returns error for empty input", () => {
      const result = parseAndFormat("");

      expect("error" in result).toBe(true);
    });

    it("handles complex input with And/But", () => {
      const result = parseAndFormat(
        "Given a user And cart has items When checkout But card fails Then show error And preserve cart"
      );

      expect("formatted" in result).toBe(true);
      if ("formatted" in result) {
        expect(result.formatted).toBe(
          "Given a user\nAnd cart has items\nWhen checkout\nBut card fails\nThen show error\nAnd preserve cart"
        );
      }
    });
  });

  describe("isValidGherkinFormat", () => {
    it("validates properly formatted gherkin", () => {
      const result = isValidGherkinFormat(
        "Given a user\nWhen they click\nThen result"
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("detects multiple keywords on one line", () => {
      const result = isValidGherkinFormat(
        "Given a user When they click\nThen result"
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("multiple keywords"))
      ).toBe(true);
    });

    it("detects line without keyword", () => {
      const result = isValidGherkinFormat(
        "Given a user\nthey also have items\nWhen they click\nThen result"
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("does not start with a keyword"))
      ).toBe(true);
    });

    it("validates structure as well as format", () => {
      // Properly formatted but wrong structure
      const result = isValidGherkinFormat("Given a user\nThen result");

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Missing 'When'"))).toBe(
        true
      );
    });

    it("handles empty lines gracefully", () => {
      const result = isValidGherkinFormat(
        "Given a user\n\nWhen they click\n\nThen result"
      );

      expect(result.valid).toBe(true);
    });
  });

  describe("round-trip consistency", () => {
    it("produces identical output after double formatting", () => {
      const input = "Given a user When they click And type Then result And done";

      const first = parseAndFormat(input);
      expect("formatted" in first).toBe(true);
      if ("formatted" in first) {
        const second = parseAndFormat(first.formatted);
        expect("formatted" in second).toBe(true);
        if ("formatted" in second) {
          expect(second.formatted).toBe(first.formatted);
        }
      }
    });
  });
});

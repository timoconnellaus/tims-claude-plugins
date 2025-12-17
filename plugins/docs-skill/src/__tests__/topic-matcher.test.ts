import { describe, it, expect } from "bun:test";
import {
  isNegationPattern,
  getActualPattern,
  matchesPattern,
  matchTopic,
  matchTopics,
  getIncludedTopics,
  getExcludedTopics,
  isValidPattern,
  groupTopicsBySource,
  getSourceFromTopic,
  formatPatterns,
  explainMatch,
} from "../lib/topic-matcher";

describe("isNegationPattern", () => {
  it("returns true for patterns starting with !", () => {
    expect(isNegationPattern("!nextjs/legacy/*")).toBe(true);
  });

  it("returns false for regular patterns", () => {
    expect(isNegationPattern("nextjs/**")).toBe(false);
  });

  it("returns false for patterns with ! elsewhere", () => {
    expect(isNegationPattern("nextjs/not!legacy")).toBe(false);
  });
});

describe("getActualPattern", () => {
  it("removes ! prefix from negation patterns", () => {
    expect(getActualPattern("!nextjs/legacy/*")).toBe("nextjs/legacy/*");
  });

  it("returns pattern unchanged if not negation", () => {
    expect(getActualPattern("nextjs/**")).toBe("nextjs/**");
  });
});

describe("matchesPattern", () => {
  describe("exact matching", () => {
    it("matches exact topic", () => {
      expect(matchesPattern("nextjs/routing", "nextjs/routing")).toBe(true);
    });

    it("does not match different topic", () => {
      expect(matchesPattern("nextjs/routing", "nextjs/api")).toBe(false);
    });

    it("matches topic that starts with pattern followed by /", () => {
      expect(matchesPattern("nextjs/routing/dynamic", "nextjs/routing")).toBe(true);
    });
  });

  describe("single wildcard (*)", () => {
    it("matches direct children", () => {
      expect(matchesPattern("nextjs/routing", "nextjs/*")).toBe(true);
    });

    it("does not match nested paths", () => {
      expect(matchesPattern("nextjs/routing/dynamic", "nextjs/*")).toBe(false);
    });

    it("matches any direct child", () => {
      expect(matchesPattern("nextjs/api", "nextjs/*")).toBe(true);
      expect(matchesPattern("nextjs/hooks", "nextjs/*")).toBe(true);
    });
  });

  describe("double wildcard (**)", () => {
    it("matches all nested paths", () => {
      expect(matchesPattern("nextjs/routing", "nextjs/**")).toBe(true);
      expect(matchesPattern("nextjs/routing/dynamic", "nextjs/**")).toBe(true);
      expect(matchesPattern("nextjs/routing/dynamic/params", "nextjs/**")).toBe(true);
    });

    it("matches direct children too", () => {
      expect(matchesPattern("nextjs/api", "nextjs/**")).toBe(true);
    });

    it("does not match different prefix", () => {
      expect(matchesPattern("react/hooks", "nextjs/**")).toBe(false);
    });
  });

  describe("complex patterns", () => {
    it("matches pattern with wildcard in middle", () => {
      expect(matchesPattern("nextjs/routing/basics", "nextjs/*/basics")).toBe(true);
    });

    it("matches pattern ending with wildcard", () => {
      expect(matchesPattern("nextjs/api/routes", "nextjs/api/*")).toBe(true);
    });
  });
});

describe("matchTopic", () => {
  it("returns included: false when no patterns match", () => {
    const result = matchTopic("react/hooks", []);
    expect(result.included).toBe(false);
    expect(result.matchedPattern).toBeUndefined();
  });

  it("returns included: true when pattern matches", () => {
    const result = matchTopic("nextjs/routing", ["nextjs/**"]);
    expect(result.included).toBe(true);
    expect(result.matchedPattern).toBe("nextjs/**");
  });

  it("returns included: false when negation pattern matches", () => {
    const result = matchTopic("nextjs/legacy/old", ["nextjs/**", "!nextjs/legacy/*"]);
    expect(result.included).toBe(false);
    expect(result.matchedPattern).toBe("!nextjs/legacy/*");
  });

  it("later patterns override earlier ones", () => {
    // First exclude all, then include specific
    const result = matchTopic("nextjs/routing", ["!nextjs/**", "nextjs/routing"]);
    expect(result.included).toBe(true);
    expect(result.matchedPattern).toBe("nextjs/routing");
  });

  it("handles multiple exclusions correctly", () => {
    const patterns = ["nextjs/**", "!nextjs/legacy/*", "!nextjs/experimental/*"];

    expect(matchTopic("nextjs/routing", patterns).included).toBe(true);
    expect(matchTopic("nextjs/legacy/old", patterns).included).toBe(false);
    expect(matchTopic("nextjs/experimental/new", patterns).included).toBe(false);
  });
});

describe("matchTopics", () => {
  it("matches multiple topics against patterns", () => {
    const topics = ["nextjs/routing", "nextjs/api", "react/hooks"];
    const patterns = ["nextjs/**"];

    const results = matchTopics(topics, patterns);

    expect(results).toHaveLength(3);
    expect(results[0].included).toBe(true);
    expect(results[1].included).toBe(true);
    expect(results[2].included).toBe(false);
  });
});

describe("getIncludedTopics", () => {
  it("returns only included topics", () => {
    const topics = ["nextjs/routing", "nextjs/api", "react/hooks"];
    const patterns = ["nextjs/**"];

    const included = getIncludedTopics(topics, patterns);

    expect(included).toEqual(["nextjs/routing", "nextjs/api"]);
  });

  it("respects exclusion patterns", () => {
    const topics = ["nextjs/routing", "nextjs/legacy/old", "nextjs/api"];
    const patterns = ["nextjs/**", "!nextjs/legacy/*"];

    const included = getIncludedTopics(topics, patterns);

    expect(included).toEqual(["nextjs/routing", "nextjs/api"]);
  });

  it("returns empty array when nothing matches", () => {
    const topics = ["react/hooks", "vue/composition"];
    const patterns = ["nextjs/**"];

    const included = getIncludedTopics(topics, patterns);

    expect(included).toEqual([]);
  });
});

describe("getExcludedTopics", () => {
  it("returns only excluded topics", () => {
    const topics = ["nextjs/routing", "react/hooks"];
    const patterns = ["nextjs/**"];

    const excluded = getExcludedTopics(topics, patterns);

    expect(excluded).toEqual(["react/hooks"]);
  });
});

describe("isValidPattern", () => {
  it("accepts valid patterns", () => {
    expect(isValidPattern("nextjs/**")).toBe(true);
    expect(isValidPattern("nextjs/*")).toBe(true);
    expect(isValidPattern("nextjs/routing")).toBe(true);
    expect(isValidPattern("tanstack-start/**")).toBe(true);
    expect(isValidPattern("!nextjs/legacy/*")).toBe(true);
  });

  it("rejects empty pattern", () => {
    expect(isValidPattern("")).toBe(false);
    expect(isValidPattern("!")).toBe(false);
  });

  it("rejects patterns with invalid characters", () => {
    expect(isValidPattern("NextJS/**")).toBe(false);
    expect(isValidPattern("next js/**")).toBe(false);
    expect(isValidPattern("nextjs@v2/**")).toBe(false);
  });

  it("rejects patterns starting or ending with /", () => {
    expect(isValidPattern("/nextjs/**")).toBe(false);
    expect(isValidPattern("nextjs/")).toBe(false);
  });

  it("rejects patterns with ***", () => {
    expect(isValidPattern("nextjs/***")).toBe(false);
  });
});

describe("groupTopicsBySource", () => {
  it("groups topics by their first segment", () => {
    const topics = [
      "nextjs/routing",
      "nextjs/api",
      "react/hooks",
      "react/state",
    ];

    const groups = groupTopicsBySource(topics);

    expect(groups.get("nextjs")).toEqual(["nextjs/routing", "nextjs/api"]);
    expect(groups.get("react")).toEqual(["react/hooks", "react/state"]);
  });

  it("handles single topic per source", () => {
    const topics = ["nextjs/routing", "react/hooks"];

    const groups = groupTopicsBySource(topics);

    expect(groups.size).toBe(2);
  });
});

describe("getSourceFromTopic", () => {
  it("extracts first segment as source", () => {
    expect(getSourceFromTopic("nextjs/routing")).toBe("nextjs");
    expect(getSourceFromTopic("nextjs/routing/dynamic")).toBe("nextjs");
    expect(getSourceFromTopic("react")).toBe("react");
  });
});

describe("formatPatterns", () => {
  it("formats empty patterns list", () => {
    const result = formatPatterns([]);
    expect(result).toBe("No patterns configured");
  });

  it("formats inclusion patterns", () => {
    const result = formatPatterns(["nextjs/**"]);
    expect(result).toContain("INCLUDE: nextjs/**");
  });

  it("formats exclusion patterns", () => {
    const result = formatPatterns(["!nextjs/legacy/*"]);
    expect(result).toContain("EXCLUDE: !nextjs/legacy/*");
  });

  it("formats mixed patterns", () => {
    const result = formatPatterns(["nextjs/**", "!nextjs/legacy/*"]);
    expect(result).toContain("INCLUDE: nextjs/**");
    expect(result).toContain("EXCLUDE: !nextjs/legacy/*");
  });
});

describe("explainMatch", () => {
  it("explains included match", () => {
    const result = explainMatch({
      topic: "nextjs/routing",
      included: true,
      matchedPattern: "nextjs/**",
    });

    expect(result).toContain("nextjs/routing");
    expect(result).toContain("included");
    expect(result).toContain("nextjs/**");
  });

  it("explains excluded match", () => {
    const result = explainMatch({
      topic: "nextjs/legacy/old",
      included: false,
      matchedPattern: "!nextjs/legacy/*",
    });

    expect(result).toContain("nextjs/legacy/old");
    expect(result).toContain("excluded");
    expect(result).toContain("!nextjs/legacy/*");
  });

  it("explains no match", () => {
    const result = explainMatch({
      topic: "react/hooks",
      included: false,
    });

    expect(result).toContain("react/hooks");
    expect(result).toContain("no matching pattern");
  });
});

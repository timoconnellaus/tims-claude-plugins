/**
 * Gherkin parser, formatter, and validator
 *
 * Enforces strict Gherkin format with one keyword per line:
 *   Given a user is logged in
 *   And they have items in cart
 *   When they click checkout
 *   Then the payment page opens
 */

export type GherkinKeyword = "Given" | "When" | "Then" | "And" | "But";

export interface GherkinStep {
  keyword: GherkinKeyword;
  text: string;
}

export interface GherkinParseSuccess {
  success: true;
  steps: GherkinStep[];
}

export interface GherkinParseError {
  success: false;
  error: string;
}

export type GherkinParseResult = GherkinParseSuccess | GherkinParseError;

export interface GherkinValidationResult {
  valid: boolean;
  errors: string[];
}

const KEYWORDS: GherkinKeyword[] = ["Given", "When", "Then", "And", "But"];
const PRIMARY_KEYWORDS: GherkinKeyword[] = ["Given", "When", "Then"];

// Match keywords at word boundaries (case-insensitive)
const KEYWORD_REGEX = /\b(Given|When|Then|And|But)\b/gi;

/**
 * Normalize keyword to canonical capitalization
 */
function normalizeKeyword(keyword: string): GherkinKeyword {
  const lower = keyword.toLowerCase();
  const map: Record<string, GherkinKeyword> = {
    given: "Given",
    when: "When",
    then: "Then",
    and: "And",
    but: "But",
  };
  return map[lower] || (keyword as GherkinKeyword);
}

/**
 * Parse freeform Gherkin text into structured steps
 */
export function parseGherkin(input: string): GherkinParseResult {
  if (!input || input.trim() === "") {
    return { success: false, error: "Gherkin text cannot be empty" };
  }

  // Check for Scenario: prefix - should not be included
  if (/^\s*Scenario:/i.test(input)) {
    return {
      success: false,
      error:
        "Don't include 'Scenario:' prefix. Put the scenario name in the 'scenarios[].name' field instead.",
    };
  }

  // Convert literal \n sequences to actual newlines (from AI-generated text)
  const unescaped = input.replace(/\\n/g, "\n");
  // Normalize whitespace (collapse multiple spaces/newlines)
  const normalized = unescaped.replace(/\s+/g, " ").trim();

  // Find all keyword positions
  const matches: { keyword: string; index: number }[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  KEYWORD_REGEX.lastIndex = 0;

  while ((match = KEYWORD_REGEX.exec(normalized)) !== null) {
    matches.push({ keyword: match[1], index: match.index });
  }

  if (matches.length === 0) {
    return {
      success: false,
      error: "No Gherkin keywords found. Must include Given, When, and Then.",
    };
  }

  // Extract steps from keyword positions
  const steps: GherkinStep[] = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    // Text starts after the keyword
    const textStart = current.index + current.keyword.length;
    const textEnd = next ? next.index : normalized.length;
    const text = normalized.slice(textStart, textEnd).trim();

    if (!text) {
      return {
        success: false,
        error: `Empty step text after '${current.keyword}'`,
      };
    }

    steps.push({
      keyword: normalizeKeyword(current.keyword),
      text,
    });
  }

  return { success: true, steps };
}

/**
 * Format parsed steps to canonical one-keyword-per-line style
 */
export function formatGherkin(steps: GherkinStep[]): string {
  return steps.map((step) => `${step.keyword} ${step.text}`).join("\n");
}

/**
 * Validate Gherkin structure (keyword ordering)
 *
 * Rules:
 * 1. Must start with Given
 * 2. And/But cannot appear before any primary keyword
 * 3. Must have When after Given section
 * 4. Must have Then after When section
 * 5. Detect multiple Given/When/Then blocks (warning)
 */
export function validateGherkinStructure(
  steps: GherkinStep[]
): GherkinValidationResult {
  const errors: string[] = [];

  if (steps.length === 0) {
    return { valid: false, errors: ["No steps provided"] };
  }

  // Rule 1: Must start with Given
  if (steps[0].keyword !== "Given") {
    errors.push(`Must start with 'Given', found '${steps[0].keyword}'`);
  }

  // Track which primary keywords we've seen
  let hasGiven = false;
  let hasWhen = false;
  let hasThen = false;
  let givenCount = 0;
  let whenCount = 0;
  let thenCount = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const keyword = step.keyword;

    // Rule 2: And/But cannot appear before any primary keyword
    if ((keyword === "And" || keyword === "But") && !hasGiven) {
      errors.push(
        `'${keyword}' cannot appear before any Given/When/Then (step ${i + 1})`
      );
    }

    // Track primary keywords and count them
    if (keyword === "Given") {
      hasGiven = true;
      givenCount++;
    } else if (keyword === "When") {
      // Rule 3: When must come after Given
      if (!hasGiven) {
        errors.push(`'When' must come after 'Given' (step ${i + 1})`);
      }
      hasWhen = true;
      whenCount++;
    } else if (keyword === "Then") {
      // Rule 4: Then must come after When
      if (!hasWhen) {
        errors.push(`'Then' must come after 'When' (step ${i + 1})`);
      }
      hasThen = true;
      thenCount++;
    }
  }

  // Must have all three primary keywords
  if (!hasGiven) {
    errors.push("Missing 'Given' keyword");
  }
  if (!hasWhen) {
    errors.push("Missing 'When' keyword");
  }
  if (!hasThen) {
    errors.push("Missing 'Then' keyword");
  }

  // Rule 5: Warn about multiple Given/When/Then (might be multiple scenarios)
  if (givenCount > 1 || whenCount > 1 || thenCount > 1) {
    errors.push(
      "Multiple Given/When/Then blocks detected. Each gherkin field should contain ONE scenario. " +
        "For multiple scenarios, use the 'scenarios' array field with separate {name, gherkin} objects."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse and format Gherkin text in one step
 * Returns formatted string on success, error message on failure
 */
export function parseAndFormat(
  input: string
): { formatted: string } | { error: string } {
  const parseResult = parseGherkin(input);

  if (!parseResult.success) {
    return { error: parseResult.error };
  }

  const validation = validateGherkinStructure(parseResult.steps);

  if (!validation.valid) {
    return { error: validation.errors.join("; ") };
  }

  return { formatted: formatGherkin(parseResult.steps) };
}

/**
 * Validate already-stored Gherkin text
 * Used by check command to validate existing requirements
 */
export function isValidGherkinFormat(gherkin: string): GherkinValidationResult {
  const parseResult = parseGherkin(gherkin);

  if (!parseResult.success) {
    return { valid: false, errors: [parseResult.error] };
  }

  const structureValidation = validateGherkinStructure(parseResult.steps);

  // Also check formatting (one keyword per line)
  const formattingErrors: string[] = [];
  const lines = gherkin.trim().split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Each line should start with exactly one keyword
    const lineKeywords = line.match(KEYWORD_REGEX);
    if (!lineKeywords) {
      formattingErrors.push(`Line ${i + 1} does not start with a keyword`);
    } else if (lineKeywords.length > 1) {
      formattingErrors.push(
        `Line ${i + 1} has multiple keywords (should be one per line)`
      );
    }
  }

  const allErrors = [...structureValidation.errors, ...formattingErrors];

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

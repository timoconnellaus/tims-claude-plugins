/**
 * validate command - Validate documentation files
 */

import type { ValidateArgs } from "../lib/types";
import {
  validateSource,
  validateAllSources,
  formatValidationResult,
} from "../lib/validator";
import { listDocSources } from "../lib/store";

export async function validate(args: ValidateArgs): Promise<void> {
  const { source } = args;

  if (source) {
    // Validate specific source
    const sources = await listDocSources();
    if (!sources.includes(source)) {
      console.error(`Unknown source: ${source}`);
      console.error(`Available sources: ${sources.join(", ") || "none"}`);
      process.exit(1);
    }

    console.log(`Validating ${source}...`);
    const result = await validateSource(source);
    console.log(formatValidationResult(result));

    if (!result.valid) {
      process.exit(1);
    }
  } else {
    // Validate all sources
    const sources = await listDocSources();

    if (sources.length === 0) {
      console.log("No documentation sources found.");
      console.log("Create a folder in docs/ with a sync-docs.ts file to get started.");
      return;
    }

    console.log(`Validating ${sources.length} source(s)...\n`);
    const results = await validateAllSources();

    let hasErrors = false;
    for (const result of results) {
      console.log(formatValidationResult(result));
      console.log();
      if (!result.valid) {
        hasErrors = true;
      }
    }

    // Summary
    const validCount = results.filter((r) => r.valid).length;
    const totalDocs = results.reduce((sum, r) => sum + r.docCount, 0);
    const totalTopics = results.reduce((sum, r) => sum + r.topicCount, 0);

    console.log("Summary:");
    console.log(`  Sources: ${validCount}/${results.length} valid`);
    console.log(`  Documents: ${totalDocs}`);
    console.log(`  Topics: ${totalTopics}`);

    if (hasErrors) {
      process.exit(1);
    }
  }
}

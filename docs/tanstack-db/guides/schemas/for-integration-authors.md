---
topic: tanstack-db/guides/schemas/for-integration-authors
title: Schema Validation and Type Transformations - For Integration Authors
description: For Integration Authors section of Schema Validation and Type Transformations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/schemas.md
tags:
  - tanstack-db
  - guides
---

# For Integration Authors

If you're building a custom collection (like Electric or TrailBase), you'll need to handle data parsing and serialization between your storage format and the in-memory collection format. This is separate from schema validation, which happens during client mutations.

See the [Collection Options Creator Guide](./collection-options-creator.md) for comprehensive documentation on creating custom collection integrations, including how to handle schemas, data parsing, and type transformations.

---
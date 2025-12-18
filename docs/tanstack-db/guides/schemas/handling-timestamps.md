---
topic: tanstack-db/guides/schemas/handling-timestamps
title: Schema Validation and Type Transformations - Handling Timestamps
description: Handling Timestamps section of Schema Validation and Type Transformations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/schemas.md
tags:
  - tanstack-db
  - guides
---

# Handling Timestamps

When working with timestamps, you typically want automatic creation dates rather than transforming user input.

### Use Defaults for Timestamps

For `created_at` and `updated_at` fields, use defaults to automatically generate timestamps:

```typescript
const todoSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean().default(false),
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date())
})

// Timestamps generated automatically
collection.insert({
  id: "1",
  text: "Buy groceries"
  // created_at and updated_at filled automatically
})

// Update timestamps
collection.update("1", (draft) => {
  draft.text = "Buy groceries and milk"
  draft.updated_at = new Date()
})
```

### Accepting Date Input from External Sources

If you're accepting date input from external sources (forms, APIs), you must use union types to accept both strings and Date objects. This ensures TInput is a superset of TOutput:

```typescript
const eventSchema = z.object({
  id: z.string(),
  name: z.string(),
  scheduled_for: z.union([
    z.string(),  // Accept ISO string from form input (part of TInput)
    z.date()     // Accept Date from existing data (TOutput) or programmatic input
  ]).transform(val =>
    typeof val === 'string' ? new Date(val) : val
  )
})
// TInput:  { scheduled_for: string | Date }
// TOutput: { scheduled_for: Date }
// ✅ TInput is a superset of TOutput (accepts both string and Date)

// Works with string input (new data)
collection.insert({
  id: "1",
  name: "Meeting",
  scheduled_for: "2024-12-31T15:00:00Z"  // From form input
})

// Works with Date input (programmatic)
collection.insert({
  id: "2",
  name: "Workshop",
  scheduled_for: new Date()
})

// Updates work - scheduled_for is already a Date, and TInput accepts Date
collection.update("1", (draft) => {
  draft.name = "Updated Meeting"
  // draft.scheduled_for is a Date and can be used or modified
})
```

---
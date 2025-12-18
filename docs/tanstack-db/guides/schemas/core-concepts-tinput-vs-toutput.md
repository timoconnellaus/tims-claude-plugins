---
topic: tanstack-db/guides/schemas/core-concepts-tinput-vs-toutput
title: "Schema Validation and Type Transformations - Core Concepts: TInput vs TOutput"
description: "Core Concepts: TInput vs TOutput section of Schema Validation and
  Type Transformations"
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/schemas.md
tags:
  - tanstack-db
  - guides
---

# Core Concepts: TInput vs TOutput

Understanding TInput and TOutput is key to working effectively with schemas in TanStack DB.

> **Important:** Schemas validate **client changes only** - data you insert or update via `collection.insert()` and `collection.update()`. They do not automatically validate data loaded from your server or sync layer. If you need to validate server data, you must do so explicitly in your integration layer.

### What are TInput and TOutput?

When you define a schema with transformations, it has two types:

- **TInput**: The type users provide when calling `insert()` or `update()`
- **TOutput**: The type stored in the collection and returned from queries

```typescript
const todoSchema = z.object({
  id: z.string(),
  text: z.string(),
  created_at: z.string().transform(val => new Date(val))
})

// TInput type:  { id: string, text: string, created_at: string }
// TOutput type: { id: string, text: string, created_at: Date }
```

The schema acts as a **boundary** that transforms TInput → TOutput.

### Critical Design Principle: TInput Must Be a Superset of TOutput

When using transformations, **TInput must accept all values that TOutput contains**. This is essential for updates to work correctly.

Here's why: when you call `collection.update(id, (draft) => {...})`, the `draft` parameter is typed as `TInput` but contains data that's already been transformed to `TOutput`. For this to work without complex type gymnastics, your schema must accept both the input format AND the output format.

```typescript
// ❌ BAD: TInput only accepts strings
const schema = z.object({
  created_at: z.string().transform(val => new Date(val))
})
// TInput:  { created_at: string }
// TOutput: { created_at: Date }
// Problem: draft.created_at is a Date, but TInput only accepts string!

// ✅ GOOD: TInput accepts both string and Date (superset of TOutput)
const schema = z.object({
  created_at: z.union([z.string(), z.date()])
    .transform(val => typeof val === 'string' ? new Date(val) : val)
})
// TInput:  { created_at: string | Date }
// TOutput: { created_at: Date }
// Success: draft.created_at can be a Date because TInput accepts Date!
```

**Rule of thumb:** If your schema transforms type A to type B, use `z.union([A, B])` to ensure TInput accepts both.

### Why This Matters

**All data in your collection is TOutput:**
- Data stored in the collection
- Data returned from queries
- Data in `PendingMutation.modified`
- Data in mutation handlers

```typescript
const collection = createCollection({
  schema: todoSchema,
  onInsert: async ({ transaction }) => {
    const item = transaction.mutations[0].modified

    // item is TOutput
    console.log(item.created_at instanceof Date)  // true

    // If your API needs a string, serialize it
    await api.todos.create({
      ...item,
      created_at: item.created_at.toISOString()  // Date → string
    })
  }
})

// User provides TInput
collection.insert({
  id: "1",
  text: "Task",
  created_at: "2024-01-01T00:00:00Z"  // string
})

// Collection stores and returns TOutput
const todo = collection.get("1")
console.log(todo.created_at.getFullYear())  // It's a Date!
```

---
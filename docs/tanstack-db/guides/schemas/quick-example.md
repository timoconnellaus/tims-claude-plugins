---
topic: tanstack-db/guides/schemas/quick-example
title: Schema Validation and Type Transformations - Quick Example
description: Quick Example section of Schema Validation and Type Transformations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/schemas.md
tags:
  - tanstack-db
  - guides
---

# Quick Example

Schemas catch invalid data from optimistic mutations before it enters your collection:

```typescript
import { z } from 'zod'
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

const todoSchema = z.object({
  id: z.string(),
  text: z.string().min(1, "Text is required"),
  completed: z.boolean(),
  priority: z.number().min(0).max(5)
})

const collection = createCollection(
  queryCollectionOptions({
    schema: todoSchema,
    queryKey: ['todos'],
    queryFn: async () => api.todos.getAll(),
    getKey: (item) => item.id,
    // ...
  })
)

// Invalid data throws SchemaValidationError
collection.insert({
  id: "1",
  text: "",  // ❌ Too short
  completed: "yes",  // ❌ Wrong type
  priority: 10  // ❌ Out of range
})
// Error: Validation failed with 3 issues

// Valid data works
collection.insert({
  id: "1",
  text: "Buy groceries",  // ✅
  completed: false,  // ✅
  priority: 2  // ✅
})
```

Schemas also enable advanced features like type transformations and defaults:

```typescript
const todoSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  completed: z.boolean().default(false),  // Auto-fill missing values
  created_at: z.string().transform(val => new Date(val))  // Convert types
})

collection.insert({
  id: "1",
  text: "Buy groceries",
  created_at: "2024-01-01T00:00:00Z"  // String in
  // completed auto-filled with false
})

const todo = collection.get("1")
console.log(todo.created_at.getFullYear())  // Date object out!
```
---
topic: tanstack-db/guides/schemas/default-values
title: Schema Validation and Type Transformations - Default Values
description: Default Values section of Schema Validation and Type Transformations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/schemas.md
tags:
  - tanstack-db
  - guides
---

# Default Values

Schemas can automatically provide default values for missing fields.

### Literal Defaults

```typescript
const todoSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean().default(false),
  priority: z.number().default(0),
  tags: z.array(z.string()).default([])
})

collection.insert({
  id: "1",
  text: "Buy groceries"
  // completed, priority, and tags filled automatically
})

const todo = collection.get("1")
console.log(todo.completed)  // false
console.log(todo.priority)   // 0
console.log(todo.tags)       // []
```

### Function Defaults

Generate defaults dynamically:

```typescript
const postSchema = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.date().default(() => new Date()),
  view_count: z.number().default(0),
  slug: z.string().default(() => crypto.randomUUID())
})

collection.insert({
  id: "1",
  title: "My First Post"
  // created_at, view_count, and slug generated automatically
})
```

### Conditional Defaults

```typescript
const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.enum(['user', 'admin']).default('user'),
  permissions: z.array(z.string()).default(['read'])
})
```

### Complex Defaults

```typescript
const eventSchema = z.object({
  id: z.string(),
  name: z.string(),
  metadata: z.record(z.unknown()).default(() => ({
    created_by: 'system',
    version: 1
  }))
})
```

### Combining Defaults with Transformations

```typescript
const todoSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean().default(false),
  created_at: z.string()
    .default(() => new Date().toISOString())
    .transform(val => new Date(val))
})

collection.insert({
  id: "1",
  text: "Task"
  // completed defaults to false
  // created_at defaults to current time, then transforms to Date
})
```

---
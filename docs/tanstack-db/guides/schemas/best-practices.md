---
topic: tanstack-db/guides/schemas/best-practices
title: Schema Validation and Type Transformations - Best Practices
description: Best Practices section of Schema Validation and Type Transformations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/schemas.md
tags:
  - tanstack-db
  - guides
---

# Best Practices

### Keep Transformations Simple

> **Performance Note:** Schema validation is synchronous and runs on every optimistic mutation. For high-frequency updates, keep transformations simple.

```typescript
// ❌ Avoid expensive operations
const schema = z.object({
  data: z.string().transform(val => {
    // Heavy computation on every mutation
    return expensiveParsingOperation(val)
  })
})

// ✅ Better: Validate only, process elsewhere
const schema = z.object({
  data: z.string()  // Simple validation
})

// Process in component or mutation handler when needed
const processedData = expensiveParsingOperation(todo.data)
```

### Use Union Types for Transformations (Essential)

When your schema transforms data to a different type, you **must** use union types to ensure TInput is a superset of TOutput. This is not optional - updates will fail without it.

```typescript
// ✅ REQUIRED: TInput accepts both string (new data) and Date (existing data)
const schema = z.object({
  created_at: z.union([z.string(), z.date()])
    .transform(val => typeof val === 'string' ? new Date(val) : val)
})
// TInput: { created_at: string | Date }
// TOutput: { created_at: Date }

// ❌ WILL BREAK: Updates fail because draft contains Date but TInput only accepts string
const schema = z.object({
  created_at: z.string().transform(val => new Date(val))
})
// TInput: { created_at: string }
// TOutput: { created_at: Date }
// Problem: collection.update() passes a Date to a schema expecting string!
```

**Why this is required:** During `collection.update()`, the `draft` object contains TOutput data (already transformed). The schema must accept this data, which means TInput must be a superset of TOutput.

### Validate at the Boundary

Let the collection schema handle validation. Don't duplicate validation logic:

```typescript
// ❌ Avoid: Duplicate validation
function addTodo(text: string) {
  if (!text || text.length < 3) {
    throw new Error("Text too short")
  }
  todoCollection.insert({ id: "1", text })
}

// ✅ Better: Let schema handle it
const todoSchema = z.object({
  id: z.string(),
  text: z.string().min(3, "Text must be at least 3 characters")
})
```

### Type Inference

Let TypeScript infer types from your schema:

```typescript
const todoSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean()
})

type Todo = z.infer<typeof todoSchema>  // Inferred type

// ✅ Use the inferred type
const collection = createCollection(
  queryCollectionOptions({
    schema: todoSchema,
    // TypeScript knows the item type automatically
    getKey: (item) => item.id  // item is Todo
  })
)
```

### Custom Error Messages

Provide helpful error messages for users:

```typescript
const userSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username is too long (max 20 characters)")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Please enter a valid email address"),
  age: z.number()
    .int("Age must be a whole number")
    .min(13, "You must be at least 13 years old")
})
```

---
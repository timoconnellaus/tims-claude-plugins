---
topic: tanstack-db/guides/schemas/validation-patterns
title: Schema Validation and Type Transformations - Validation Patterns
description: Validation Patterns section of Schema Validation and Type Transformations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/schemas.md
tags:
  - tanstack-db
  - guides
---

# Validation Patterns

Schemas provide powerful validation to ensure data quality.

### Basic Type Validation

```typescript
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
  active: z.boolean()
})

collection.insert({
  id: "1",
  name: "Alice",
  age: "25",  // ❌ Wrong type - expects number
  email: "not-an-email",  // ❌ Invalid email format
  active: true
})
// Throws SchemaValidationError
```

### String Constraints

```typescript
const productSchema = z.object({
  id: z.string(),
  name: z.string().min(3, "Name must be at least 3 characters"),
  sku: z.string().length(8, "SKU must be exactly 8 characters"),
  description: z.string().max(500, "Description too long"),
  url: z.string().url("Must be a valid URL")
})
```

### Number Constraints

```typescript
const orderSchema = z.object({
  id: z.string(),
  quantity: z.number()
    .int("Must be a whole number")
    .positive("Must be greater than 0"),
  price: z.number()
    .min(0.01, "Price must be at least $0.01")
    .max(999999.99, "Price too high"),
  discount: z.number()
    .min(0)
    .max(100)
})
```

### Enum Validation

```typescript
const taskSchema = z.object({
  id: z.string(),
  status: z.enum(['todo', 'in-progress', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent'])
})

collection.insert({
  id: "1",
  status: "completed",  // ❌ Not in enum
  priority: "medium"  // ✅
})
```

### Optional and Nullable Fields

```typescript
const personSchema = z.object({
  id: z.string(),
  name: z.string(),
  nickname: z.string().optional(),  // Can be omitted
  middleName: z.string().nullable(),  // Can be null
  bio: z.string().optional().nullable()  // Can be omitted OR null
})

// All valid:
collection.insert({ id: "1", name: "Alice" })  // nickname omitted
collection.insert({ id: "2", name: "Bob", middleName: null })
collection.insert({ id: "3", name: "Carol", bio: null })
```

### Array Validation

```typescript
const postSchema = z.object({
  id: z.string(),
  title: z.string(),
  tags: z.array(z.string()).min(1, "At least one tag required"),
  likes: z.array(z.number()).max(1000)
})

collection.insert({
  id: "1",
  title: "My Post",
  tags: [],  // ❌ Need at least one
  likes: [1, 2, 3]
})
```

### Custom Validation

```typescript
const userSchema = z.object({
  id: z.string(),
  username: z.string()
    .min(3)
    .refine(
      (val) => /^[a-zA-Z0-9_]+$/.test(val),
      "Username can only contain letters, numbers, and underscores"
    ),
  password: z.string()
    .min(8)
    .refine(
      (val) => /[A-Z]/.test(val) && /[0-9]/.test(val),
      "Password must contain at least one uppercase letter and one number"
    )
})
```

### Cross-Field Validation

```typescript
const dateRangeSchema = z.object({
  id: z.string(),
  start_date: z.string(),
  end_date: z.string()
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  "End date must be after start date"
)
```

---
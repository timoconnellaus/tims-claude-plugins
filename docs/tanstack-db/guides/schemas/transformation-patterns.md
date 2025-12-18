---
topic: tanstack-db/guides/schemas/transformation-patterns
title: Schema Validation and Type Transformations - Transformation Patterns
description: Transformation Patterns section of Schema Validation and Type Transformations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/schemas.md
tags:
  - tanstack-db
  - guides
---

# Transformation Patterns

Schemas can transform data as it enters your collection.

### String to Date

The most common transformation - convert ISO strings to Date objects:

```typescript
const eventSchema = z.object({
  id: z.string(),
  name: z.string(),
  start_time: z.string().transform(val => new Date(val))
})

collection.insert({
  id: "1",
  name: "Conference",
  start_time: "2024-06-15T10:00:00Z"  // TInput: string
})

const event = collection.get("1")
console.log(event.start_time.getFullYear())  // TOutput: Date
```

### String to Number

```typescript
const formSchema = z.object({
  id: z.string(),
  quantity: z.string().transform(val => parseInt(val, 10)),
  price: z.string().transform(val => parseFloat(val))
})

collection.insert({
  id: "1",
  quantity: "42",  // String from form input
  price: "19.99"
})

const item = collection.get("1")
console.log(typeof item.quantity)  // "number"
```

### JSON String to Object

```typescript
const configSchema = z.object({
  id: z.string(),
  settings: z.string().transform(val => JSON.parse(val))
})

collection.insert({
  id: "1",
  settings: '{"theme":"dark","notifications":true}'  // JSON string
})

const config = collection.get("1")
console.log(config.settings.theme)  // "dark" (parsed object)
```

### Computed Fields

```typescript
const userSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string()
}).transform(data => ({
  ...data,
  full_name: `${data.first_name} ${data.last_name}`  // Computed
}))

collection.insert({
  id: "1",
  first_name: "John",
  last_name: "Doe"
})

const user = collection.get("1")
console.log(user.full_name)  // "John Doe"
```

### String to Enum

```typescript
const orderSchema = z.object({
  id: z.string(),
  status: z.string().transform(val =>
    val.toUpperCase() as 'PENDING' | 'SHIPPED' | 'DELIVERED'
  )
})
```

### Sanitization

```typescript
const commentSchema = z.object({
  id: z.string(),
  text: z.string().transform(val => val.trim()),  // Remove whitespace
  username: z.string().transform(val => val.toLowerCase())  // Normalize
})
```

### Complex Transformations

```typescript
const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  price_cents: z.number()
}).transform(data => ({
  ...data,
  price_dollars: data.price_cents / 100,  // Add computed field
  display_price: `$${(data.price_cents / 100).toFixed(2)}`  // Formatted
}))
```

---
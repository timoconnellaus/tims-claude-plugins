---
topic: tanstack-db/guides/mutations/operation-handlers
title: TanStack DB Mutations - Operation Handlers
description: Operation Handlers section of TanStack DB Mutations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/mutations.md
tags:
  - tanstack-db
  - guides
---

# Operation Handlers

Operation handlers are functions you provide when creating a collection that handle persisting mutations to your backend. Each collection can define three optional handlers: `onInsert`, `onUpdate`, and `onDelete`.

### Handler Signature

All operation handlers receive an object with the following properties:

```typescript
type OperationHandler = (params: {
  transaction: Transaction
  collection: Collection
}) => Promise<any> | any
```

The `transaction` object contains:
- `mutations`: Array of mutation objects, each with:
  - `collection`: The collection being mutated
  - `type`: The mutation type (`'insert'`, `'update'`, or `'delete'`)
  - `original`: The original item (for updates and deletes)
  - `modified`: The modified item (for inserts and updates)
  - `changes`: The changes object (for updates)
  - `key`: The item key
  - `metadata`: Optional metadata attached to the mutation

### Defining Operation Handlers

Define handlers when creating a collection:

```typescript
const todoCollection = createCollection({
  id: "todos",
  // ... other options

  onInsert: async ({ transaction }) => {
    await Promise.all(
      transaction.mutations.map((mutation) =>
        api.todos.create(mutation.modified)
      )
    )
  },

  onUpdate: async ({ transaction }) => {
    await Promise.all(
      transaction.mutations.map((mutation) =>
        api.todos.update(mutation.original.id, mutation.changes)
      )
    )
  },

  onDelete: async ({ transaction }) => {
    await Promise.all(
      transaction.mutations.map((mutation) =>
        api.todos.delete(mutation.original.id)
      )
    )
  },
})
```

> [!IMPORTANT]
> Operation handlers must not resolve until the server changes have synced back to the collection. Different collection types provide different patterns to ensure this happens correctly.

### Collection-Specific Handler Patterns

Different collection types have specific patterns for their handlers:

**QueryCollection** - automatically refetches after handler completes:
```typescript
onUpdate: async ({ transaction }) => {
  await Promise.all(
    transaction.mutations.map((mutation) =>
      api.todos.update(mutation.original.id, mutation.changes)
    )
  )
  // Automatic refetch happens after handler completes
}
```

**ElectricCollection** - return txid(s) to track sync:
```typescript
onUpdate: async ({ transaction }) => {
  const txids = await Promise.all(
    transaction.mutations.map(async (mutation) => {
      const response = await api.todos.update(mutation.original.id, mutation.changes)
      return response.txid
    })
  )
  return { txid: txids }
}
```

### Generic Mutation Functions

You can define a single mutation function for your entire app:

```typescript
import type { MutationFn } from "@tanstack/react-db"

const mutationFn: MutationFn = async ({ transaction }) => {
  const response = await api.mutations.batch(transaction.mutations)

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`)
  }
}

// Use in collections
const todoCollection = createCollection({
  id: "todos",
  onInsert: mutationFn,
  onUpdate: mutationFn,
  onDelete: mutationFn,
})
```

### Schema Validation in Mutation Handlers

When a schema is configured for a collection, TanStack DB automatically validates and transforms data during mutations. The mutation handlers receive the **transformed data** (TOutput), not the raw input.

```typescript
const todoSchema = z.object({
  id: z.string(),
  text: z.string(),
  created_at: z.string().transform(val => new Date(val))  // TInput: string, TOutput: Date
})

const collection = createCollection({
  schema: todoSchema,
  onInsert: async ({ transaction }) => {
    const item = transaction.mutations[0].modified

    // item.created_at is already a Date object (TOutput)
    console.log(item.created_at instanceof Date)  // true

    // If your API needs a string, serialize it
    await api.todos.create({
      ...item,
      created_at: item.created_at.toISOString()  // Date → string
    })
  }
})

// User provides string (TInput)
collection.insert({
  id: "1",
  text: "Task",
  created_at: "2024-01-01T00:00:00Z"
})
```

**Key points:**
- Schema validation happens **before** mutation handlers are called
- Handlers receive **TOutput** (transformed data)
- If your backend needs a different format, serialize in the handler
- Schema validation errors throw `SchemaValidationError` before handlers run

For comprehensive documentation on schema validation and transformations, see the [Schemas guide](./schemas.md).
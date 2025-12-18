---
topic: tanstack-db/guides/mutations/collection-write-operations
title: TanStack DB Mutations - Collection Write Operations
description: Collection Write Operations section of TanStack DB Mutations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/mutations.md
tags:
  - tanstack-db
  - guides
---

# Collection Write Operations

Collections support three core write operations: `insert`, `update`, and `delete`. Each operation applies optimistic state immediately and triggers the corresponding operation handler.

### Insert

Add new items to a collection:

```typescript
// Insert a single item
todoCollection.insert({
  id: "1",
  text: "Buy groceries",
  completed: false
})

// Insert multiple items
todoCollection.insert([
  { id: "1", text: "Buy groceries", completed: false },
  { id: "2", text: "Walk dog", completed: false },
])

// Insert with metadata
todoCollection.insert(
  { id: "1", text: "Custom item", completed: false },
  { metadata: { source: "import" } }
)

// Insert without optimistic updates
todoCollection.insert(
  { id: "1", text: "Server-validated item", completed: false },
  { optimistic: false }
)
```

**Returns**: A `Transaction` object that you can use to track the mutation's lifecycle.

### Update

Modify existing items using an immutable draft pattern:

```typescript
// Update a single item
todoCollection.update(todo.id, (draft) => {
  draft.completed = true
})

// Update multiple items
todoCollection.update([todo1.id, todo2.id], (drafts) => {
  drafts.forEach((draft) => {
    draft.completed = true
  })
})

// Update with metadata
todoCollection.update(
  todo.id,
  { metadata: { reason: "user update" } },
  (draft) => {
    draft.text = "Updated text"
  }
)

// Update without optimistic updates
todoCollection.update(
  todo.id,
  { optimistic: false },
  (draft) => {
    draft.status = "server-validated"
  }
)
```

**Parameters**:
- `key` or `keys`: The item key(s) to update
- `options` (optional): Configuration object with `metadata` and/or `optimistic` flags
- `updater`: Function that receives a draft to mutate

**Returns**: A `Transaction` object that you can use to track the mutation's lifecycle.

> [!IMPORTANT]
> The `updater` function uses an Immer-like pattern to capture changes as immutable updates. You must not reassign the draft parameter itself—only mutate its properties.

### Delete

Remove items from a collection:

```typescript
// Delete a single item
todoCollection.delete(todo.id)

// Delete multiple items
todoCollection.delete([todo1.id, todo2.id])

// Delete with metadata
todoCollection.delete(todo.id, {
  metadata: { reason: "completed" }
})

// Delete without optimistic updates
todoCollection.delete(todo.id, { optimistic: false })
```

**Parameters**:
- `key` or `keys`: The item key(s) to delete
- `options` (optional): Configuration object with `metadata` and/or `optimistic` flags

**Returns**: A `Transaction` object that you can use to track the mutation's lifecycle.
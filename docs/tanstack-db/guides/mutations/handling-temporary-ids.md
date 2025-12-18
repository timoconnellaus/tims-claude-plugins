---
topic: tanstack-db/guides/mutations/handling-temporary-ids
title: TanStack DB Mutations - Handling Temporary IDs
description: Handling Temporary IDs section of TanStack DB Mutations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/mutations.md
tags:
  - tanstack-db
  - guides
---

# Handling Temporary IDs

When inserting new items into collections where the server generates the final ID, you'll need to handle the transition from temporary to real IDs carefully to avoid UI issues and operation failures.

### The Problem

When you insert an item with a temporary ID, the optimistic object is eventually replaced by the synced object with its real server-generated ID. This can cause two issues:

1. **UI Flicker**: Your UI framework may unmount and remount components when the key changes from temporary to real ID
2. **Subsequent Operations**: Operations like delete may fail if they try to use the temporary ID before the real ID syncs back

```tsx
// Generate temporary ID (e.g., negative number)
const tempId = -(Math.floor(Math.random() * 1000000) + 1)

// Insert with temporary ID
todoCollection.insert({
  id: tempId,
  text: "New todo",
  completed: false
})

// Problem 1: UI may re-render when tempId is replaced with real ID
// Problem 2: Trying to delete before sync completes will use tempId
todoCollection.delete(tempId) // May 404 on backend
```

### Solution 1: Use Client-Generated UUIDs

If your backend supports client-generated IDs, use UUIDs to eliminate the temporary ID problem entirely:

```tsx
// Generate UUID on client
const id = crypto.randomUUID()

todoCollection.insert({
  id,
  text: "New todo",
  completed: false
})

// No flicker - the ID is stable
// Subsequent operations work immediately
todoCollection.delete(id) // Works with the same ID
```

This is the cleanest approach when your backend supports it, as the ID never changes.

### Solution 2: Wait for Persistence or Use Non-Optimistic Inserts

Wait for the mutation to persist before allowing subsequent operations, or use non-optimistic inserts to avoid showing the item until the real ID is available:

```tsx
const handleCreateTodo = async (text: string) => {
  const tempId = -Math.floor(Math.random() * 1000000) + 1

  const tx = todoCollection.insert({
    id: tempId,
    text,
    completed: false
  })

  // Wait for persistence to complete
  await tx.isPersisted.promise

  // Now we have the real ID from the server
  // Subsequent operations will use the real ID
}

// Disable delete buttons until persisted
const TodoItem = ({ todo, isPersisted }: { todo: Todo, isPersisted: boolean }) => {
  return (
    <div>
      {todo.text}
      <button
        onClick={() => todoCollection.delete(todo.id)}
        disabled={!isPersisted}
      >
        Delete
      </button>
    </div>
  )
}
```

### Solution 3: Maintain a View Key Mapping

To avoid UI flicker while keeping optimistic updates, maintain a separate mapping from IDs (both temporary and real) to stable view keys:

```tsx
// Create a mapping API
const idToViewKey = new Map<number | string, string>()

function getViewKey(id: number | string): string {
  if (!idToViewKey.has(id)) {
    idToViewKey.set(id, crypto.randomUUID())
  }
  return idToViewKey.get(id)!
}

function linkIds(tempId: number, realId: number) {
  const viewKey = getViewKey(tempId)
  idToViewKey.set(realId, viewKey)
}

// Configure collection to link IDs when real ID comes back
const todoCollection = createCollection({
  id: "todos",
  // ... other options
  onInsert: async ({ transaction }) => {
    const mutation = transaction.mutations[0]
    const tempId = mutation.modified.id

    // Create todo on server and get real ID back
    const response = await api.todos.create({
      text: mutation.modified.text,
      completed: mutation.modified.completed,
    })
    const realId = response.id

    // Link temp ID to same view key as real ID
    linkIds(tempId, realId)

    // Wait for sync back
    await todoCollection.utils.refetch()
  },
})

// When inserting with temp ID
const tempId = -Math.floor(Math.random() * 1000000) + 1
const viewKey = getViewKey(tempId) // Creates and stores mapping

todoCollection.insert({
  id: tempId,
  text: "New todo",
  completed: false
})

// Use view key for rendering
const TodoList = () => {
  const { data: todos } = useLiveQuery((q) =>
    q.from({ todo: todoCollection })
  )

  return (
    <ul>
      {todos.map((todo) => (
        <li key={getViewKey(todo.id)}> {/* Stable key */}
          {todo.text}
        </li>
      ))}
    </ul>
  )
}
```

This pattern maintains a stable key throughout the temporary → real ID transition, preventing your UI framework from unmounting and remounting the component. The view key is stored outside the collection items, so you don't need to add extra fields to your data model.

### Best Practices

1. **Use UUIDs when possible**: Client-generated UUIDs eliminate the temporary ID problem
2. **Generate temporary IDs deterministically**: Use negative numbers or a specific pattern to distinguish temporary IDs from real ones
3. **Disable operations on temporary items**: Disable delete/update buttons until persistence completes
4. **Maintain view key mappings**: Create a mapping between IDs and stable view keys for rendering

> [!NOTE]
> There's an [open issue](https://github.com/TanStack/db/issues/19) to add better built-in support for temporary ID handling in TanStack DB. This would automate the view key pattern and make it easier to work with server-generated IDs.
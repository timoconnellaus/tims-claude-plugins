---
topic: tanstack-db/guides/mutations/mutation-approaches
title: TanStack DB Mutations - Mutation Approaches
description: Mutation Approaches section of TanStack DB Mutations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/mutations.md
tags:
  - tanstack-db
  - guides
---

# Mutation Approaches

TanStack DB provides different approaches to mutations, each suited to different use cases:

### Collection-Level Mutations

Collection-level mutations (`insert`, `update`, `delete`) are designed for **direct state manipulation** of a single collection. These are the simplest way to make changes and work well for straightforward CRUD operations.

```tsx
// Direct state change
todoCollection.update(todoId, (draft) => {
  draft.completed = true
  draft.completedAt = new Date()
})
```

Use collection-level mutations when:
- You're making simple CRUD operations on a single collection
- The state changes are straightforward and match what the server will store

You can use `metadata` to annotate these operations and customize behavior in your handlers:

```tsx
// Annotate with metadata
todoCollection.update(
  todoId,
  { metadata: { intent: 'complete' } },
  (draft) => {
    draft.completed = true
  }
)

// Use metadata in handler
onUpdate: async ({ transaction }) => {
  const mutation = transaction.mutations[0]

  if (mutation.metadata?.intent === 'complete') {
    await Promise.all(
      transaction.mutations.map((mutation) =>
        api.todos.complete(mutation.original.id)
      )
    )
  } else {
    await Promise.all(
      transaction.mutations.map((mutation) =>
        api.todos.update(mutation.original.id, mutation.changes)
      )
    )
  }
}
```

### Intent-Based Mutations with Custom Actions

For more complex scenarios, use `createOptimisticAction` to create **intent-based mutations** that capture specific user actions.

```tsx
// Intent: "like this post"
const likePost = createOptimisticAction<string>({
  onMutate: (postId) => {
    // Optimistic guess at the change
    postCollection.update(postId, (draft) => {
      draft.likeCount += 1
      draft.likedByMe = true
    })
  },
  mutationFn: async (postId) => {
    // Send the intent to the server
    await api.posts.like(postId)
    // Server determines actual state changes
    await postCollection.utils.refetch()
  },
})

// Use it.
likePost(postId)
```

Use custom actions when:
- You need to mutate **multiple collections** in a single transaction
- The optimistic change is a **guess** at how the server will transform the data
- You want to send **user intent** to the backend rather than exact state changes
- The server performs complex logic, calculations, or side effects
- You want a clean, reusable mutation that captures a specific operation

Custom actions provide the cleanest way to capture specific types of mutations as named operations in your application. While you can achieve similar results using metadata with collection-level mutations, custom actions make the intent explicit and keep related logic together.

**When to use each:**

- **Collection-level mutations** (`collection.update`): Simple CRUD operations on a single collection
- **`createOptimisticAction`**: Intent-based operations, multi-collection mutations, immediately committed
- **Bypass the mutation system**: Use your existing mutation logic without rewriting

### Bypass the Mutation System

If you already have mutation logic in an existing system and don't want to rewrite it, you can **completely bypass** TanStack DB's mutation system and use your existing patterns.

With this approach, you write to the server like normal using your existing logic, then use your collection's mechanism for refetching or syncing data to await the server write. After the sync completes, the collection will have the updated server data and you can render the new state, hide loading indicators, show success messages, navigate to a new page, etc.

```tsx
// Call your backend directly with your existing logic
const handleUpdateTodo = async (todoId, changes) => {
  await api.todos.update(todoId, changes)

  // Wait for the server change to load into the collection
  await todoCollection.utils.refetch()

  // Now you know the new data is loaded and can render it or hide loaders
}

// With Electric
const handleUpdateTodo = async (todoId, changes) => {
  const { txid } = await api.todos.update(todoId, changes)

  // Wait for this specific transaction to sync into the collection
  await todoCollection.utils.awaitTxId(txid)

  // Now the server change is loaded and you can update UI accordingly
}
```

Use this approach when:
- You have existing mutation logic you don't want to rewrite
- You're comfortable with your current mutation patterns
- You want to use TanStack DB only for queries and state management

How to sync changes back:
- **QueryCollection**: Manually refetch with `collection.utils.refetch()` to reload data from the server
- **ElectricCollection**: Use `collection.utils.awaitTxId(txid)` to wait for a specific transaction to sync
- **Other sync systems**: Wait for your sync mechanism to update the collection
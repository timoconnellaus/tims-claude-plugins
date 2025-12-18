---
topic: tanstack-db/guides/mutations
title: TanStack DB Mutations
description: Overview and table of contents for TanStack DB Mutations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/mutations.md
tags:
  - tanstack-db
  - guides
---

# TanStack DB Mutations

TanStack DB provides a powerful mutation system that enables optimistic updates with automatic state management. This system is built around a pattern of **optimistic mutation → backend persistence → sync back → confirmed state**. This creates a highly responsive user experience while maintaining data consistency and being easy to reason about.

Local changes are applied immediately as optimistic state, then persisted to your backend, and finally the optimistic state is replaced by the confirmed server state once it syncs back.

```tsx
// Define a collection with a mutation handler
const todoCollection = createCollection({
  id: "todos",
  onUpdate: async ({ transaction }) => {
    const mutation = transaction.mutations[0]
    await api.todos.update(mutation.original.id, mutation.changes)
  },
})

// Apply an optimistic update
todoCollection.update(todo.id, (draft) => {
  draft.completed = true
})
```

This pattern extends the Redux/Flux unidirectional data flow beyond the client to include the server:

<figure>
  <a href="https://raw.githubusercontent.com/TanStack/db/main/docs/unidirectional-data-flow.lg.png" target="_blank">
    <img src="https://raw.githubusercontent.com/TanStack/db/main/docs/unidirectional-data-flow.png" />
  </a>
</figure>

With an instant inner loop of optimistic state, superseded in time by the slower outer loop of persisting to the server and syncing the updated server state back into the collection.

### Simplified Mutations vs Traditional Approaches

TanStack DB's mutation system eliminates much of the boilerplate required for optimistic updates in traditional approaches. Compare the difference:

**Before (TanStack Query with manual optimistic updates):**

```typescript
const addTodoMutation = useMutation({
  mutationFn: async (newTodo) => api.todos.create(newTodo),
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] })
    const previousTodos = queryClient.getQueryData(['todos'])
    queryClient.setQueryData(['todos'], (old) => [...(old || []), newTodo])
    return { previousTodos }
  },
  onError: (err, newTodo, context) => {
    queryClient.setQueryData(['todos'], context.previousTodos)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] })
  },
})
```

**After (TanStack DB):**

```typescript
const todoCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['todos'],
    queryFn: async () => api.todos.getAll(),
    getKey: (item) => item.id,
    schema: todoSchema,
    onInsert: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map((mutation) =>
          api.todos.create(mutation.modified)
        )
      )
    },
  })
)

// Simple mutation - no boilerplate!
todoCollection.insert({
  id: crypto.randomUUID(),
  text: '🔥 Make app faster',
  completed: false,
})
```

The benefits:
- ✅ Automatic optimistic updates
- ✅ Automatic rollback on error
- ✅ No manual cache manipulation
- ✅ Type-safe mutations

## Contents

- [Table of Contents](./table-of-contents.md)
- [Mutation Approaches](./mutation-approaches.md)
- [Mutation Lifecycle](./mutation-lifecycle.md)
- [Collection Write Operations](./collection-write-operations.md)
- [Operation Handlers](./operation-handlers.md)
- [Creating Custom Actions](./creating-custom-actions.md)
- [Manual Transactions](./manual-transactions.md)
- [Paced Mutations](./paced-mutations.md)
- [Mutation Merging](./mutation-merging.md)
- [Controlling Optimistic Behavior](./controlling-optimistic-behavior.md)
- [Transaction States](./transaction-states.md)
- [Handling Temporary IDs](./handling-temporary-ids.md)
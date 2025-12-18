---
topic: tanstack-db/guides/mutations/mutation-lifecycle
title: TanStack DB Mutations - Mutation Lifecycle
description: Mutation Lifecycle section of TanStack DB Mutations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/mutations.md
tags:
  - tanstack-db
  - guides
---

# Mutation Lifecycle

The mutation lifecycle follows a consistent pattern across all mutation types:

1. **Optimistic state applied**: The mutation is immediately applied to the local collection as optimistic state
2. **Handler invoked**: The appropriate handler — either `mutationFn` or a Collection handler (`onInsert`, `onUpdate`, or `onDelete`) — is called to persist the change
3. **Backend persistence**: Your handler persists the data to your backend
4. **Sync back**: The handler ensures server writes have synced back to the collection
5. **Optimistic state dropped**: Once synced, the optimistic state is replaced by the confirmed server state

```tsx
// Step 1: Optimistic state applied immediately
todoCollection.update(todo.id, (draft) => {
  draft.completed = true
})
// UI updates instantly with optimistic state

// Step 2-3: onUpdate handler persists to backend
// Step 4: Handler waits for sync back
// Step 5: Optimistic state replaced by server state
```

If the handler throws an error during persistence, the optimistic state is automatically rolled back.
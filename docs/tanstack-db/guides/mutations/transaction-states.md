---
topic: tanstack-db/guides/mutations/transaction-states
title: TanStack DB Mutations - Transaction States
description: Transaction States section of TanStack DB Mutations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/mutations.md
tags:
  - tanstack-db
  - guides
---

# Transaction States

Transactions progress through the following states during their lifecycle:

1. **`pending`**: Initial state when a transaction is created and optimistic mutations can be applied
2. **`persisting`**: Transaction is being persisted to the backend
3. **`completed`**: Transaction has been successfully persisted and any backend changes have been synced back
4. **`failed`**: An error was thrown while persisting or syncing back the transaction

### Monitoring Transaction State

```typescript
const tx = todoCollection.update(todoId, (draft) => {
  draft.completed = true
})

// Check current state
console.log(tx.state) // 'pending'

// Wait for specific states
await tx.isPersisted.promise
console.log(tx.state) // 'completed' or 'failed'

// Handle errors
try {
  await tx.isPersisted.promise
  console.log("Success!")
} catch (error) {
  console.log("Failed:", error)
}
```

### State Transitions

The normal flow is: `pending` → `persisting` → `completed`

If an error occurs: `pending` → `persisting` → `failed`

Failed transactions automatically rollback their optimistic state.
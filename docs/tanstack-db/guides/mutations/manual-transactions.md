---
topic: tanstack-db/guides/mutations/manual-transactions
title: TanStack DB Mutations - Manual Transactions
description: Manual Transactions section of TanStack DB Mutations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/mutations.md
tags:
  - tanstack-db
  - guides
---

# Manual Transactions

For maximum control over transaction lifecycles, create transactions manually using `createTransaction`. This approach allows you to batch multiple mutations, implement custom commit workflows, or create transactions that span multiple user interactions.

### Basic Manual Transaction

```ts
import { createTransaction } from "@tanstack/react-db"

const addTodoTx = createTransaction({
  autoCommit: false,
  mutationFn: async ({ transaction }) => {
    // Persist all mutations to backend
    await Promise.all(
      transaction.mutations.map((mutation) =>
        api.saveTodo(mutation.modified)
      )
    )
  },
})

// Apply first change
addTodoTx.mutate(() =>
  todoCollection.insert({
    id: "1",
    text: "First todo",
    completed: false
  })
)

// User reviews change...

// Apply another change
addTodoTx.mutate(() =>
  todoCollection.insert({
    id: "2",
    text: "Second todo",
    completed: false
  })
)

// User commits when ready (e.g., when they hit save)
addTodoTx.commit()
```

### Transaction Configuration

Manual transactions accept the following options:

```typescript
createTransaction({
  id?: string,              // Optional unique identifier for the transaction
  autoCommit?: boolean,     // Whether to automatically commit after mutate()
  mutationFn: MutationFn,   // Function to persist mutations
  metadata?: Record<string, unknown>, // Optional custom metadata
})
```

**autoCommit**:
- `true` (default): Transaction commits immediately after each `mutate()` call
- `false`: Transaction waits for explicit `commit()` call

### Transaction Methods

Manual transactions provide several methods:

```typescript
// Apply mutations within a transaction
tx.mutate(() => {
  collection.insert(item)
  collection.update(key, updater)
})

// Commit the transaction
await tx.commit()

// Manually rollback changes (e.g., user cancels a form)
// Note: Rollback happens automatically if mutationFn throws an error
tx.rollback()
```

### Multi-Step Workflows

Manual transactions excel at complex workflows:

```ts
const reviewTx = createTransaction({
  autoCommit: false,
  mutationFn: async ({ transaction }) => {
    await api.batchUpdate(transaction.mutations)
  },
})

// Step 1: User makes initial changes
reviewTx.mutate(() => {
  todoCollection.update(id1, (draft) => {
    draft.status = "reviewed"
  })
  todoCollection.update(id2, (draft) => {
    draft.status = "reviewed"
  })
})

// Step 2: Show preview to user...

// Step 3: User confirms or makes additional changes
reviewTx.mutate(() => {
  todoCollection.update(id3, (draft) => {
    draft.status = "reviewed"
  })
})

// Step 4: User commits all changes at once
await reviewTx.commit()
// OR user cancels
// reviewTx.rollback()
```

### Using with Local Collections

LocalOnly and LocalStorage collections require special handling when used with manual transactions. Unlike server-synced collections that have `onInsert`, `onUpdate`, and `onDelete` handlers automatically invoked, local collections need you to manually accept mutations by calling `utils.acceptMutations()` in your transaction's `mutationFn`.

#### Why This Is Needed

Local collections (LocalOnly and LocalStorage) don't participate in the standard mutation handler flow for manual transactions. They need an explicit call to persist changes made during `tx.mutate()`.

#### Basic Usage

```ts
import { createTransaction } from "@tanstack/react-db"
import { localOnlyCollectionOptions } from "@tanstack/react-db"

const formDraft = createCollection(
  localOnlyCollectionOptions({
    id: "form-draft",
    getKey: (item) => item.id,
  })
)

const tx = createTransaction({
  autoCommit: false,
  mutationFn: async ({ transaction }) => {
    // Make API call with the data first
    const draftData = transaction.mutations
      .filter((m) => m.collection === formDraft)
      .map((m) => m.modified)

    await api.saveDraft(draftData)

    // After API succeeds, accept and persist local collection mutations
    formDraft.utils.acceptMutations(transaction)
  },
})

// Apply mutations
tx.mutate(() => {
  formDraft.insert({ id: "1", field: "value" })
})

// Commit when ready
await tx.commit()
```

#### Combining Local and Server Collections

You can mix local and server collections in the same transaction:

```ts
const localSettings = createCollection(
  localStorageCollectionOptions({
    id: "user-settings",
    storageKey: "app-settings",
    getKey: (item) => item.id,
  })
)

const userProfile = createCollection(
  queryCollectionOptions({
    queryKey: ["profile"],
    queryFn: async () => api.profile.get(),
    getKey: (item) => item.id,
    onUpdate: async ({ transaction }) => {
      await api.profile.update(transaction.mutations[0].modified)
    },
  })
)

const tx = createTransaction({
  mutationFn: async ({ transaction }) => {
    // Handle server collection mutations explicitly in mutationFn
    await Promise.all(
      transaction.mutations
        .filter((m) => m.collection === userProfile)
        .map((m) => api.profile.update(m.modified))
    )

    // After server mutations succeed, accept local collection mutations
    localSettings.utils.acceptMutations(transaction)
  },
})

// Update both local and server data in one transaction
tx.mutate(() => {
  localSettings.update("theme", (draft) => {
    draft.mode = "dark"
  })
  userProfile.update("user-1", (draft) => {
    draft.name = "Updated Name"
  })
})

await tx.commit()
```

#### Transaction Ordering

**When to call `acceptMutations`** matters for transaction semantics:

**After API success (recommended for consistency):**
```ts
mutationFn: async ({ transaction }) => {
  await api.save(data)  // API call first
  localData.utils.acceptMutations(transaction)  // Persist after success
}
```

✅ **Pros**: If the API fails, local changes roll back too (all-or-nothing semantics)
❌ **Cons**: Local state won't reflect changes until API succeeds

**Before API call (for independent local state):**
```ts
mutationFn: async ({ transaction }) => {
  localData.utils.acceptMutations(transaction)  // Persist first
  await api.save(data)  // Then API call
}
```

✅ **Pros**: Local state persists immediately, regardless of API outcome
❌ **Cons**: API failure leaves local changes persisted (divergent state)

Choose based on whether your local data should be independent of or coupled to remote mutations.

#### Best Practices

- Always call `utils.acceptMutations()` for local collections in manual transactions
- Call `acceptMutations` **after** API success if you want transactional consistency
- Call `acceptMutations` **before** API calls if local state should persist regardless
- Filter mutations by collection if you need to process them separately
- Mix local and server collections freely in the same transaction

### Listening to Transaction Lifecycle

Monitor transaction state changes:

```typescript
const tx = createTransaction({
  autoCommit: false,
  mutationFn: async ({ transaction }) => {
    await api.persist(transaction.mutations)
  },
})

// Wait for transaction to complete
tx.isPersisted.promise.then(() => {
  console.log("Transaction persisted!")
})

// Check current state
console.log(tx.state) // 'pending', 'persisting', 'completed', or 'failed'
```
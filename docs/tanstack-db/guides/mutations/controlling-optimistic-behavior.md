---
topic: tanstack-db/guides/mutations/controlling-optimistic-behavior
title: TanStack DB Mutations - Controlling Optimistic Behavior
description: Controlling Optimistic Behavior section of TanStack DB Mutations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/mutations.md
tags:
  - tanstack-db
  - guides
---

# Controlling Optimistic Behavior

By default, all mutations apply optimistic updates immediately to provide instant feedback. However, you can disable this behavior when you need to wait for server confirmation before applying changes locally.

### When to Disable Optimistic Updates

Consider using `optimistic: false` when:

- **Complex server-side processing**: Operations that depend on server-side generation (e.g., cascading foreign keys, computed fields)
- **Validation requirements**: Operations where backend validation might reject the change
- **Confirmation workflows**: Deletes where UX should wait for confirmation before removing data
- **Batch operations**: Large operations where optimistic rollback would be disruptive

### Behavior Differences

**`optimistic: true` (default)**:
- Immediately applies mutation to the local store
- Provides instant UI feedback
- Requires rollback if server rejects the mutation
- Best for simple, predictable operations

**`optimistic: false`**:
- Does not modify local store until server confirms
- No immediate UI feedback, but no rollback needed
- UI updates only after successful server response
- Best for complex or validation-heavy operations

### Using Non-Optimistic Mutations

```typescript
// Critical deletion that needs confirmation
const handleDeleteAccount = () => {
  userCollection.delete(userId, { optimistic: false })
}

// Server-generated data
const handleCreateInvoice = () => {
  // Server generates invoice number, tax calculations, etc.
  invoiceCollection.insert(invoiceData, { optimistic: false })
}

// Mixed approach in same transaction
tx.mutate(() => {
  // Instant UI feedback for simple change
  todoCollection.update(todoId, (draft) => {
    draft.completed = true
  })

  // Wait for server confirmation for complex change
  auditCollection.insert(auditRecord, { optimistic: false })
})
```

### Waiting for Persistence

A common pattern with `optimistic: false` is to wait for the mutation to complete before navigating or showing success feedback:

```typescript
const handleCreatePost = async (postData) => {
  // Insert without optimistic updates
  const tx = postsCollection.insert(postData, { optimistic: false })

  try {
    // Wait for write to server and sync back to complete
    await tx.isPersisted.promise

    // Server write and sync back were successful
    navigate(`/posts/${postData.id}`)
  } catch (error) {
    // Show error notification
    toast.error("Failed to create post: " + error.message)
  }
}

// Works with updates and deletes too
const handleUpdateTodo = async (todoId, changes) => {
  const tx = todoCollection.update(
    todoId,
    { optimistic: false },
    (draft) => Object.assign(draft, changes)
  )

  try {
    await tx.isPersisted.promise
    navigate("/todos")
  } catch (error) {
    toast.error("Failed to update todo: " + error.message)
  }
}
```
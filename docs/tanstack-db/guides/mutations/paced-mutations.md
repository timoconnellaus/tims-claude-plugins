---
topic: tanstack-db/guides/mutations/paced-mutations
title: TanStack DB Mutations - Paced Mutations
description: Paced Mutations section of TanStack DB Mutations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/mutations.md
tags:
  - tanstack-db
  - guides
---

# Paced Mutations

Paced mutations provide fine-grained control over **when and how** mutations are persisted to your backend. Instead of persisting every mutation immediately, you can use timing strategies to batch, delay, or queue mutations based on your application's needs.

Powered by [TanStack Pacer](https://github.com/TanStack/pacer), paced mutations are ideal for scenarios like:
- **Auto-save forms** that wait for the user to stop typing
- **Slider controls** that need smooth updates without overwhelming the backend
- **Sequential workflows** where order matters and every mutation must persist

### Key Design

The fundamental difference between strategies is how they handle transactions:

**Debounce/Throttle**: Only one pending transaction (collecting mutations) and one persisting transaction (writing to backend) at a time. Multiple rapid mutations automatically merge together into a single transaction.

**Queue**: Each mutation creates a separate transaction, guaranteed to run in the order they're made (FIFO by default, configurable to LIFO). All mutations are guaranteed to persist.

### Available Strategies

| Strategy | Behavior | Best For |
|----------|----------|----------|
| **`debounceStrategy`** | Wait for inactivity before persisting. Only final state is saved. | Auto-save forms, search-as-you-type |
| **`throttleStrategy`** | Ensure minimum spacing between executions. Mutations between executions are merged. | Sliders, progress updates, analytics |
| **`queueStrategy`** | Each mutation becomes a separate transaction, processed sequentially in order (FIFO by default, configurable to LIFO). All mutations guaranteed to persist. | Sequential workflows, file uploads, rate-limited APIs |

### Debounce Strategy

The debounce strategy waits for a period of inactivity before persisting. This is perfect for auto-save scenarios where you want to wait until the user stops typing before saving their work.

```tsx
import { usePacedMutations, debounceStrategy } from "@tanstack/react-db"

function AutoSaveForm({ formId }: { formId: string }) {
  const mutate = usePacedMutations<{ field: string; value: string }>({
    onMutate: ({ field, value }) => {
      // Apply optimistic update immediately
      formCollection.update(formId, (draft) => {
        draft[field] = value
      })
    },
    mutationFn: async ({ transaction }) => {
      // Persist the final merged state to the backend
      await api.forms.save(transaction.mutations)
    },
    // Wait 500ms after the last change before persisting
    strategy: debounceStrategy({ wait: 500 }),
  })

  const handleChange = (field: string, value: string) => {
    // Multiple rapid changes merge into a single transaction
    mutate({ field, value })
  }

  return (
    <form>
      <input onChange={(e) => handleChange('title', e.target.value)} />
      <textarea onChange={(e) => handleChange('content', e.target.value)} />
    </form>
  )
}
```

**Key characteristics**:
- Timer resets on each mutation
- Only the final merged state persists
- Reduces backend writes significantly for rapid changes

### Throttle Strategy

The throttle strategy ensures a minimum spacing between executions. This is ideal for scenarios like sliders or progress updates where you want smooth, consistent updates without overwhelming your backend.

```tsx
import { usePacedMutations, throttleStrategy } from "@tanstack/react-db"

function VolumeSlider() {
  const mutate = usePacedMutations<number>({
    onMutate: (volume) => {
      // Apply optimistic update immediately
      settingsCollection.update('volume', (draft) => {
        draft.value = volume
      })
    },
    mutationFn: async ({ transaction }) => {
      await api.settings.updateVolume(transaction.mutations)
    },
    // Persist at most once every 200ms
    strategy: throttleStrategy({
      wait: 200,
      leading: true,   // Execute immediately on first call
      trailing: true,  // Execute after wait period if there were mutations
    }),
  })

  const handleVolumeChange = (volume: number) => {
    mutate(volume)
  }

  return (
    <input
      type="range"
      min={0}
      max={100}
      onChange={(e) => handleVolumeChange(Number(e.target.value))}
    />
  )
}
```

**Key characteristics**:
- Guarantees minimum spacing between persists
- Can execute on leading edge, trailing edge, or both
- Mutations between executions are merged

### Queue Strategy

The queue strategy creates a separate transaction for each mutation and processes them sequentially in order. Unlike debounce/throttle, **every mutation is guaranteed to persist**, making it ideal for workflows where you can't lose any operations.

```tsx
import { usePacedMutations, queueStrategy } from "@tanstack/react-db"

function FileUploader() {
  const mutate = usePacedMutations<File>({
    onMutate: (file) => {
      // Apply optimistic update immediately
      uploadCollection.insert({
        id: crypto.randomUUID(),
        file,
        status: 'pending',
      })
    },
    mutationFn: async ({ transaction }) => {
      // Each file upload is its own transaction
      const mutation = transaction.mutations[0]
      await api.files.upload(mutation.modified)
    },
    // Process each upload sequentially with 500ms between them
    strategy: queueStrategy({
      wait: 500,
      addItemsTo: 'back',    // FIFO: add to back of queue
      getItemsFrom: 'front', // FIFO: process from front of queue
    }),
  })

  const handleFileSelect = (files: FileList) => {
    // Each file creates its own transaction, queued for sequential processing
    Array.from(files).forEach((file) => {
      mutate(file)
    })
  }

  return <input type="file" multiple onChange={(e) => handleFileSelect(e.target.files!)} />
}
```

**Key characteristics**:
- Each mutation becomes its own transaction
- Processes sequentially in order (FIFO by default)
- Can configure to LIFO by setting `getItemsFrom: 'back'`
- All mutations guaranteed to persist
- Waits for each transaction to complete before starting the next

### Choosing a Strategy

Use this guide to pick the right strategy for your use case:

**Use `debounceStrategy` when:**
- You want to wait for the user to finish their action
- Only the final state matters (intermediate states can be discarded)
- You want to minimize backend writes
- Examples: auto-save forms, search-as-you-type, settings panels

**Use `throttleStrategy` when:**
- You want smooth, consistent updates at a controlled rate
- Some intermediate states should persist, but not all
- You need updates to feel responsive without overwhelming the backend
- Examples: volume sliders, progress bars, analytics tracking, live cursor position

**Use `queueStrategy` when:**
- Every mutation must persist (no operations can be lost)
- Order of operations matters
- You're working with a rate-limited API
- You need sequential processing with delays
- Examples: file uploads, batch operations, audit trails, multi-step wizards

### Using in React

The `usePacedMutations` hook makes it easy to use paced mutations in React components:

```tsx
import { usePacedMutations, debounceStrategy } from "@tanstack/react-db"

function MyComponent({ itemId }: { itemId: string }) {
  const mutate = usePacedMutations<number>({
    onMutate: (newValue) => {
      // Apply optimistic update immediately
      collection.update(itemId, (draft) => {
        draft.value = newValue
      })
    },
    mutationFn: async ({ transaction }) => {
      await api.save(transaction.mutations)
    },
    strategy: debounceStrategy({ wait: 500 }),
  })

  // Each mutate call returns a Transaction you can await
  const handleSave = async (newValue: number) => {
    const tx = mutate(newValue)

    // Optionally wait for persistence
    try {
      await tx.isPersisted.promise
      console.log('Saved successfully!')
    } catch (error) {
      console.error('Save failed:', error)
    }
  }

  return <button onClick={() => handleSave(42)}>Save</button>
}
```

The hook automatically memoizes the strategy and mutation function to prevent unnecessary recreations. You can also use `createPacedMutations` directly outside of React:

```ts
import { createPacedMutations, queueStrategy } from "@tanstack/db"

const mutate = createPacedMutations<{ id: string; changes: Partial<Item> }>({
  onMutate: ({ id, changes }) => {
    // Apply optimistic update immediately
    collection.update(id, (draft) => {
      Object.assign(draft, changes)
    })
  },
  mutationFn: async ({ transaction }) => {
    await api.save(transaction.mutations)
  },
  strategy: queueStrategy({ wait: 200 }),
})

// Use anywhere in your application
mutate({ id: '123', changes: { name: 'New Name' } })
```

### Understanding Queues and Hook Instances

**Each unique `usePacedMutations` hook call creates its own independent queue.** This is an important design decision that affects how you structure your mutations.

If you have multiple components calling `usePacedMutations` separately, each will have its own isolated queue:

```tsx
function EmailDraftEditor1({ draftId }: { draftId: string }) {
  // This creates Queue A
  const mutate = usePacedMutations({
    onMutate: (text) => {
      draftCollection.update(draftId, (draft) => {
        draft.text = text
      })
    },
    mutationFn: async ({ transaction }) => {
      await api.saveDraft(transaction.mutations)
    },
    strategy: debounceStrategy({ wait: 500 }),
  })

  return <textarea onChange={(e) => mutate(e.target.value)} />
}

function EmailDraftEditor2({ draftId }: { draftId: string }) {
  // This creates Queue B (separate from Queue A)
  const mutate = usePacedMutations({
    onMutate: (text) => {
      draftCollection.update(draftId, (draft) => {
        draft.text = text
      })
    },
    mutationFn: async ({ transaction }) => {
      await api.saveDraft(transaction.mutations)
    },
    strategy: debounceStrategy({ wait: 500 }),
  })

  return <textarea onChange={(e) => mutate(e.target.value)} />
}
```

In this example, mutations from `EmailDraftEditor1` and `EmailDraftEditor2` will be queued and processed **independently**. They won't share the same debounce timer or queue.

**To share the same queue across multiple components**, create a single `createPacedMutations` instance and use it everywhere:

```tsx
// Create a single shared instance
import { createPacedMutations, debounceStrategy } from "@tanstack/db"

export const mutateDraft = createPacedMutations<{ draftId: string; text: string }>({
  onMutate: ({ draftId, text }) => {
    draftCollection.update(draftId, (draft) => {
      draft.text = text
    })
  },
  mutationFn: async ({ transaction }) => {
    await api.saveDraft(transaction.mutations)
  },
  strategy: debounceStrategy({ wait: 500 }),
})

// Now both components share the same queue
function EmailDraftEditor1({ draftId }: { draftId: string }) {
  return <textarea onChange={(e) => mutateDraft({ draftId, text: e.target.value })} />
}

function EmailDraftEditor2({ draftId }: { draftId: string }) {
  return <textarea onChange={(e) => mutateDraft({ draftId, text: e.target.value })} />
}
```

With this approach, all mutations from both components share the same debounce timer and queue, ensuring they're processed in the correct order with a single debounce implementation.

**Key takeaways:**

- Each `usePacedMutations()` call = unique queue
- Each `createPacedMutations()` call = unique queue
- To share a queue: create one instance and import it everywhere you need it
- Shared queues ensure mutations from different places are ordered correctly
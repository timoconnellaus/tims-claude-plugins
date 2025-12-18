---
topic: tanstack-db/guides/mutations/creating-custom-actions
title: TanStack DB Mutations - Creating Custom Actions
description: Creating Custom Actions section of TanStack DB Mutations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/mutations.md
tags:
  - tanstack-db
  - guides
---

# Creating Custom Actions

For more complex mutation patterns, use `createOptimisticAction` to create custom actions with full control over the mutation lifecycle.

### Basic Action

Create an action that combines mutation logic with persistence:

```tsx
import { createOptimisticAction } from "@tanstack/react-db"

const addTodo = createOptimisticAction<string>({
  onMutate: (text) => {
    // Apply optimistic state
    todoCollection.insert({
      id: crypto.randomUUID(),
      text,
      completed: false,
    })
  },
  mutationFn: async (text, params) => {
    // Persist to backend
    const response = await fetch("/api/todos", {
      method: "POST",
      body: JSON.stringify({ text, completed: false }),
    })
    const result = await response.json()

    // Wait for sync back
    await todoCollection.utils.refetch()

    return result
  },
})

// Use in components
const Todo = () => {
  const handleClick = () => {
    addTodo("🔥 Make app faster")
  }

  return <Button onClick={handleClick} />
}
```

### Type-Safe Actions with Schema Validation

For better type safety and runtime validation, you can use schema validation libraries like Zod, Valibot, or others. Here's an example using Zod:

```tsx
import { createOptimisticAction } from "@tanstack/react-db"
import { z } from "zod"

// Define a schema for the action parameters
const addTodoSchema = z.object({
  text: z.string().min(1, "Todo text cannot be empty"),
  priority: z.enum(["low", "medium", "high"]).optional(),
})

// Use the schema's inferred type for the generic
const addTodo = createOptimisticAction<z.infer<typeof addTodoSchema>>({
  onMutate: (params) => {
    // Validate parameters at runtime
    const validated = addTodoSchema.parse(params)

    // Apply optimistic state
    todoCollection.insert({
      id: crypto.randomUUID(),
      text: validated.text,
      priority: validated.priority ?? "medium",
      completed: false,
    })
  },
  mutationFn: async (params) => {
    // Parameters are already validated
    const validated = addTodoSchema.parse(params)

    const response = await fetch("/api/todos", {
      method: "POST",
      body: JSON.stringify({
        text: validated.text,
        priority: validated.priority ?? "medium",
        completed: false,
      }),
    })
    const result = await response.json()

    await todoCollection.utils.refetch()
    return result
  },
})

// Use with type-safe parameters
const Todo = () => {
  const handleClick = () => {
    addTodo({
      text: "🔥 Make app faster",
      priority: "high",
    })
  }

  return <Button onClick={handleClick} />
}
```

This pattern works with any validation library (Zod, Valibot, Yup, etc.) and provides:
- ✅ Runtime validation of parameters
- ✅ Type safety from inferred types
- ✅ Clear error messages for invalid inputs
- ✅ Single source of truth for parameter shape

### Complex Multi-Collection Actions

Actions can mutate multiple collections:

```tsx
const createProject = createOptimisticAction<{
  name: string
  ownerId: string
}>({
  onMutate: ({ name, ownerId }) => {
    const projectId = crypto.randomUUID()

    // Insert project
    projectCollection.insert({
      id: projectId,
      name,
      ownerId,
      createdAt: new Date(),
    })

    // Update user's project count
    userCollection.update(ownerId, (draft) => {
      draft.projectCount += 1
    })
  },
  mutationFn: async ({ name, ownerId }) => {
    const response = await api.projects.create({ name, ownerId })

    // Wait for both collections to sync
    await Promise.all([
      projectCollection.utils.refetch(),
      userCollection.utils.refetch(),
    ])

    return response
  },
})
```

### Action Parameters

The `mutationFn` receives additional parameters for advanced use cases:

```tsx
const updateTodo = createOptimisticAction<{
  id: string
  changes: Partial<Todo>
}>({
  onMutate: ({ id, changes }) => {
    todoCollection.update(id, (draft) => {
      Object.assign(draft, changes)
    })
  },
  mutationFn: async ({ id, changes }, params) => {
    // params.transaction contains the transaction object
    // params.signal is an AbortSignal for cancellation

    const response = await api.todos.update(id, changes, {
      signal: params.signal,
    })

    await todoCollection.utils.refetch()
    return response
  },
})
```
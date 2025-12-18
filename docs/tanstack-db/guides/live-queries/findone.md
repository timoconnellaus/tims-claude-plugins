---
topic: tanstack-db/guides/live-queries/findone
title: TanStack DB Live Queries - findOne
description: findOne section of TanStack DB Live Queries
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/live-queries.md
tags:
  - tanstack-db
  - guides
---

# findOne

Use `findOne` to return a single result instead of an array. This is useful when you expect to find at most one matching record, such as when querying by a unique identifier.

The `findOne` method changes the return type from an array to a single object or `undefined`. When no matching record is found, the result is `undefined`.

### Method Signature

```ts
findOne(): Query
```

### Basic Usage

Find a specific user by ID:

```ts
const user = createLiveQueryCollection((q) =>
  q
    .from({ users: usersCollection })
    .where(({ users }) => eq(users.id, 1))
    .findOne()
)

// Result type: User | undefined
// If user with id=1 exists: { id: 1, name: 'John', ... }
// If not found: undefined
```

### With React Hooks

Use `findOne` with `useLiveQuery` to get a single record:

```tsx
import { useLiveQuery } from '@tanstack/react-db'
import { eq } from '@tanstack/db'

function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading } = useLiveQuery((q) =>
    q
      .from({ users: usersCollection })
      .where(({ users }) => eq(users.id, userId))
      .findOne()
  , [userId])

  if (isLoading) return <div>Loading...</div>
  if (!user) return <div>User not found</div>

  return <div>{user.name}</div>
}
```

### With Select

Combine `findOne` with `select` to project specific fields:

```ts
const userEmail = createLiveQueryCollection((q) =>
  q
    .from({ users: usersCollection })
    .where(({ users }) => eq(users.id, 1))
    .select(({ users }) => ({
      id: users.id,
      email: users.email,
    }))
    .findOne()
)

// Result type: { id: number, email: string } | undefined
```

### Return Type Behavior

The return type changes based on whether `findOne` is used:

```ts
// Without findOne - returns array
const users = createLiveQueryCollection((q) =>
  q.from({ users: usersCollection })
)
// Type: Array<User>

// With findOne - returns single object or undefined
const user = createLiveQueryCollection((q) =>
  q.from({ users: usersCollection }).findOne()
)
// Type: User | undefined
```

### Best Practices

**Use when:**
- Querying by unique identifiers (ID, email, etc.)
- You expect at most one result
- You want type-safe single-record access without array indexing

**Avoid when:**
- You might have multiple matching records (use regular queries instead)
- You need to iterate over results
---
topic: tanstack-db/guides/live-queries/creating-live-query-collections
title: TanStack DB Live Queries - Creating Live Query Collections
description: Creating Live Query Collections section of TanStack DB Live Queries
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/live-queries.md
tags:
  - tanstack-db
  - guides
---

# Creating Live Query Collections

To create a live query collection, you can use `liveQueryCollectionOptions` with `createCollection`, or use the convenience function `createLiveQueryCollection`.

### Using liveQueryCollectionOptions

The fundamental way to create a live query is using `liveQueryCollectionOptions` with `createCollection`:

```ts
import { createCollection, liveQueryCollectionOptions, eq } from '@tanstack/db'

const activeUsers = createCollection(liveQueryCollectionOptions({
  query: (q) =>
    q
      .from({ user: usersCollection })
      .where(({ user }) => eq(user.active, true))
      .select(({ user }) => ({
        id: user.id,
        name: user.name,
      }))
}))
```

### Configuration Options

For more control, you can specify additional options:

```ts
const activeUsers = createCollection(liveQueryCollectionOptions({
  id: 'active-users', // Optional: auto-generated if not provided
  query: (q) =>
    q
      .from({ user: usersCollection })
      .where(({ user }) => eq(user.active, true))
      .select(({ user }) => ({
        id: user.id,
        name: user.name,
      })),
  getKey: (user) => user.id, // Optional: uses stream key if not provided
  startSync: true, // Optional: starts sync immediately
}))
```
| Option | Type | Description |
|--------|------|-------------|
| `id` | `string` (optional) | An optional unique identifier for the live query. If not provided, it will be auto-generated. This is useful for debugging and logging. |
| `query` | `QueryBuilder` or function | The query definition, this is either a `Query` instance or a function that returns a `Query` instance. |
| `getKey` | `(item) => string \| number` (optional) | A function that extracts a unique key from each row. If not provided, the stream's internal key will be used. For simple cases this is the key from the parent collection, but in the case of joins, the auto-generated key will be a composite of the parent keys. Using `getKey` is useful when you want to use a specific key from a parent collection for the resulting collection. |
| `schema` | `Schema` (optional) | Optional schema for validation |
| `startSync` | `boolean` (optional) | Whether to start syncing immediately. Defaults to `true`. |
| `gcTime` | `number` (optional) | Garbage collection time in milliseconds. Defaults to `5000` (5 seconds). |

### Convenience Function

For simpler cases, you can use `createLiveQueryCollection` as a shortcut:

```ts
import { createLiveQueryCollection, eq } from '@tanstack/db'

const activeUsers = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .where(({ user }) => eq(user.active, true))
    .select(({ user }) => ({
      id: user.id,
      name: user.name,
    }))
)
```

### Using with Frameworks

In React, you can use the `useLiveQuery` hook:

```tsx
import { useLiveQuery } from '@tanstack/react-db'

function UserList() {
  const activeUsers = useLiveQuery((q) =>
    q
      .from({ user: usersCollection })
      .where(({ user }) => eq(user.active, true))
  )

  return (
    <ul>
      {activeUsers.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
```

In Angular, you can use the `injectLiveQuery` function:

```typescript
import { Component } from '@angular/core'
import { injectLiveQuery } from '@tanstack/angular-db'

@Component({
  selector: 'user-list',
  template: `
    @for (user of activeUsers.data(); track user.id) {
      <li>{{ user.name }}</li>
    }
  `
})
export class UserListComponent {
  activeUsers = injectLiveQuery((q) =>
    q
      .from({ user: usersCollection })
      .where(({ user }) => eq(user.active, true))
  )
}
```

> **Note:** React hooks (`useLiveQuery`, `useLiveInfiniteQuery`, `useLiveSuspenseQuery`) accept an optional dependency array parameter to re-execute queries when values change, similar to React's `useEffect`. See the [React Adapter documentation](../framework/react/overview#dependency-arrays) for details on when and how to use dependency arrays.

For more details on framework integration, see the [React](../framework/react/overview), [Vue](../framework/vue/overview), and [Angular](../framework/angular/overview) adapter documentation.

### Using with React Suspense

For React applications, you can use the `useLiveSuspenseQuery` hook to integrate with React Suspense boundaries. This hook suspends rendering while data loads initially, then streams updates without re-suspending.

```tsx
import { useLiveSuspenseQuery } from '@tanstack/react-db'
import { Suspense } from 'react'

function UserList() {
  // This will suspend until data is ready
  const { data } = useLiveSuspenseQuery((q) =>
    q
      .from({ user: usersCollection })
      .where(({ user }) => eq(user.active, true))
  )

  // data is always defined - no need for optional chaining
  return (
    <ul>
      {data.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}

function App() {
  return (
    <Suspense fallback={<div>Loading users...</div>}>
      <UserList />
    </Suspense>
  )
}
```

#### Type Safety

The key difference from `useLiveQuery` is that `data` is always defined (never `undefined`). The hook suspends during initial load, so by the time your component renders, data is guaranteed to be available:

```tsx
function UserStats() {
  const { data } = useLiveSuspenseQuery((q) =>
    q.from({ user: usersCollection })
  )

  // TypeScript knows data is Array<User>, not Array<User> | undefined
  return <div>Total users: {data.length}</div>
}
```

#### Error Handling

Combine with Error Boundaries to handle loading errors:

```tsx
import { ErrorBoundary } from 'react-error-boundary'

function App() {
  return (
    <ErrorBoundary fallback={<div>Failed to load users</div>}>
      <Suspense fallback={<div>Loading users...</div>}>
        <UserList />
      </Suspense>
    </ErrorBoundary>
  )
}
```

#### Reactive Updates

After the initial load, data updates stream in without re-suspending:

```tsx
function UserList() {
  const { data } = useLiveSuspenseQuery((q) =>
    q.from({ user: usersCollection })
  )

  // Suspends once during initial load
  // After that, data updates automatically when users change
  // UI never re-suspends for live updates
  return (
    <ul>
      {data.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
```

#### Re-suspending on Dependency Changes

When dependencies change, the hook re-suspends to load new data:

```tsx
function FilteredUsers({ minAge }: { minAge: number }) {
  const { data } = useLiveSuspenseQuery(
    (q) =>
      q
        .from({ user: usersCollection })
        .where(({ user }) => gt(user.age, minAge)),
    [minAge] // Re-suspend when minAge changes
  )

  return (
    <ul>
      {data.map(user => (
        <li key={user.id}>{user.name} - {user.age}</li>
      ))}
    </ul>
  )
}
```

#### When to Use Which Hook

- **Use `useLiveSuspenseQuery`** when:
  - You want to use React Suspense for loading states
  - You prefer handling loading/error states with `<Suspense>` and `<ErrorBoundary>` components
  - You want guaranteed non-undefined data types
  - The query always needs to run (not conditional)

- **Use `useLiveQuery`** when:
  - You need conditional/disabled queries
  - You prefer handling loading/error states within your component
  - You want to show loading states inline without Suspense
  - You need access to `status` and `isLoading` flags
  - **You're using a router with loaders** (React Router, TanStack Router, etc.) - preload in the loader and use `useLiveQuery` in the component

```tsx
// useLiveQuery - handle states in component
function UserList() {
  const { data, status, isLoading } = useLiveQuery((q) =>
    q.from({ user: usersCollection })
  )

  if (isLoading) return <div>Loading...</div>
  if (status === 'error') return <div>Error loading users</div>

  return <ul>{data?.map(user => <li key={user.id}>{user.name}</li>)}</ul>
}

// useLiveSuspenseQuery - handle states with Suspense/ErrorBoundary
function UserList() {
  const { data } = useLiveSuspenseQuery((q) =>
    q.from({ user: usersCollection })
  )

  return <ul>{data.map(user => <li key={user.id}>{user.name}</li>)}</ul>
}

// useLiveQuery with router loader - recommended pattern
// In your route configuration:
const route = {
  path: '/users',
  loader: async () => {
    // Preload the collection in the loader
    await usersCollection.preload()
    return null
  },
  component: UserList,
}

// In your component:
function UserList() {
  // Collection is already loaded, so data is immediately available
  const { data } = useLiveQuery((q) =>
    q.from({ user: usersCollection })
  )

  return <ul>{data?.map(user => <li key={user.id}>{user.name}</li>)}</ul>
}
```

### Conditional Queries

In React, you can conditionally disable a query by returning `undefined` or `null` from the `useLiveQuery` callback. When disabled, the hook returns a special state indicating the query is not active.

```tsx
import { useLiveQuery } from '@tanstack/react-db'

function TodoList({ userId }: { userId?: string }) {
  const { data, isEnabled, status } = useLiveQuery((q) => {
    // Disable the query when userId is not available
    if (!userId) return undefined

    return q
      .from({ todos: todosCollection })
      .where(({ todos }) => eq(todos.userId, userId))
  }, [userId])

  if (!isEnabled) {
    return <div>Please select a user</div>
  }

  return (
    <ul>
      {data?.map(todo => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  )
}
```

When the query is disabled (callback returns `undefined` or `null`):
- `status` is `'disabled'`
- `data`, `state`, and `collection` are `undefined`
- `isEnabled` is `false`
- `isLoading`, `isReady`, `isIdle`, and `isError` are all `false`

This pattern is useful for "wait until inputs exist" flows without needing to conditionally render the hook itself or manage an external enabled flag.

### Alternative Callback Return Types

The `useLiveQuery` callback can return different types depending on your use case:

#### Returning a Query Builder (Standard)

The most common pattern is to return a query builder:

```tsx
const { data } = useLiveQuery((q) =>
  q.from({ todos: todosCollection })
   .where(({ todos }) => eq(todos.completed, false))
)
```

#### Returning a Pre-created Collection

You can return an existing collection directly:

```tsx
const activeUsersCollection = createLiveQueryCollection((q) =>
  q.from({ users: usersCollection })
   .where(({ users }) => eq(users.active, true))
)

function UserList({ usePrebuilt }: { usePrebuilt: boolean }) {
  const { data } = useLiveQuery((q) => {
    // Toggle between pre-created collection and ad-hoc query
    if (usePrebuilt) return activeUsersCollection

    return q.from({ users: usersCollection })
  }, [usePrebuilt])

  return <ul>{data?.map(user => <li key={user.id}>{user.name}</li>)}</ul>
}
```

#### Returning a LiveQueryCollectionConfig

You can return a configuration object to specify additional options like a custom ID:

```tsx
const { data } = useLiveQuery((q) => {
  return {
    query: q.from({ items: itemsCollection })
             .select(({ items }) => ({ id: items.id })),
    id: 'items-view', // Custom ID for debugging
    gcTime: 10000 // Custom garbage collection time
  }
})
```

This is particularly useful when you need to:
- Attach a stable ID for debugging or logging
- Configure collection-specific options like `gcTime` or `getKey`
- Conditionally switch between different collection configurations
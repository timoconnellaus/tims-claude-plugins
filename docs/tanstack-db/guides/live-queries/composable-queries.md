---
topic: tanstack-db/guides/live-queries/composable-queries
title: TanStack DB Live Queries - Composable Queries
description: Composable Queries section of TanStack DB Live Queries
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/live-queries.md
tags:
  - tanstack-db
  - guides
---

# Composable Queries

Build complex queries by composing smaller, reusable parts. This approach makes your queries more maintainable and allows for better performance through caching.

### Conditional Query Building

Build queries based on runtime conditions:

```ts
import { Query, eq } from '@tanstack/db'

function buildUserQuery(options: { activeOnly?: boolean; limit?: number }) {
  let query = new Query().from({ user: usersCollection })
  
  if (options.activeOnly) {
    query = query.where(({ user }) => eq(user.active, true))
  }
  
  if (options.limit) {
    query = query.limit(options.limit)
  }
  
  return query.select(({ user }) => ({
    id: user.id,
    name: user.name,
  }))
}

const activeUsers = createLiveQueryCollection(buildUserQuery({ activeOnly: true, limit: 10 }))
```

### Caching Intermediate Results

The result of a live query collection is a collection itself, and will automatically update when the underlying data changes. This means that you can use the result of a live query collection as a source in another live query collection. This pattern is useful for building complex queries where you want to cache intermediate results to make further queries faster.

```ts
// Base query for active users
const activeUsers = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .where(({ user }) => eq(user.active, true))
)

// Query that depends on active users
const activeUserPosts = createLiveQueryCollection((q) =>
  q
    .from({ user: activeUsers })
    .join({ post: postsCollection }, ({ user, post }) => 
      eq(user.id, post.userId)
    )
    .select(({ user, post }) => ({
      userName: user.name,
      postTitle: post.title,
    }))
)
```

### Reusable Query Definitions

You can use the `Query` class to create reusable query definitions. This is useful for building complex queries where you want to reuse the same query builder instance multiple times throughout your application.

```ts
import { Query, eq } from '@tanstack/db'

// Create a reusable query builder
const userQuery = new Query()
  .from({ user: usersCollection })
  .where(({ user }) => eq(user.active, true))

// Use it in different contexts
const activeUsers = createLiveQueryCollection({
  query: userQuery.select(({ user }) => ({
    id: user.id,
    name: user.name,
  }))
})

// Or as a subquery
const userPosts = createLiveQueryCollection((q) =>
  q
    .from({ activeUser: userQuery })
    .join({ post: postsCollection }, ({ activeUser, post }) => 
      eq(activeUser.id, post.userId)
    )
)
```

### Reusable Callback Functions

Creating reusable query logic is a common pattern that improves code organization and maintainability. The recommended approach is to use callback functions with the `Ref<T>` type rather than trying to type `QueryBuilder` instances directly.

#### The Recommended Pattern

Use `Ref<MyType>` to create reusable filter and transform functions:

```ts
import type { Ref } from '@tanstack/db'
import { eq, gt, and } from '@tanstack/db'

// Create reusable filter callbacks
const isActiveUser = ({ user }: { user: Ref<User> }) =>
  eq(user.active, true)

const isAdultUser = ({ user }: { user: Ref<User> }) =>
  gt(user.age, 18)

const isActiveAdult = ({ user }: { user: Ref<User> }) =>
  and(isActiveUser({ user }), isAdultUser({ user }))

// Use them in queries - they work seamlessly with .where()
const activeAdults = createCollection(liveQueryCollectionOptions({
  query: (q) =>
    q
      .from({ user: usersCollection })
      .where(isActiveUser)
      .where(isAdultUser)
      .select(({ user }) => ({
        id: user.id,
        name: user.name,
        age: user.age,
      }))
}))
```

The callback signature `({ user }: { user: Ref<User> }) => Expression` matches exactly what `.where()` expects, making it type-safe and composable.

#### Chaining Multiple Filters

You can chain multiple reusable filters:

```tsx
import { useLiveQuery } from '@tanstack/react-db'

const { data } = useLiveQuery((q) => {
  return q
    .from({ item: itemsCollection })
    .where(({ item }) => eq(item.id, 1))
    .where(activeItemFilter)      // Reusable filter 1
    .where(verifiedItemFilter)     // Reusable filter 2
    .select(({ item }) => ({ ...item }))
}, [])
```

#### Using with Different Aliases

The pattern works with any table alias:

```ts
const activeFilter = ({ item }: { item: Ref<Item> }) =>
  eq(item.active, true)

// Works with any alias name
const query1 = new Query()
  .from({ item: itemsCollection })
  .where(activeFilter)

const query2 = new Query()
  .from({ i: itemsCollection })
  .where(({ i }) => activeFilter({ item: i }))  // Map the alias
```

#### Callbacks with Multiple Tables

For queries with joins, create callbacks that accept multiple refs:

```ts
const isHighValueCustomer = ({ user, order }: {
  user: Ref<User>
  order: Ref<Order>
}) => and(
  eq(user.active, true),
  gt(order.amount, 1000)
)

// Use directly in where clause
const highValueCustomers = createCollection(liveQueryCollectionOptions({
  query: (q) =>
    q
      .from({ user: usersCollection })
      .join({ order: ordersCollection }, ({ user, order }) =>
        eq(user.id, order.userId)
      )
      .where(isHighValueCustomer)
      .select(({ user, order }) => ({
        userName: user.name,
        orderAmount: order.amount,
      }))
}))
```

#### Why Not Type QueryBuilder?

You might be tempted to create functions that accept and return `QueryBuilder`:

```ts
// ❌ Not recommended - overly complex typing
const applyFilters = <T extends QueryBuilder<unknown>>(query: T): T => {
  return query.where(({ item }) => eq(item.active, true))
}
```

This approach has several issues:

1. **Complex Types**: `QueryBuilder<T>` generic represents the entire query context including base schema, current schema, joins, result types, etc.
2. **Type Inference**: The type changes with every method call, making it impractical to type manually
3. **Limited Flexibility**: Hard to compose multiple filters or use with different table aliases

Instead, use callback functions that work with the `.where()`, `.select()`, and other query methods directly.

#### Reusable Select Transformations

You can also create reusable select projections:

```ts
const basicUserInfo = ({ user }: { user: Ref<User> }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
})

const userWithStats = ({ user }: { user: Ref<User> }) => ({
  ...basicUserInfo({ user }),
  isAdult: gt(user.age, 18),
  isActive: eq(user.active, true),
})

const users = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .select(userWithStats)
)
```

This approach makes your query logic more modular, testable, and reusable across your application.
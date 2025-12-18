---
topic: tanstack-db/guides/live-queries/groupby-and-aggregations
title: TanStack DB Live Queries - groupBy and Aggregations
description: groupBy and Aggregations section of TanStack DB Live Queries
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/live-queries.md
tags:
  - tanstack-db
  - guides
---

# groupBy and Aggregations

Use `groupBy` to group your data and apply aggregate functions. When you use aggregates in `select` without `groupBy`, the entire result set is treated as a single group.

### Method Signature

```ts
groupBy(
  grouper: (row: TRow) => Expression | Expression[]
): Query
```

**Parameters:**
- `grouper` - A callback function that receives the row object and returns the grouping key(s). Can return a single value or an array for multi-column grouping

### Basic Grouping

Group users by their department and count them:

```ts
import { count, avg } from '@tanstack/db'

const departmentStats = createCollection(liveQueryCollectionOptions({
  query: (q) =>
    q
      .from({ user: usersCollection })
      .groupBy(({ user }) => user.departmentId)
      .select(({ user }) => ({
        departmentId: user.departmentId,
        userCount: count(user.id),
        avgAge: avg(user.age),
      }))
}))
```

> [!NOTE]
> In `groupBy` queries, the properties in your `select` clause must either be:
> - An aggregate function (like `count`, `sum`, `avg`)
> - A property that was used in the `groupBy` clause
> 
> You cannot select properties that are neither aggregated nor grouped.

### Multiple Column Grouping

Group by multiple columns by returning an array from the callback:

```ts
const userStats = createCollection(liveQueryCollectionOptions({
  query: (q) =>
    q
      .from({ user: usersCollection })
      .groupBy(({ user }) => [user.departmentId, user.role])
      .select(({ user }) => ({
        departmentId: user.departmentId,
        role: user.role,
        count: count(user.id),
        avgSalary: avg(user.salary),
      }))
}))
```

### Aggregate Functions

Use various aggregate functions to summarize your data:

```ts
import { count, sum, avg, min, max } from '@tanstack/db'

const orderStats = createCollection(liveQueryCollectionOptions({
  query: (q) =>
    q
      .from({ order: ordersCollection })
      .groupBy(({ order }) => order.customerId)
      .select(({ order }) => ({
        customerId: order.customerId,
        totalOrders: count(order.id),
        totalAmount: sum(order.amount),
        avgOrderValue: avg(order.amount),
        minOrder: min(order.amount),
        maxOrder: max(order.amount),
      }))
}))
```

See the [Aggregate Functions](#aggregate-functions) section for a complete list of available aggregate functions.

### Having Clauses

Filter aggregated results using `having` - this is similar to the `where` clause, but is applied after the aggregation has been performed.

#### Method Signature

```ts
having(
  condition: (row: TRow) => Expression<boolean>
): Query
```

**Parameters:**
- `condition` - A callback function that receives the aggregated row object and returns a boolean expression

```ts
const highValueCustomers = createLiveQueryCollection((q) =>
  q
    .from({ order: ordersCollection })
    .groupBy(({ order }) => order.customerId)
    .select(({ order }) => ({
      customerId: order.customerId,
      totalSpent: sum(order.amount),
      orderCount: count(order.id),
    }))
    .having(({ order }) => gt(sum(order.amount), 1000))
)
```

### Implicit Single-Group Aggregation

When you use aggregates without `groupBy`, the entire result set is grouped:

```ts
const overallStats = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .select(({ user }) => ({
      totalUsers: count(user.id),
      avgAge: avg(user.age),
      maxSalary: max(user.salary),
    }))
)
```

This is equivalent to grouping the entire collection into a single group.

### Accessing Grouped Data

Grouped results can be accessed by the group key:

```ts
const deptStats = createCollection(liveQueryCollectionOptions({
  query: (q) =>
    q
      .from({ user: usersCollection })
      .groupBy(({ user }) => user.departmentId)
      .select(({ user }) => ({
        departmentId: user.departmentId,
        count: count(user.id),
      }))
}))

// Access by department ID
const engineeringStats = deptStats.get(1)
```

> **Note**: Grouped results are keyed differently based on the grouping:
> - **Single column grouping**: Keyed by the actual value (e.g., `deptStats.get(1)`)
> - **Multiple column grouping**: Keyed by a JSON string of the grouped values (e.g., `userStats.get('[1,"admin"]')`)
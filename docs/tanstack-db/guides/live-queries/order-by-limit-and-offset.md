---
topic: tanstack-db/guides/live-queries/order-by-limit-and-offset
title: TanStack DB Live Queries - Order By, Limit, and Offset
description: Order By, Limit, and Offset section of TanStack DB Live Queries
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/live-queries.md
tags:
  - tanstack-db
  - guides
---

# Order By, Limit, and Offset

Use `orderBy`, `limit`, and `offset` to control the order and pagination of your results. Ordering is performed incrementally for optimal performance.

### Method Signatures

```ts
orderBy(
  selector: (row: TRow) => Expression,
  direction?: 'asc' | 'desc'
): Query

limit(count: number): Query

offset(count: number): Query
```

**Parameters:**
- `selector` - A callback function that receives the row object and returns the value to sort by
- `direction` - Sort direction: `'asc'` (default) or `'desc'`
- `count` - Number of rows to limit or skip

### Basic Ordering

Sort results by a single column:

```ts
const sortedUsers = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .orderBy(({ user }) => user.name)
    .select(({ user }) => ({
      id: user.id,
      name: user.name,
    }))
)
```

### Multiple Column Ordering

Order by multiple columns:

```ts
const sortedUsers = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .orderBy(({ user }) => user.departmentId, 'asc')
    .orderBy(({ user }) => user.name, 'asc')
    .select(({ user }) => ({
      id: user.id,
      name: user.name,
      departmentId: user.departmentId,
    }))
)
```

### Descending Order

Use `desc` for descending order:

```ts
const recentPosts = createLiveQueryCollection((q) =>
  q
    .from({ post: postsCollection })
    .orderBy(({ post }) => post.createdAt, 'desc')
    .select(({ post }) => ({
      id: post.id,
      title: post.title,
      createdAt: post.createdAt,
    }))
)
```

### Pagination with `limit` and `offset`

Skip results using `offset`:

```ts
const page2Users = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .orderBy(({ user }) => user.name, 'asc')
    .limit(20)
    .offset(20) // Skip first 20 results
    .select(({ user }) => ({
      id: user.id,
      name: user.name,
    }))
)
```
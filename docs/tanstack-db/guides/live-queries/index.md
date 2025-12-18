---
topic: tanstack-db/guides/live-queries
title: TanStack DB Live Queries
description: Overview and table of contents for TanStack DB Live Queries
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/live-queries.md
tags:
  - tanstack-db
  - guides
---

# TanStack DB Live Queries

TanStack DB provides a powerful, type-safe query system that allows you to fetch, filter, transform, and aggregate data from collections using a SQL-like fluent API. All queries are **live** by default, meaning they automatically update when the underlying data changes.

The query system is built around an API similar to SQL query builders like Kysely or Drizzle where you chain methods together to compose your query. The query builder doesn't perform operations in the order of method calls - instead, it composes your query into an optimal incremental pipeline that gets compiled and executed efficiently. Each method returns a new query builder, allowing you to chain operations together.

Live queries resolve to collections that automatically update when their underlying data changes. You can subscribe to changes, iterate over results, and use all the standard collection methods.

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
        email: user.email,
      }))
}))
```

The result types are automatically inferred from your query structure, providing full TypeScript support. When you use a `select` clause, the result type matches your projection. Without `select`, you get the full schema with proper join optionality.

## Contents

- [Table of Contents](./table-of-contents.md)
- [Creating Live Query Collections](./creating-live-query-collections.md)
- [From Clause](./from-clause.md)
- [Where Clauses](./where-clauses.md)
- [Select](./select.md)
- [Joins](./joins.md)
- [Subqueries](./subqueries.md)
- [groupBy and Aggregations](./groupby-and-aggregations.md)
- [findOne](./findone.md)
- [Distinct](./distinct.md)
- [Order By, Limit, and Offset](./order-by-limit-and-offset.md)
- [Composable Queries](./composable-queries.md)
- [Expression Functions Reference](./expression-functions-reference.md)
- [Functional Variants](./functional-variants.md)
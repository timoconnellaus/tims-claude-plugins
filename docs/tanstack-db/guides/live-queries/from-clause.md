---
topic: tanstack-db/guides/live-queries/from-clause
title: TanStack DB Live Queries - From Clause
description: From Clause section of TanStack DB Live Queries
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/live-queries.md
tags:
  - tanstack-db
  - guides
---

# From Clause

The foundation of every query is the `from` method, which specifies the source collection or subquery. You can alias the source using object syntax.

### Method Signature

```ts
from({
  [alias]: Collection | Query,
}): Query
```

**Parameters:**
- `[alias]` - A Collection or Query instance. Note that only a single aliased collection or subquery is allowed in the `from` clause.

### Basic Usage

Start with a basic query that selects all records from a collection:

```ts
const allUsers = createCollection(liveQueryCollectionOptions({
  query: (q) => q.from({ user: usersCollection })
}))
```

The result contains all users with their full schema. You can iterate over the results or access them by key:

```ts
// Get all users as an array
const users = allUsers.toArray

// Get a specific user by ID
const user = allUsers.get(1)

// Check if a user exists
const hasUser = allUsers.has(1)
```

Use aliases to make your queries more readable, especially when working with multiple collections:

```ts
const users = createCollection(liveQueryCollectionOptions({
  query: (q) => q.from({ u: usersCollection })
}))

// Access fields using the alias
const userNames = createCollection(liveQueryCollectionOptions({
  query: (q) =>
    q
      .from({ u: usersCollection })
      .select(({ u }) => ({
        name: u.name,
        email: u.email,
      }))
}))
```
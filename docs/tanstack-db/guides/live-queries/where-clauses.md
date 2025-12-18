---
topic: tanstack-db/guides/live-queries/where-clauses
title: TanStack DB Live Queries - Where Clauses
description: Where Clauses section of TanStack DB Live Queries
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/live-queries.md
tags:
  - tanstack-db
  - guides
---

# Where Clauses

Use `where` clauses to filter your data based on conditions. You can chain multiple `where` calls - they are combined with `and` logic.

The `where` method takes a callback function that receives an object containing your table aliases and returns a boolean expression. You build these expressions using comparison functions like `eq()`, `gt()`, and logical operators like `and()` and `or()`. This declarative approach allows the query system to optimize your filters efficiently. These are described in more detail in the [Expression Functions Reference](#expression-functions-reference) section. This is very similar to how you construct queries using Kysely or Drizzle.

It's important to note that the `where` method is not a function that is executed on each row or the results, its a way to describe the query that will be executed. This declarative approach works well for almost all use cases, but if you need to use a more complex condition, there is the functional variant as `fn.where` which is described in the [Functional Variants](#functional-variants) section.

### Method Signature

```ts
where(
  condition: (row: TRow) => Expression<boolean>
): Query
```

**Parameters:**
- `condition` - A callback function that receives the row object with table aliases and returns a boolean expression

### Basic Filtering

Filter users by a simple condition:

```ts
import { eq } from '@tanstack/db'

const activeUsers = createCollection(liveQueryCollectionOptions({
  query: (q) =>
    q
      .from({ user: usersCollection })
      .where(({ user }) => eq(user.active, true))
}))
```

### Multiple Conditions

Chain multiple `where` calls for AND logic:

```ts
import { eq, gt } from '@tanstack/db'

const adultActiveUsers = createCollection(liveQueryCollectionOptions({
  query: (q) =>
    q
      .from({ user: usersCollection })
      .where(({ user }) => eq(user.active, true))
      .where(({ user }) => gt(user.age, 18))
}))
```

### Complex Conditions

Use logical operators to build complex conditions:

```ts
import { eq, gt, or, and } from '@tanstack/db'

const specialUsers = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .where(({ user }) => 
      and(
        eq(user.active, true),
        or(
          gt(user.age, 25),
          eq(user.role, 'admin')
        )
      )
    )
)
```

### Available Operators

The query system provides several comparison operators:

```ts
import { eq, gt, gte, lt, lte, like, ilike, inArray, and, or, not } from '@tanstack/db'

// Equality
eq(user.id, 1)

// Comparisons
gt(user.age, 18)    // greater than
gte(user.age, 18)   // greater than or equal
lt(user.age, 65)    // less than
lte(user.age, 65)   // less than or equal

// String matching
like(user.name, 'John%')    // case-sensitive pattern matching
ilike(user.name, 'john%')   // case-insensitive pattern matching

// Array membership
inArray(user.id, [1, 2, 3])

// Logical operators
and(condition1, condition2)
or(condition1, condition2)
not(condition)
```

For a complete reference of all available functions, see the [Expression Functions Reference](#expression-functions-reference) section.
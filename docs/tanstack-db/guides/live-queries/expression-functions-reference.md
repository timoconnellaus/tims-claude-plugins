---
topic: tanstack-db/guides/live-queries/expression-functions-reference
title: TanStack DB Live Queries - Expression Functions Reference
description: Expression Functions Reference section of TanStack DB Live Queries
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/live-queries.md
tags:
  - tanstack-db
  - guides
---

# Expression Functions Reference

The query system provides a comprehensive set of functions for filtering, transforming, and aggregating data.

### Comparison Operators

#### `eq(left, right)`
Equality comparison:
```ts
eq(user.id, 1)
eq(user.name, 'John')
```

#### `gt(left, right)`, `gte(left, right)`, `lt(left, right)`, `lte(left, right)`
Numeric, string and date comparisons:
```ts
gt(user.age, 18)
gte(user.salary, 50000)
lt(user.createdAt, new Date('2024-01-01'))
lte(user.rating, 5)
```

#### `inArray(value, array)`
Check if a value is in an array:
```ts
inArray(user.id, [1, 2, 3])
inArray(user.role, ['admin', 'moderator'])
```

#### `like(value, pattern)`, `ilike(value, pattern)`
String pattern matching:
```ts
like(user.name, 'John%')    // Case-sensitive
ilike(user.email, '%@gmail.com')  // Case-insensitive
```

#### `isUndefined(value)`, `isNull(value)`
Check for missing vs null values:
```ts
// Check if a property is missing/undefined
isUndefined(user.profile)

// Check if a value is explicitly null
isNull(user.profile)
```

These functions are particularly important when working with joins and optional properties, as they distinguish between:
- `undefined`: The property is absent or not present
- `null`: The property exists but is explicitly set to null

**Example with joins:**
```ts
// Find users without a matching profile (left join resulted in undefined)
const usersWithoutProfiles = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .leftJoin(
      { profile: profilesCollection },
      ({ user, profile }) => eq(user.id, profile.userId)
    )
    .where(({ profile }) => isUndefined(profile))
)

// Find users with explicitly null bio field
const usersWithNullBio = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .where(({ user }) => isNull(user.bio))
)
```

### Logical Operators

#### `and(...conditions)`
Combine conditions with AND logic:
```ts
and(
  eq(user.active, true),
  gt(user.age, 18),
  eq(user.role, 'user')
)
```

#### `or(...conditions)`
Combine conditions with OR logic:
```ts
or(
  eq(user.role, 'admin'),
  eq(user.role, 'moderator')
)
```

#### `not(condition)`
Negate a condition:
```ts
not(eq(user.active, false))
```

### String Functions

#### `upper(value)`, `lower(value)`
Convert case:
```ts
upper(user.name)  // 'JOHN'
lower(user.email) // 'john@example.com'
```

#### `length(value)`
Get string or array length:
```ts
length(user.name)     // String length
length(user.tags)     // Array length
```

#### `concat(...values)`
Concatenate strings:
```ts
concat(user.firstName, ' ', user.lastName)
concat('User: ', user.name, ' (', user.id, ')')
```

### Mathematical Functions

#### `add(left, right)`
Add two numbers:
```ts
add(user.salary, user.bonus)
```

#### `coalesce(...values)`
Return the first non-null value:
```ts
coalesce(user.displayName, user.name, 'Unknown')
```

### Aggregate Functions

#### `count(value)`
Count non-null values:
```ts
count(user.id)        // Count all users
count(user.postId)    // Count users with posts
```

#### `sum(value)`
Sum numeric values:
```ts
sum(order.amount)
sum(user.salary)
```

#### `avg(value)`
Calculate average:
```ts
avg(user.salary)
avg(order.amount)
```

#### `min(value)`, `max(value)`
Find minimum and maximum values:
```ts
min(user.salary)
max(order.amount)
```

### Function Composition

Functions can be composed and chained:

```ts
// Complex condition
and(
  eq(user.active, true),
  or(
    gt(user.age, 25),
    eq(user.role, 'admin')
  ),
  not(inArray(user.id, bannedUserIds))
)

// Complex transformation
concat(
  upper(user.firstName),
  ' ',
  upper(user.lastName),
  ' (',
  user.id,
  ')'
)

// Complex aggregation
avg(add(user.salary, coalesce(user.bonus, 0)))
```
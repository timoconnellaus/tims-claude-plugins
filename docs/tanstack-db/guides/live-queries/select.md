---
topic: tanstack-db/guides/live-queries/select
title: TanStack DB Live Queries - Select
description: Select section of TanStack DB Live Queries
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/live-queries.md
tags:
  - tanstack-db
  - guides
---

# Select

Use `select` to specify which fields to include in your results and transform your data. Without `select`, you get the full schema.

Similar to the `where` clause, the `select` method takes a callback function that receives an object containing your table aliases and returns an object with the fields you want to include in your results. These can be combined with functions from the [Expression Functions Reference](#expression-functions-reference) section to create computed fields. You can also use the spread operator to include all fields from a table.

### Method Signature

```ts
select(
  projection: (row: TRow) => Record<string, Expression>
): Query
```

**Parameters:**
- `projection` - A callback function that receives the row object with table aliases and returns the selected fields object

### Basic Selects

Select specific fields from your data:

````ts
const userNames = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .select(({ user }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
    }))
)

/*
Result type: { id: number, name: string, email: string }

```ts
for (const row of userNames) {
  console.log(row.name)
}
```
*/
````

### Field Renaming

Rename fields in your results:

```ts
const userProfiles = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .select(({ user }) => ({
      userId: user.id,
      fullName: user.name,
      contactEmail: user.email,
    }))
)
```

### Computed Fields

Create computed fields using expressions:

```ts
import { gt, length } from '@tanstack/db'

const userStats = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .select(({ user }) => ({
      id: user.id,
      name: user.name,
      isAdult: gt(user.age, 18),
      nameLength: length(user.name),
    }))
)
```

### Using Functions and Including All Fields

Transform your data using built-in functions:

````ts
import { concat, upper, gt } from '@tanstack/db'

const formattedUsers = createCollection(liveQueryCollectionOptions({
  query: (q) =>
    q
      .from({ user: usersCollection })
      .select(({ user }) => ({
        ...user, // Include all user fields
        displayName: upper(concat(user.firstName, ' ', user.lastName)),
        isAdult: gt(user.age, 18),
      }))
}))

/*
Result type:
{
  id: number,
  name: string,
  email: string,
  displayName: string,
  isAdult: boolean,
}
*/
````

For a complete list of available functions, see the [Expression Functions Reference](#expression-functions-reference) section.
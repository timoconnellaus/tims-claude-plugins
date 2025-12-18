---
topic: tanstack-db/guides/live-queries/distinct
title: TanStack DB Live Queries - Distinct
description: Distinct section of TanStack DB Live Queries
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/live-queries.md
tags:
  - tanstack-db
  - guides
---

# Distinct

Use `distinct` to remove duplicate rows from your query results based on the selected columns. The `distinct` operator ensures that each unique combination of selected values appears only once in the result set.

> [!IMPORTANT]
> The `distinct` operator requires a `select` clause. You cannot use `distinct` without specifying which columns to select.

### Method Signature

```ts
distinct(): Query
```

### Basic Usage

Get unique values from a single column:

```ts
const uniqueCountries = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .select(({ user }) => ({ country: user.country }))
    .distinct()
)

// Result contains only unique countries
// If you have users from USA, Canada, and UK, the result will have 3 items
```

### Multiple Column Distinct

Get unique combinations of multiple columns:

```ts
const uniqueRoleSalaryPairs = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .select(({ user }) => ({
      role: user.role,
      salary: user.salary,
    }))
    .distinct()
)

// Result contains only unique role-salary combinations
// e.g., Developer-75000, Developer-80000, Manager-90000
```

### Edge Cases

#### Null Values

Null values are treated as distinct values:

```ts
const uniqueValues = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .select(({ user }) => ({ department: user.department }))
    .distinct()
)

// If some users have null departments, null will appear as a distinct value
// Result might be: ['Engineering', 'Marketing', null]
```
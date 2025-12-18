---
topic: tanstack-router/framework/react/api/router/matchrouteoptionstype
title: MatchRouteOptionsType
description: The `MatchRouteOptions` type is used to describe the options that
  can be used when matching a route.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/MatchRouteOptionsType.md
tags:
  - tanstack-router
  - framework
---

The `MatchRouteOptions` type is used to describe the options that can be used when matching a route.

```tsx
interface MatchRouteOptions {
  pending?: boolean
  caseSensitive?: boolean /* @deprecated */
  includeSearch?: boolean
  fuzzy?: boolean
}
```

## MatchRouteOptions properties

The `MatchRouteOptions` type has the following properties:

### `pending` property

- Type: `boolean`
- Optional
- If `true`, will match against pending location instead of the current location

### ~~`caseSensitive`~~ property (deprecated)

- Type: `boolean`
- Optional
- If `true`, will match against the current location with case sensitivity
- Declare case sensitivity in the route definition instead, or globally for all routes using the `caseSensitive` option on the router

### `includeSearch` property

- Type: `boolean`
- Optional
- If `true`, will match against the current location's search params using a deep inclusive check. e.g. `{ a: 1 }` will match for a current location of `{ a: 1, b: 2 }`

### `fuzzy` property

- Type: `boolean`
- Optional
- If `true`, will match against the current location using a fuzzy match. e.g. `/posts` will match for a current location of `/posts/123`
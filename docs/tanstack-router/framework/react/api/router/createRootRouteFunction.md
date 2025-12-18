---
topic: tanstack-router/framework/react/api/router/createrootroutefunction
title: CreateRootRouteFunction
description: The `createRootRoute` function returns a new root route instance. A
  root route instance can then be used to create a route-tree.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/createRootRouteFunction.md
tags:
  - tanstack-router
  - framework
---

The `createRootRoute` function returns a new root route instance. A root route instance can then be used to create a route-tree.

## createRootRoute options

The options that will be used to configure the root route instance.

- Type:

```tsx
Omit<
  RouteOptions,
  | 'path'
  | 'id'
  | 'getParentRoute'
  | 'caseSensitive'
  | 'parseParams'
  | 'stringifyParams'
>
```

- [`RouteOptions`](./RouteOptionsType.md)
- Optional

## createRootRoute returns

A new [`Route`](./RouteType.md) instance.

## Examples

```tsx
import { createRootRoute, createRouter, Outlet } from '@tanstack/react-router'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  // ... root route options
})

const routeTree = rootRoute.addChildren([
  // ... other routes
])

const router = createRouter({
  routeTree,
})
```
---
topic: tanstack-router/framework/react/api/router/createrouterfunction
title: CreateRouterFunction
description: The `createRouter` function accepts a
  [`RouterOptions`](./RouterOptionsType.md) object and creates a new
  [`Router`](./RouterClass.md) instance.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/createRouterFunction.md
tags:
  - tanstack-router
  - framework
---

The `createRouter` function accepts a [`RouterOptions`](./RouterOptionsType.md) object and creates a new [`Router`](./RouterClass.md) instance.

## createRouter options

- Type: [`RouterOptions`](./RouterOptionsType.md)
- Required
- The options that will be used to configure the router instance.

## createRouter returns

- An instance of the [`Router`](./RouterType.md).

## Examples

```tsx
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

export default function App() {
  return <RouterProvider router={router} />
}
```
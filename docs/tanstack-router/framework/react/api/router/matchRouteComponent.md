---
topic: tanstack-router/framework/react/api/router/matchroutecomponent
title: MatchRouteComponent
description: A component version of the `useMatchRoute` hook. It accepts the
  same options as the `useMatchRoute` with additional props to aid in
  conditional rendering.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/matchRouteComponent.md
tags:
  - tanstack-router
  - framework
---

A component version of the `useMatchRoute` hook. It accepts the same options as the `useMatchRoute` with additional props to aid in conditional rendering.

## MatchRoute props

The `MatchRoute` component accepts the same options as the `useMatchRoute` hook with additional props to aid in conditional rendering.

### `...props` prop

- Type: [`UseMatchRouteOptions`](./UseMatchRouteOptionsType.md)

### `children` prop

- Optional
- `React.ReactNode`
  - The component that will be rendered if the route is matched.
- `((params: TParams | false) => React.ReactNode)`
  - A function that will be called with the matched route's params or `false` if no route was matched. This can be useful for components that need to always render, but render different props based on a route match or not.

## MatchRoute returns

Either the `children` prop or the return value of the `children` function.

## Examples

```tsx
import { MatchRoute } from '@tanstack/react-router'

function Component() {
  return (
    <div>
      <MatchRoute to="/posts/$postId" params={{ postId: '123' }} pending>
        {(match) => <Spinner show={!!match} wait="delay-50" />}
      </MatchRoute>
    </div>
  )
}
```
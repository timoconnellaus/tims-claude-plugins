---
topic: tanstack-router/framework/react/api/router/useawaitedhook
title: UseAwaitedHook
description: The `useAwaited` method is a hook that suspends until the provided
  promise is resolved or rejected.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/useAwaitedHook.md
tags:
  - tanstack-router
  - framework
---

The `useAwaited` method is a hook that suspends until the provided promise is resolved or rejected.

## useAwaited options

The `useAwaited` hook accepts a single argument, an `options` object.

### `options.promise` option

- Type: `Promise<T>`
- Required
- The deferred promise to await.

## useAwaited returns

- Throws an error if the promise is rejected.
- Suspends (throws a promise) if the promise is pending.
- Returns the resolved value of a deferred promise if the promise is resolved.

## Examples

```tsx
import { useAwaited } from '@tanstack/react-router'

function Component() {
  const { deferredPromise } = route.useLoaderData()

  const data = useAwaited({ promise: myDeferredPromise })
  // ...
}
```
---
topic: tanstack-router/framework/react/api/router/isnotfoundfunction
title: IsNotFoundFunction
description: The `isNotFound` function can be used to determine if an object is
  a [`NotFoundError`](./NotFoundErrorType.md) object.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/isNotFoundFunction.md
tags:
  - tanstack-router
  - framework
---

The `isNotFound` function can be used to determine if an object is a [`NotFoundError`](./NotFoundErrorType.md) object.

## isNotFound options

The `isNotFound` function accepts a single argument, an `input`.

### `input` option

- Type: `unknown`
- Required
- An object to check if it is a [`NotFoundError`](./NotFoundErrorType.md).

## isNotFound returns

- Type: `boolean`
- `true` if the object is a [`NotFoundError`](./NotFoundErrorType.md).
- `false` if the object is not a [`NotFoundError`](./NotFoundErrorType.md).

## Examples

```tsx
import { isNotFound } from '@tanstack/react-router'

function somewhere(obj: unknown) {
  if (isNotFound(obj)) {
    // ...
  }
}
```
---
topic: tanstack-router/framework/react/api/router/linkcomponent
title: LinkComponent
description: The `Link` component is a component that can be used to create a
  link that can be used to navigate to a new location. This includes changes to
  the pathname, search params, hash, and location state.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/linkComponent.md
tags:
  - tanstack-router
  - framework
---

The `Link` component is a component that can be used to create a link that can be used to navigate to a new location. This includes changes to the pathname, search params, hash, and location state.

## Link props

The `Link` component accepts the following props:

### `...props`

- Type: `LinkProps & React.RefAttributes<HTMLAnchorElement>`
- [`LinkProps`](./LinkPropsType.md)

## Link returns

An anchor element that can be used to navigate to a new location.

## Examples

```tsx
import { Link } from '@tanstack/react-router'

function Component() {
  return (
    <Link
      to="/somewhere/$somewhereId"
      params={{ somewhereId: 'baz' }}
      search={(prev) => ({ ...prev, foo: 'bar' })}
    >
      Click me
    </Link>
  )
}
```
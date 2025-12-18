---
topic: tanstack-router/framework/react/api/router/navigatecomponent
title: NavigateComponent
description: The `Navigate` component is a component that can be used to
  navigate to a new location when rendered. This includes changes to the
  pathname, search params, hash, and location state. The underlying nav
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/navigateComponent.md
tags:
  - tanstack-router
  - framework
---

The `Navigate` component is a component that can be used to navigate to a new location when rendered. This includes changes to the pathname, search params, hash, and location state. The underlying navigation will happen inside of a `useEffect` hook when successfully rendered.

## Navigate props

The `Navigate` component accepts the following props:

### `...options`

- Type: [`NavigateOptions`](./NavigateOptionsType.md)

## Navigate returns

- `null`
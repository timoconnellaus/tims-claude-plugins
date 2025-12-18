---
topic: tanstack-router/framework/react/api/router/activelinkoptionstype
title: ActiveLinkOptionsType
description: The `ActiveLinkOptions` type extends the
  [`LinkOptions`](./LinkOptionsType.md) type and contains additional options
  that can be used to describe how a link should be styled when it is active.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/ActiveLinkOptionsType.md
tags:
  - tanstack-router
  - framework
---

The `ActiveLinkOptions` type extends the [`LinkOptions`](./LinkOptionsType.md) type and contains additional options that can be used to describe how a link should be styled when it is active.

```tsx
type ActiveLinkOptions = LinkOptions & {
  activeProps?:
    | React.AnchorHTMLAttributes<HTMLAnchorElement>
    | (() => React.AnchorHTMLAttributes<HTMLAnchorElement>)
  inactiveProps?:
    | React.AnchorHTMLAttributes<HTMLAnchorElement>
    | (() => React.AnchorHTMLAttributes<HTMLAnchorElement>)
}
```

## ActiveLinkOptions properties

The `ActiveLinkOptions` object accepts/contains the following properties:

### `activeProps`

- `React.AnchorHTMLAttributes<HTMLAnchorElement>`
- Optional
- The props that will be applied to the anchor element when the link is active

### `inactiveProps`

- Type: `React.AnchorHTMLAttributes<HTMLAnchorElement>`
- Optional
- The props that will be applied to the anchor element when the link is inactive
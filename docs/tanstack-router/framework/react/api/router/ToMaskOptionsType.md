---
topic: tanstack-router/framework/react/api/router/tomaskoptionstype
title: ToMaskOptionsType
description: The `ToMaskOptions` type extends the
  [`ToOptions`](./ToOptionsType.md) type and describes additional options
  available when using route masks.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/ToMaskOptionsType.md
tags:
  - tanstack-router
  - framework
---

The `ToMaskOptions` type extends the [`ToOptions`](./ToOptionsType.md) type and describes additional options available when using route masks.

```tsx
type ToMaskOptions = ToOptions & {
  unmaskOnReload?: boolean
}
```

- [`ToOptions`](./ToOptionsType.md)
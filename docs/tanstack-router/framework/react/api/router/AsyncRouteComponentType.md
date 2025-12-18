---
topic: tanstack-router/framework/react/api/router/asyncroutecomponenttype
title: AsyncRouteComponentType
description: The `AsyncRouteComponent` type is used to describe a code-split
  route component that can be preloaded using a `component.preload()` method.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/AsyncRouteComponentType.md
tags:
  - tanstack-router
  - framework
---

The `AsyncRouteComponent` type is used to describe a code-split route component that can be preloaded using a `component.preload()` method.

```tsx
type AsyncRouteComponent<TProps> = SyncRouteComponent<TProps> & {
  preload?: () => Promise<void>
}
```
---
topic: tanstack-router/framework/react/api/router/historystateinterface
title: HistoryStateInterface
description: The `HistoryState` interface is an interface exported by the
  `history` package that describes the shape of the state object that can be
  used in conjunction with the `history` package and the `window.l
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/historyStateInterface.md
tags:
  - tanstack-router
  - framework
---

The `HistoryState` interface is an interface exported by the `history` package that describes the shape of the state object that can be used in conjunction with the `history` package and the `window.location` API.

You can extend this interface to add additional properties to the state object across your application.

```tsx
// src/main.tsx
declare module '@tanstack/react-router' {
  // ...

  interface HistoryState {
    additionalRequiredProperty: number
    additionalProperty?: string
  }
}
```
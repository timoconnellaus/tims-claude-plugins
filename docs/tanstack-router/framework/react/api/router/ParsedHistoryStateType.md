---
topic: tanstack-router/framework/react/api/router/parsedhistorystatetype
title: ParsedHistoryStateType
description: The `ParsedHistoryState` type represents a parsed state object.
  Additionally to `HistoryState`, it contains the index and the unique key of
  the route.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/ParsedHistoryStateType.md
tags:
  - tanstack-router
  - framework
---

The `ParsedHistoryState` type represents a parsed state object. Additionally to `HistoryState`, it contains the index and the unique key of the route.

```tsx
export type ParsedHistoryState = HistoryState & {
  key?: string // TODO: Remove in v2 - use __TSR_key instead
  __TSR_key?: string
  __TSR_index: number
}
```
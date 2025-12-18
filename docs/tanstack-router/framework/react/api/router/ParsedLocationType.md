---
topic: tanstack-router/framework/react/api/router/parsedlocationtype
title: ParsedLocationType
description: The `ParsedLocation` type represents a parsed location in TanStack
  Router. It contains a lot of useful information about the current location,
  including the pathname, search params, hash, location sta
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/ParsedLocationType.md
tags:
  - tanstack-router
  - framework
---

The `ParsedLocation` type represents a parsed location in TanStack Router. It contains a lot of useful information about the current location, including the pathname, search params, hash, location state, and route masking information.

```tsx
interface ParsedLocation {
  href: string
  pathname: string
  search: TFullSearchSchema
  searchStr: string
  state: ParsedHistoryState
  hash: string
  maskedLocation?: ParsedLocation
  unmaskOnReload?: boolean
}
```
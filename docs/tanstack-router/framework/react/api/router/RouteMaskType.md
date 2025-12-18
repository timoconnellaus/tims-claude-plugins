---
topic: tanstack-router/framework/react/api/router/routemasktype
title: RouteMaskType
description: The `RouteMask` type extends the [`ToOptions`](./ToOptionsType.md)
  type and has other the necessary properties to create a route mask.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/RouteMaskType.md
tags:
  - tanstack-router
  - framework
---

The `RouteMask` type extends the [`ToOptions`](./ToOptionsType.md) type and has other the necessary properties to create a route mask.

## RouteMask properties

The `RouteMask` type accepts an object with the following properties:

### `...ToOptions`

- Type: [`ToOptions`](./ToOptionsType.md)
- Required
- The options that will be used to configure the route mask

### `options.routeTree`

- Type: `TRouteTree`
- Required
- The route tree that this route mask will support

### `options.unmaskOnReload`

- Type: `boolean`
- Optional
- If `true`, the route mask will be removed when the page is reloaded
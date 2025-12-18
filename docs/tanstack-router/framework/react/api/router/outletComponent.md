---
topic: tanstack-router/framework/react/api/router/outletcomponent
title: OutletComponent
description: The `Outlet` component is a component that can be used to render
  the next child route of a parent route.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/outletComponent.md
tags:
  - tanstack-router
  - framework
---

The `Outlet` component is a component that can be used to render the next child route of a parent route.

## Outlet props

The `Outlet` component does not accept any props.

## Outlet returns

- If matched, the child route match's `component`/`errorComponent`/`pendingComponent`/`notFoundComponent`.
- If not matched, `null`.
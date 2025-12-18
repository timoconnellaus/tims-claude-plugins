---
topic: tanstack-router/framework/react/api/router/clientonlycomponent
title: ClientOnlyComponent
description: "The `ClientOnly` component is used to render a components only in
  the client, without breaking the server-side rendering due to hydration
  errors. It accepts a `fallback` prop that will be rendered if "
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/clientOnlyComponent.md
tags:
  - tanstack-router
  - framework
---

The `ClientOnly` component is used to render a components only in the client, without breaking the server-side rendering due to hydration errors. It accepts a `fallback` prop that will be rendered if the JS is not yet loaded in the client.

## Props

The `ClientOnly` component accepts the following props:

### `props.fallback` prop

The fallback component to render if the JS is not yet loaded in the client.

### `props.children` prop

The component to render if the JS is loaded in the client.

## Returns

- Returns the component's children if the JS is loaded in the client.
- Returns the `fallback` component if the JS is not yet loaded in the client.

## Examples

```tsx
// src/routes/dashboard.tsx
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import {
  Charts,
  FallbackCharts,
} from './charts-that-break-server-side-rendering'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
  // ... other route options
})

function Dashboard() {
  return (
    <div>
      <p>Dashboard</p>
      <ClientOnly fallback={<FallbackCharts />}>
        <Charts />
      </ClientOnly>
    </div>
  )
}
```
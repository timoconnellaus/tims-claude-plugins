---
topic: tanstack-router/framework/react/api/router/errorcomponentcomponent
title: ErrorComponentComponent
description: The `ErrorComponent` component is a component that renders an error
  message and optionally the error's message.
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/api/router/errorComponentComponent.md
tags:
  - tanstack-router
  - framework
---

The `ErrorComponent` component is a component that renders an error message and optionally the error's message.

## ErrorComponent props

The `ErrorComponent` component accepts the following props:

### `props.error` prop

- Type: `TError` (defaults to `Error`)
- The error that was thrown by the component's children

### `props.info` prop

- Type: `{ componentStack: string }`
- Optional
- Additional information about where the error was thrown, such as the React component stack trace.

### `props.reset` prop

- Type: `() => void`
- A function to programmatically reset the error state

## ErrorComponent returns

- Returns a formatted error message with the error's message if it exists.
- The error message can be toggled by clicking the "Show Error" button.
- By default, the error message will be shown in development.
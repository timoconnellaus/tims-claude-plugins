---
topic: ink/hooks/use-focus
title: useFocus Hook
description: A component that uses the `useFocus` hook becomes "focusable" to
  Ink, so when the user presses <kbd>Tab</kbd>, Ink will switch focus to this
  component.
version: 5.x
sourceUrl: https://github.com/vadimdemedes/ink
tags:
  - ink
  - hooks
---

### useFocus(options?)

A component that uses the `useFocus` hook becomes "focusable" to Ink, so when the user presses <kbd>Tab</kbd>, Ink will switch focus to this component.
If there are multiple components that execute the `useFocus` hook, focus will be given to them in the order in which these components are rendered.
This hook returns an object with an `isFocused` boolean property, which determines whether this component is focused.
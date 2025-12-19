---
topic: ink/api/measure-element
title: measureElement() API
description: Measure the dimensions of a particular `<Box>` element.
version: 5.x
sourceUrl: https://github.com/vadimdemedes/ink
tags:
  - ink
  - api
---

#### measureElement(ref)

Measure the dimensions of a particular `<Box>` element.
Returns an object with `width` and `height` properties.
This function is useful when your component needs to know the amount of available space it has. You can use it when you need to change the layout based on the length of its content.

**Note:** `measureElement()` returns correct results only after the initial render, when the layout has been calculated. Until then, `width` and `height` equal zero. It's recommended to call `measureElement()` in a `useEffect` hook, which fires after the component has rendered.
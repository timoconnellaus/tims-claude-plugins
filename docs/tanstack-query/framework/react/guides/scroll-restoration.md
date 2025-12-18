---
topic: tanstack-query/framework/react/guides/scroll-restoration
title: Scroll Restoration
description: "Traditionally, when you navigate to a previously visited page on a
  web browser, you would find that the page would be scrolled to the exact
  position where you were before you navigated away from that "
version: latest
sourceUrl: https://github.com/tanstack/query/blob/main/docs/framework/react/guides/scroll-restoration.md
tags:
  - tanstack-query
  - framework
---

Traditionally, when you navigate to a previously visited page on a web browser, you would find that the page would be scrolled to the exact position where you were before you navigated away from that page. This is called **scroll restoration** and has been in a bit of a regression since web applications have started moving towards client side data fetching. With TanStack Query however, that's no longer the case.

Out of the box, "scroll restoration" for all queries (including paginated and infinite queries) Just Works™️ in TanStack Query. The reason for this is that query results are cached and able to be retrieved synchronously when a query is rendered. As long as your queries are being cached long enough (the default time is 5 minutes) and have not been garbage collected, scroll restoration will work out of the box all the time.
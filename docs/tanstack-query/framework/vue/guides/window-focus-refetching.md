---
topic: tanstack-query/framework/vue/guides/window-focus-refetching
title: Window Focus Refetching
description: "[//]: # 'Example'"
version: latest
sourceUrl: https://github.com/tanstack/query/blob/main/docs/framework/vue/guides/window-focus-refetching.md
tags:
  - tanstack-query
  - framework
---

[//]: # 'Example'

```js
const vueQueryPluginOptions: VueQueryPluginOptions = {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  },
}
app.use(VueQueryPlugin, vueQueryPluginOptions)
```

[//]: # 'Example'
[//]: # 'ReactNative'
[//]: # 'ReactNative'
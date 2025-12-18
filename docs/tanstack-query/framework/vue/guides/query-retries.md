---
topic: tanstack-query/framework/vue/guides/query-retries
title: Query Retries
description: "[//]: # 'Example'"
version: latest
sourceUrl: https://github.com/tanstack/query/blob/main/docs/framework/vue/guides/query-retries.md
tags:
  - tanstack-query
  - framework
---

[//]: # 'Example'

```tsx
import { useQuery } from '@tanstack/vue-query'

// Make a specific query retry a certain number of times
const result = useQuery({
  queryKey: ['todos', 1],
  queryFn: fetchTodoListPage,
  retry: 10, // Will retry failed requests 10 times before displaying an error
})
```

[//]: # 'Example'
[//]: # 'Example2'

```ts
import { VueQueryPlugin } from '@tanstack/vue-query'

const vueQueryPluginOptions = {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
    },
  },
}
app.use(VueQueryPlugin, vueQueryPluginOptions)
```

[//]: # 'Example2'
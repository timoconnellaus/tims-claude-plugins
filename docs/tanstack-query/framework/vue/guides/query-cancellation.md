---
topic: tanstack-query/framework/vue/guides/query-cancellation
title: Query Cancellation
description: "[//]: # 'Example7'"
version: latest
sourceUrl: https://github.com/tanstack/query/blob/main/docs/framework/vue/guides/query-cancellation.md
tags:
  - tanstack-query
  - framework
---

[//]: # 'Example7'

```ts
const query = useQuery({
  queryKey: ['todos'],
  queryFn: async ({ signal }) => {
    const resp = await fetch('/todos', { signal })
    return resp.json()
  },
})

const queryClient = useQueryClient()

function onButtonClick() {
  queryClient.cancelQueries({ queryKey: ['todos'] })
}
```

[//]: # 'Example7'
---
topic: tanstack-query/framework/vue/guides/query-keys
title: Query Keys
description: "[//]: # 'Example5'"
version: latest
sourceUrl: https://github.com/tanstack/query/blob/main/docs/framework/vue/guides/query-keys.md
tags:
  - tanstack-query
  - framework
---

[//]: # 'Example5'

```ts
import type { Ref } from 'vue'

function useTodos(todoId: Ref<string>) {
  const queryKey = ['todos', todoId]
  return useQuery({
    queryKey,
    queryFn: () => fetchTodoById(todoId.value),
  })
}
```

[//]: # 'Example5'
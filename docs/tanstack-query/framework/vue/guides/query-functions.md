---
topic: tanstack-query/framework/vue/guides/query-functions
title: Query Functions
description: "[//]: # 'Example4'"
version: latest
sourceUrl: https://github.com/tanstack/query/blob/main/docs/framework/vue/guides/query-functions.md
tags:
  - tanstack-query
  - framework
---

[//]: # 'Example4'

```js
const result = useQuery({
  queryKey: ['todos', { status, page }],
  queryFn: fetchTodoList,
})

// Access the key, status and page variables in your query function!
function fetchTodoList({ queryKey }) {
  const [_key, { status, page }] = queryKey
  return new Promise()
}
```

[//]: # 'Example4'
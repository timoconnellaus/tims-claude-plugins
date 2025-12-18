---
topic: tanstack-query/framework/vue/guides/invalidations-from-mutations
title: Invalidations From Mutations
description: "[//]: # 'Example2'"
version: latest
sourceUrl: https://github.com/tanstack/query/blob/main/docs/framework/vue/guides/invalidations-from-mutations.md
tags:
  - tanstack-query
  - framework
---

[//]: # 'Example2'

```tsx
import { useMutation, useQueryClient } from '@tanstack/vue-query'

const queryClient = useQueryClient()

// When this mutation succeeds, invalidate any queries with the `todos` or `reminders` query key
const mutation = useMutation({
  mutationFn: addTodo,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] })
    queryClient.invalidateQueries({ queryKey: ['reminders'] })
  },
})
```

[//]: # 'Example2'
---
topic: tanstack-query/framework/vue/quick-start
title: Quick Start
description: "[//]: # 'Example' If you're looking for a fully functioning
  example, please have a look at our [basic codesandbox
  example](./examples/basic)"
version: latest
sourceUrl: https://github.com/tanstack/query/blob/main/docs/framework/vue/quick-start.md
tags:
  - tanstack-query
  - framework
---

[//]: # 'Example'

If you're looking for a fully functioning example, please have a look at our [basic codesandbox example](./examples/basic)

```vue
<script setup>
import { useQueryClient, useQuery, useMutation } from '@tanstack/vue-query'

// Access QueryClient instance
const queryClient = useQueryClient()

// Query
const { isPending, isError, data, error } = useQuery({
  queryKey: ['todos'],
  queryFn: getTodos,
})

// Mutation
const mutation = useMutation({
  mutationFn: postTodo,
  onSuccess: () => {
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['todos'] })
  },
})

function onButtonClick() {
  mutation.mutate({
    id: Date.now(),
    title: 'Do Laundry',
  })
}
</script>

<template>
  <span v-if="isPending">Loading...</span>
  <span v-else-if="isError">Error: {{ error.message }}</span>
  <!-- We can assume by this point that `isSuccess === true` -->
  <ul v-else>
    <li v-for="todo in data" :key="todo.id">{{ todo.title }}</li>
  </ul>
  <button @click="onButtonClick">Add Todo</button>
</template>
```

[//]: # 'Example'
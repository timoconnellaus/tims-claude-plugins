---
topic: tanstack-query/framework/vue/guides/infinite-queries
title: Infinite Queries
description: "[//]: # 'Example'"
version: latest
sourceUrl: https://github.com/tanstack/query/blob/main/docs/framework/vue/guides/infinite-queries.md
tags:
  - tanstack-query
  - framework
---

[//]: # 'Example'

```vue
<script setup>
import { useInfiniteQuery } from '@tanstack/vue-query'

const fetchProjects = async ({ pageParam = 0 }) => {
  const res = await fetch('/api/projects?cursor=' + pageParam)
  return res.json()
}

const {
  data,
  error,
  fetchNextPage,
  hasNextPage,
  isFetching,
  isFetchingNextPage,
  isPending,
  isError,
} = useInfiniteQuery({
  queryKey: ['projects'],
  queryFn: fetchProjects,
  getNextPageParam: (lastPage, pages) => lastPage.nextCursor,
})
</script>

<template>
  <span v-if="isPending">Loading...</span>
  <span v-else-if="isError">Error: {{ error.message }}</span>
  <div v-else-if="data">
    <span v-if="isFetching && !isFetchingNextPage">Fetching...</span>
    <ul v-for="(group, index) in data.pages" :key="index">
      <li v-for="project in group.projects" :key="project.id">
        {{ project.name }}
      </li>
    </ul>
    <button
      @click="() => fetchNextPage()"
      :disabled="!hasNextPage || isFetchingNextPage"
    >
      <span v-if="isFetchingNextPage">Loading more...</span>
      <span v-else-if="hasNextPage">Load More</span>
      <span v-else>Nothing more to load</span>
    </button>
  </div>
</template>
```

[//]: # 'Example'
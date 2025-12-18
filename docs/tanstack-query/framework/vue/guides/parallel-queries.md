---
topic: tanstack-query/framework/vue/guides/parallel-queries
title: Parallel Queries
description: "[//]: # 'Example'"
version: latest
sourceUrl: https://github.com/tanstack/query/blob/main/docs/framework/vue/guides/parallel-queries.md
tags:
  - tanstack-query
  - framework
---

[//]: # 'Example'

```vue
<script setup lang="ts">
// The following queries will execute in parallel
const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: fetchTeams })
const projectsQuery = useQuery({
  queryKey: ['projects'],
  queryFn: fetchProjects,
})
</script>
```

[//]: # 'Example'
[//]: # 'Info'
[//]: # 'Info'
[//]: # 'Example2'

```js
const users = computed(...)
const queries = computed(() => users.value.map(user => {
    return {
      queryKey: ['user', user.id],
      queryFn: () => fetchUserById(user.id),
    }
  })
);
const userQueries = useQueries({queries: queries})
```

[//]: # 'Example2'
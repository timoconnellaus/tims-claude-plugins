---
topic: tanstack-query/framework/angular/guides/queries
title: Queries
description: "[//]: # 'Example'"
version: latest
sourceUrl: https://github.com/tanstack/query/blob/main/docs/framework/angular/guides/queries.md
tags:
  - tanstack-query
  - framework
---

[//]: # 'Example'

```ts
import { injectQuery } from '@tanstack/angular-query-experimental'

export class TodosComponent {
  info = injectQuery(() => ({ queryKey: ['todos'], queryFn: fetchTodoList }))
}
```

[//]: # 'Example'
[//]: # 'Example2'

```ts
result = injectQuery(() => ({ queryKey: ['todos'], queryFn: fetchTodoList }))
```

[//]: # 'Example2'
[//]: # 'Example3'

```angular-ts
@Component({
  selector: 'todos',
  template: `
    @if (todos.isPending()) {
      <span>Loading...</span>
    } @else if (todos.isError()) {
      <span>Error: {{ todos.error()?.message }}</span>
    } @else {
      <!-- We can assume by this point that status === 'success' -->
      @for (todo of todos.data(); track todo.id) {
        <li>{{ todo.title }}</li>
      } @empty {
        <li>No todos found</li>
      }
    }
  `,
})
export class PostsComponent {
  todos = injectQuery(() => ({
    queryKey: ['todos'],
    queryFn: fetchTodoList,
  }))
}
```

[//]: # 'Example3'

If booleans aren't your thing, you can always use the `status` state as well:

[//]: # 'Example4'

```angular-ts
@Component({
  selector: 'todos',
  template: `
    @switch (todos.status()) {
      @case ('pending') {
        <span>Loading...</span>
      }
      @case ('error') {
        <span>Error: {{ todos.error()?.message }}</span>
      }
      <!-- also status === 'success', but "else" logic works, too -->
      @default {
        <ul>
          @for (todo of todos.data(); track todo.id) {
            <li>{{ todo.title }}</li>
          } @empty {
            <li>No todos found</li>
          }
        </ul>
      }
    }
  `,
})
class TodosComponent {}
```

[//]: # 'Example4'
[//]: # 'Materials'
[//]: # 'Materials'
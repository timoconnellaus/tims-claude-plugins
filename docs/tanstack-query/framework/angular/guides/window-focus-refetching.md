---
topic: tanstack-query/framework/angular/guides/window-focus-refetching
title: Window Focus Refetching
description: "[//]: # 'Example'"
version: latest
sourceUrl: https://github.com/tanstack/query/blob/main/docs/framework/angular/guides/window-focus-refetching.md
tags:
  - tanstack-query
  - framework
---

[//]: # 'Example'

```ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideTanStackQuery(
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false, // default: true
          },
        },
      }),
    ),
  ],
}
```

[//]: # 'Example'
[//]: # 'Example2'

```ts
injectQuery(() => ({
  queryKey: ['todos'],
  queryFn: fetchTodos,
  refetchOnWindowFocus: false,
}))
```

[//]: # 'Example2'
[//]: # 'ReactNative'
[//]: # 'ReactNative'
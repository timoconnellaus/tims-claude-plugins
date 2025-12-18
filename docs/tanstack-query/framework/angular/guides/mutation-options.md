---
topic: tanstack-query/framework/angular/guides/mutation-options
title: Mutation Options
description: One of the best ways to share mutation options between multiple
  places, is to use the `mutationOptions` helper. At runtime, this helper just
  returns whatever you pass into it, but it has a lot of adva
version: latest
sourceUrl: https://github.com/tanstack/query/blob/main/docs/framework/angular/guides/mutation-options.md
tags:
  - tanstack-query
  - framework
---

One of the best ways to share mutation options between multiple places,
is to use the `mutationOptions` helper. At runtime, this helper just returns whatever you pass into it,
but it has a lot of advantages when using it [with TypeScript](../typescript#typing-query-options.md).
You can define all possible options for a mutation in one place,
and you'll also get type inference and type safety for all of them.

```ts
export class QueriesService {
  private http = inject(HttpClient)

  updatePost(id: number) {
    return mutationOptions({
      mutationFn: (post: Post) => Promise.resolve(post),
      mutationKey: ['updatePost', id],
      onSuccess: (newPost) => {
        //           ^? newPost: Post
        this.queryClient.setQueryData(['posts', id], newPost)
      },
    })
  }
}
```
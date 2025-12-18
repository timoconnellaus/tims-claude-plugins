---
topic: tanstack-db/guides/live-queries/joins
title: TanStack DB Live Queries - Joins
description: Joins section of TanStack DB Live Queries
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/live-queries.md
tags:
  - tanstack-db
  - guides
---

# Joins

Use `join` to combine data from multiple collections. Joins default to `left` join type and only support equality conditions.

Joins in TanStack DB are a way to combine data from multiple collections, and are conceptually very similar to SQL joins. When two collections are joined, the result is a new collection that contains the combined data as single rows. The new collection is a live query collection, and will automatically update when the underlying data changes.

A `join` without a `select` will return row objects that are namespaced with the aliases of the joined collections.

The result type of a join will take into account the join type, with the optionality of the joined fields being determined by the join type.

> [!NOTE]
> We are working on an `include` system that will enable joins that project to a hierarchical object. For example an `issue` row could have a `comments` property that is an array of `comment` rows.
> See [this issue](https://github.com/TanStack/db/issues/288) for more details.

### Method Signature

```ts
join(
  { [alias]: Collection | Query },
  condition: (row: TRow) => Expression<boolean>, // Must be an `eq` condition
  joinType?: 'left' | 'right' | 'inner' | 'full'
): Query
```

**Parameters:**
- `aliases` - An object where keys are alias names and values are collections or subqueries to join
- `condition` - A callback function that receives the combined row object and returns an equality condition
- `joinType` - Optional join type: `'left'` (default), `'right'`, `'inner'`, or `'full'`

### Basic Joins

Join users with their posts:

````ts
const userPosts = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .join({ post: postsCollection }, ({ user, post }) => 
      eq(user.id, post.userId)
    )
)

/*
Result type: 
{ 
  user: User,
  post?: Post, // post is optional because it is a left join
}

```ts
for (const row of userPosts) {
  console.log(row.user.name, row.post?.title)
}
```
*/
````

### Join Types

Specify the join type as the third parameter:

```ts
const activeUserPosts = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .join(
      { post: postsCollection }, 
      ({ user, post }) => eq(user.id, post.userId),
      'inner', // `inner`, `left`, `right` or `full`
    )
)
```

Or using the aliases `leftJoin`, `rightJoin`, `innerJoin` and `fullJoin` methods:

### Left Join
```ts
// Left join - all users, even without posts
const allUsers = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .leftJoin(
      { post: postsCollection }, 
      ({ user, post }) => eq(user.id, post.userId),
    )
)

/*
Result type:
{
  user: User,
  post?: Post, // post is optional because it is a left join
}
*/
```

### Right Join

```ts
// Right join - all posts, even without users
const allPosts = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .rightJoin(
      { post: postsCollection }, 
      ({ user, post }) => eq(user.id, post.userId),
    )
)

/*
Result type:
{
  user?: User, // user is optional because it is a right join
  post: Post,
}
*/
```

### Inner Join

```ts
// Inner join - only matching records
const activeUserPosts = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .innerJoin(
      { post: postsCollection }, 
      ({ user, post }) => eq(user.id, post.userId),
    )
)

/*
Result type:
{
  user: User,
  post: Post,
}
*/
```

### Full Join

```ts
// Full join - all users and all posts
const allUsersAndPosts = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .fullJoin(
      { post: postsCollection }, 
      ({ user, post }) => eq(user.id, post.userId),
    )
)

/*
Result type:
{
  user?: User, // user is optional because it is a full join
  post?: Post, // post is optional because it is a full join
}
*/
```

### Multiple Joins

Chain multiple joins in a single query:

```ts
const userPostComments = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    .join({ post: postsCollection }, ({ user, post }) => 
      eq(user.id, post.userId)
    )
    .join({ comment: commentsCollection }, ({ post, comment }) => 
      eq(post.id, comment.postId)
    )
    .select(({ user, post, comment }) => ({
      userName: user.name,
      postTitle: post.title,
      commentText: comment.text,
    }))
)
```
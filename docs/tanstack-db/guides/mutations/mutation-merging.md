---
topic: tanstack-db/guides/mutations/mutation-merging
title: TanStack DB Mutations - Mutation Merging
description: Mutation Merging section of TanStack DB Mutations
version: beta
sourceUrl: https://github.com/tanstack/db/blob/main/docs/guides/mutations.md
tags:
  - tanstack-db
  - guides
---

# Mutation Merging

When multiple mutations operate on the same item within a transaction, TanStack DB intelligently merges them to:
- **Reduce network traffic**: Fewer mutations sent to the server
- **Preserve user intent**: Final state matches what user expects
- **Maintain UI consistency**: Local state always reflects user actions

The merging behavior follows a truth table based on the mutation types:

| Existing → New      | Result    | Description                                       |
| ------------------- | --------- | ------------------------------------------------- |
| **insert + update** | `insert`  | Keeps insert type, merges changes, empty original |
| **insert + delete** | _removed_ | Mutations cancel each other out                   |
| **update + delete** | `delete`  | Delete dominates                                  |
| **update + update** | `update`  | Union changes, keep first original                |

> [!NOTE]
> Attempting to insert or delete the same item multiple times within a transaction will throw an error.
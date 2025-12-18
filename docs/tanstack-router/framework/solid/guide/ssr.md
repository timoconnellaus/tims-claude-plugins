---
topic: tanstack-router/framework/solid/guide/ssr
title: Ssr
description: "[//]: # 'ClientEntryFileExample'"
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/solid/guide/ssr.md
tags:
  - tanstack-router
  - framework
---

[//]: # 'ClientEntryFileExample'

```tsx
// src/entry-client.tsx
import { hydrate } from 'solid-js/web'
import { RouterClient } from '@tanstack/solid-router/ssr/client'
import { createRouter } from './router'

const router = createRouter()

hydrate(() => <RouterClient router={router} />, document.body)
```

[//]: # 'ClientEntryFileExample'
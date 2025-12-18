---
topic: tanstack-router/framework/solid/guide/custom-link
title: Custom Link
description: "[//]: # 'BasicExampleImplementation'"
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/solid/guide/custom-link.md
tags:
  - tanstack-router
  - framework
---

[//]: # 'BasicExampleImplementation'

```tsx
import * as Solid from 'solid-js'
import { createLink, LinkComponent } from '@tanstack/solid-router'

export const Route = createRootRoute({
  component: RootComponent,
})

type BasicLinkProps = Solid.JSX.IntrinsicElements['a'] & {
  // Add any additional props you want to pass to the anchor element
}

const BasicLinkComponent: Solid.Component<BasicLinkProps> = (props) => (
  <a {...props} class="block px-3 py-2 text-red-700">
    {props.children}
  </a>
)

const CreatedLinkComponent = createLink(BasicLinkComponent)

export const CustomLink: LinkComponent<typeof BasicLinkComponent> = (props) => {
  return <CreatedLinkComponent preload={'intent'} {...props} />
}
```

[//]: # 'BasicExampleImplementation'
[//]: # 'ExamplesUsingThirdPartyLibs'

## `createLink` with third party libraries

Here are some examples of how you can use `createLink` with third-party libraries.

### Some Library example

```tsx
// TODO: Add this example.
```

[//]: # 'ExamplesUsingThirdPartyLibs'
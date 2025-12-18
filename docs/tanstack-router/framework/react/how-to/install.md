---
topic: tanstack-router/framework/react/how-to/install
title: Install
version: latest
sourceUrl: https://github.com/tanstack/router/blob/main/docs/router/framework/react/how-to/install.md
tags:
  - tanstack-router
  - framework
---

## Prerequisites

- React 18.x.x or 19.x.x
- ReactDOM 18.x.x or 19.x.x with `createRoot` support
- TypeScript 5.3.x or higher (recommended)

## Installation Steps

1. **Install the package**

   Choose your package manager:

   ```sh
   npm install @tanstack/react-router
   ```

   ```sh
   pnpm add @tanstack/react-router
   ```

   ```sh
   yarn add @tanstack/react-router
   ```

   ```sh
   bun add @tanstack/react-router
   ```

   ```sh
   deno add npm:@tanstack/react-router
   ```

2. **Verify installation**

   Check that the package appears in your `package.json`:

   ```json
   {
     "dependencies": {
       "@tanstack/react-router": "^x.x.x"
     }
   }
   ```
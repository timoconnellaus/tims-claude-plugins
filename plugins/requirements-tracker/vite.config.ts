import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "src/ui"),
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart(),
    // Nitro for production builds - outputs to .output/server/index.mjs
    nitro({ preset: "bun" }),
    // React plugin must come after TanStack Start
    react(),
  ],
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
  ssr: {
    // Force bundling of packages with problematic ESM exports
    noExternal: ["react-syntax-highlighter"],
  },
});

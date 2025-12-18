/**
 * Start web UI for managing docs
 */

import { spawn } from "node:child_process";
import { isProductionBuild } from "../lib/mode";
import { dirname, join } from "path";

export async function ui(args: { cwd: string; port: number }) {
  const { cwd, port } = args;

  if (isProductionBuild()) {
    await startProductionServer({ cwd, port });
  } else {
    await startDevServer({ cwd, port });
  }
}

async function startProductionServer(args: { cwd: string; port: number }) {
  const { cwd, port } = args;

  // Dynamically import the embedded server module (only exists in production builds)
  const { extractEmbeddedServer } = await import("../lib/embedded-server");

  // Extract embedded .output folder to cache directory
  const serverDir = await extractEmbeddedServer();
  const serverPath = join(serverDir, "server", "index.mjs");

  console.log(`Starting Docs Skill UI on port ${port}...`);

  // Run the Nitro server
  const serverProcess = spawn("bun", [serverPath], {
    cwd: serverDir,
    stdio: ["inherit", "inherit", "inherit"],
    env: {
      ...process.env,
      DOCS_PROJECT_CWD: cwd,
      PORT: String(port),
      HOST: "0.0.0.0",
      NITRO_PORT: String(port),
    },
  });

  // Open browser after a short delay
  const url = `http://localhost:${port}`;
  openBrowser(url, 1500);

  console.log(`Docs Skill UI running at ${url}`);
  console.log("Press Ctrl+C to stop");

  await new Promise<void>((resolve) => {
    serverProcess.on("close", () => resolve());
  });
}

async function startDevServer(args: { cwd: string; port: number }) {
  const { cwd, port } = args;

  // Start TanStack Start (Vite) - handles both frontend and API routes
  const pluginDir = dirname(dirname(import.meta.dir));
  const viteConfigPath = join(pluginDir, "vite.config.ts");

  console.log(`Starting Docs Skill UI (dev mode) on port ${port}...`);

  const viteProcess = spawn(
    "bunx",
    ["vite", "--port", String(port), "--config", viteConfigPath],
    {
      cwd: pluginDir,
      stdio: ["inherit", "inherit", "inherit"],
      env: {
        ...process.env,
        DOCS_PROJECT_CWD: cwd,
      },
    }
  );

  // Open browser after a short delay
  const url = `http://localhost:${port}`;
  openBrowser(url, 2000);

  console.log(`Docs Skill UI running at ${url}`);
  console.log("Press Ctrl+C to stop");

  await new Promise<void>((resolve) => {
    viteProcess.on("close", () => resolve());
  });
}

function openBrowser(url: string, delay: number) {
  setTimeout(() => {
    try {
      if (process.platform === "darwin") {
        spawn("open", [url], { stdio: "ignore" });
      } else if (process.platform === "linux") {
        spawn("xdg-open", [url], { stdio: "ignore" });
      } else if (process.platform === "win32") {
        spawn("cmd", ["/c", "start", url], { stdio: "ignore" });
      }
    } catch {
      // Ignore errors opening browser
    }
  }, delay);
}

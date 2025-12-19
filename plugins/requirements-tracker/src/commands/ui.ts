/**
 * Start web UI for viewing requirements
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { requirementsDirExists } from "../lib/store";
import { isProductionBuild } from "../lib/mode";
import { dirname, join } from "path";

export async function ui(args: { cwd: string; port: number }) {
  const { cwd, port } = args;

  // Check if initialized
  if (!(await requirementsDirExists(cwd))) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  if (isProductionBuild()) {
    await startProductionServer({ cwd, port });
  } else {
    await startDevServer({ cwd, port });
  }
}

/**
 * Check if a port is available
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
}

async function startProductionServer(args: { cwd: string; port: number }) {
  const { cwd, port: requestedPort } = args;

  // Find an available port
  const port = await findAvailablePort(requestedPort);
  if (port !== requestedPort) {
    console.log(`Port ${requestedPort} is in use, using port ${port}...`);
  }

  // Dynamically import the embedded server module (only exists in production builds)
  const { extractEmbeddedServer } = await import("../lib/embedded-server");

  // Extract embedded .output folder to cache directory
  const serverDir = await extractEmbeddedServer();
  const serverPath = join(serverDir, "server", "index.mjs");

  console.log(`Starting Requirements Tracker on port ${port}...`);

  // Run the Nitro server
  const serverProcess = spawn("bun", [serverPath], {
    cwd: serverDir,
    stdio: ["inherit", "pipe", "inherit"],
    env: {
      ...process.env,
      REQ_PROJECT_CWD: cwd,
      PORT: String(port),
      HOST: "0.0.0.0",
      NITRO_PORT: String(port),
    },
  });

  // Parse stdout to detect when server is ready
  let browserOpened = false;
  serverProcess.stdout?.on("data", (data: Buffer) => {
    const output = data.toString();
    process.stdout.write(output);

    // Open browser once we see the server is listening
    if (!browserOpened && (output.includes("Listening") || output.includes("listening") || output.includes("ready"))) {
      browserOpened = true;
      openBrowser(`http://localhost:${port}`, 300);
    }
  });

  // Fallback: open browser after delay if we didn't detect ready message
  setTimeout(() => {
    if (!browserOpened) {
      browserOpened = true;
      openBrowser(`http://localhost:${port}`, 0);
    }
  }, 2000);

  await new Promise<void>((resolve) => {
    serverProcess.on("close", () => resolve());
  });
}

async function startDevServer(args: { cwd: string; port: number }) {
  const { cwd, port } = args;

  // Start TanStack Start (Vite) - handles both frontend and API routes
  const pluginDir = dirname(dirname(import.meta.dir));
  const viteConfigPath = join(pluginDir, "vite.config.ts");

  console.log(`Starting Requirements Tracker (dev mode) on port ${port}...`);

  const viteProcess = spawn(
    "bunx",
    ["vite", "--port", String(port), "--config", viteConfigPath],
    {
      cwd: pluginDir,
      stdio: ["inherit", "pipe", "inherit"],
      env: {
        ...process.env,
        REQ_PROJECT_CWD: cwd,
      },
    }
  );

  // Parse stdout to detect actual port (Vite may use different port if requested is busy)
  let browserOpened = false;
  viteProcess.stdout?.on("data", (data: Buffer) => {
    const output = data.toString();
    process.stdout.write(output);

    if (!browserOpened) {
      // Match Vite's "Local: http://localhost:XXXX/" output
      const match = output.match(/Local:\s+http:\/\/localhost:(\d+)/);
      if (match) {
        const actualPort = match[1];
        browserOpened = true;
        openBrowser(`http://localhost:${actualPort}`, 500);
      }
    }
  });

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

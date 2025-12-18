/**
 * Start web UI for managing docs
 */

import { spawn } from "node:child_process";
import { dirname, join } from "path";

export async function ui(args: { cwd: string; port: number }) {
  const { cwd, port } = args;

  // Start TanStack Start (Vite) - handles both frontend and API routes
  const pluginDir = dirname(dirname(import.meta.dir));
  const viteConfigPath = join(pluginDir, "vite.config.ts");

  console.log(`Starting Docs Skill UI on port ${port}...`);

  const viteProcess = spawn(
    "bunx",
    ["vite", "--port", String(port), "--config", viteConfigPath],
    {
      cwd: pluginDir,
      stdio: ["inherit", "inherit", "inherit"],
      env: {
        ...process.env,
        // Pass the user's project directory to the Vite server
        DOCS_PROJECT_CWD: cwd,
      },
    }
  );

  // Open browser after a short delay
  const url = `http://localhost:${port}`;
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
  }, 2000);

  console.log(`Docs Skill UI running at ${url}`);
  console.log("Press Ctrl+C to stop");

  await new Promise<void>((resolve) => {
    viteProcess.on("close", () => resolve());
  });
}

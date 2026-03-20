import { spawn } from "node:child_process";
import path from "node:path";

const processes = [];
let shuttingDown = false;

const start = (name, command, args) => {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
  });

  child.on("exit", (code) => {
    if (!shuttingDown) {
      const exitCode = code ?? 0;
      if (exitCode !== 0) {
        console.error(`${name} exited with code ${exitCode}`);
      } else {
        console.error(`${name} exited unexpectedly`);
      }
      shutdown(exitCode);
    }
  });

  processes.push(child);
};

const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of processes) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(code);
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("frontend", process.execPath, [
  path.join("node_modules", "vite", "bin", "vite.js"),
  "--config",
  path.join("frontend", "vite.config.ts"),
]);

start("backend", process.execPath, [path.join("backend", "server.js")]);

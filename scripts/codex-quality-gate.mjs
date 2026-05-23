import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const promptPath = ".codex/quality-gate-repair-loop.md";

if (!existsSync(promptPath)) {
  console.error(`Missing prompt file: ${promptPath}`);
  process.exit(1);
}

const prompt = readFileSync(promptPath, "utf8").trim();

if (!prompt) {
  console.error(`Prompt file is empty: ${promptPath}`);
  process.exit(1);
}

const result = spawnSync(
  "codex",
  [
    "exec",
    "--sandbox",
    "workspace-write",
    "--ask-for-approval",
    "on-request",
    prompt,
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
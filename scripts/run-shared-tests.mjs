import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = process.cwd();
const SHARED_DIR = path.join(ROOT_DIR, "shared");

function walk(dirPath, files = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walk(absolutePath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
      files.push(absolutePath);
    }
  }

  return files;
}

const testFiles = walk(SHARED_DIR)
  .map((filePath) => path.relative(ROOT_DIR, filePath))
  .sort();

if (testFiles.length === 0) {
  console.error("No shared test files found.");
  process.exit(1);
}

console.log("Running shared tests:");
for (const testFile of testFiles) {
  console.log(`- ${testFile}`);
}

const serverRelativeTestFiles = testFiles.map((testFile) => `../${testFile}`);

const result = spawnSync(
  "npm",
  [
    "--workspace",
    "server",
    "exec",
    "--",
    "tsx",
    "--test",
    ...serverRelativeTestFiles
  ],
  {
    stdio: "inherit"
  }
);

process.exit(result.status ?? 1);
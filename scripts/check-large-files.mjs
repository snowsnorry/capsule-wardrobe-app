import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const DEFAULT_MAX_LINES = 500;
const MAX_LINES = Number(process.env.CODE_QUALITY_MAX_LINES ?? DEFAULT_MAX_LINES);

const ROOTS = ["client/src", "server/src", "shared"];

const INCLUDED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo"
]);

const IGNORED_FILE_PATTERNS = [
  /\.d\.ts$/,
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /(?:^|[/\\])shared[/\\]i18n[/\\][a-z]{2}(?:Options)?\.ts$/
];

function shouldIgnoreFile(filePath) {
  return IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function walk(dirPath, files = []) {
  if (!fs.existsSync(dirPath)) {
    return files;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        walk(absolutePath, files);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name);

    if (!INCLUDED_EXTENSIONS.has(extension)) {
      continue;
    }

    if (shouldIgnoreFile(absolutePath)) {
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, "utf8");

  if (content.length === 0) {
    return 0;
  }

  return content.split(/\r?\n/).length;
}

const oversizedFiles = ROOTS.flatMap((root) => {
  const absoluteRoot = path.join(ROOT_DIR, root);

  return walk(absoluteRoot).map((filePath) => ({
    filePath,
    relativePath: path.relative(ROOT_DIR, filePath),
    lines: countLines(filePath)
  }));
})
  .filter((file) => file.lines > MAX_LINES)
  .sort((a, b) => b.lines - a.lines);

if (oversizedFiles.length === 0) {
  console.log(`No source files above ${MAX_LINES} LOC.`);
  process.exit(0);
}

console.error(`Found ${oversizedFiles.length} source file(s) above ${MAX_LINES} LOC:\n`);

for (const file of oversizedFiles) {
  console.error(`${String(file.lines).padStart(5, " ")}  ${file.relativePath}`);
}

console.error(`
Large-file gate failed.

Refactor these files by logical architectural responsibility:
- presentational components;
- hooks;
- pure helpers;
- constants/config;
- mappers/normalizers;
- API adapters;
- type definitions.

Do not split files mechanically just to satisfy the LOC threshold.
`);

process.exit(1);

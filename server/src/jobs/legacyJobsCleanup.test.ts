import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { test, expect } from "vitest";

function joinName(...parts: string[]) {
  return parts.join("");
}

const removedLegacyModules = [
  `../ai/${joinName("outfit", "Image", "Jobs")}.ts`,
  `../ai/${joinName("outfit", "Set", "Image", "Jobs")}.ts`,
  `../ai/${joinName("partial", "Regeneration", "Jobs")}.ts`,
  `../ai/${joinName("ai", "Service")}.ts`,
  `../ai/${joinName("regenerate", "Selected", "Service")}.ts`,
  `../ai/${joinName("regenerate", "Selected", "Service", "Request")}.ts`,
  `../ai/${joinName("wardrobe", "Full", "Regeneration")}.ts`,
  `../ai/${joinName("wardrobe", "Service", "Handlers")}.ts`,
];

function listProductionSourceModules(url: URL): URL[] {
  const result: URL[] = [];
  for (const entry of readdirSync(url, { withFileTypes: true })) {
    const child = new URL(
      `${entry.name}${entry.isDirectory() ? "/" : ""}`,
      url,
    );
    if (entry.isDirectory()) {
      if (entry.name === "e2e" || entry.name === "test") {
        continue;
      }
      result.push(...listProductionSourceModules(child));
      continue;
    }

    if (
      entry.isFile() &&
      /\.(d\.)?ts$/.test(entry.name) &&
      !entry.name.endsWith(".test.ts") &&
      statSync(child).isFile()
    ) {
      result.push(child);
    }
  }
  return result;
}

test("production job execution has no legacy process-local AI/image job paths", () => {
  for (const modulePath of removedLegacyModules) {
    expect(existsSync(new URL(modulePath, import.meta.url))).toBe(false);
  }

  const forbiddenPatterns = [
    new RegExp(joinName("create", "Wardrobe", "Service")),
    new RegExp(joinName("create", "Partial", "Regeneration", "Service")),
    new RegExp(joinName("create", "Outfit", "Image", "Service")),
    new RegExp(joinName("create", "Outfit", "Set", "Image", "Service")),
    new RegExp(joinName("outfit", "Image", "Jobs")),
    new RegExp(joinName("outfit", "Set", "Image", "Jobs")),
    new RegExp(joinName("partial", "Regeneration", "Jobs")),
    new RegExp(joinName("start", "Full", "Regeneration")),
    new RegExp(`${joinName("set", "Pending")}\\w*Job`),
    new RegExp("signal:\\s*null"),
  ];

  for (const moduleUrl of listProductionSourceModules(
    new URL("../", import.meta.url),
  )) {
    const source = readFileSync(moduleUrl, "utf8");
    for (const pattern of forbiddenPatterns) {
      expect(source, `${moduleUrl.pathname} contains ${pattern}`).not.toMatch(
        pattern,
      );
    }
  }
});

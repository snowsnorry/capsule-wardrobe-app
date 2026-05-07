import { beforeEach, describe, expect, test, vi } from "vitest";

const fsMock = vi.hoisted(() => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  ...fsMock,
}));

import {
  buildLastPromptArtifact,
  LAST_PROMPT_DIR_URL,
  saveLastPromptArtifacts,
} from "./regenerateSelectedArtifacts.js";

describe("regenerateSelectedArtifacts", () => {
  beforeEach(() => {
    fsMock.mkdirSync.mockClear();
    fsMock.writeFileSync.mockClear();
  });

  test("buildLastPromptArtifact ignores non-string prompts and uses explicit system prompts", () => {
    expect(buildLastPromptArtifact(null)).toBe("");

    expect(
      buildLastPromptArtifact("Pick replacements", null, "System override"),
    ).toBe("System:\nSystem override\n\nUser:\nPick replacements");
  });

  test("buildLastPromptArtifact falls back to the regeneration system prompt", () => {
    const artifact = buildLastPromptArtifact("Pick replacements", {
      season: ["summer"],
      audience: "woman",
    });

    expect(artifact).toContain("System:\n");
    expect(artifact).toContain("User:\nPick replacements");
  });

  test("saveLastPromptArtifacts writes prompt and collage only in development", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";

    saveLastPromptArtifacts({
      prompt: "Ignored",
      currentCapsuleCollage: { buffer: Buffer.from("image") },
    });

    expect(fsMock.mkdirSync).not.toHaveBeenCalled();
    expect(fsMock.writeFileSync).not.toHaveBeenCalled();

    process.env.NODE_ENV = "development";
    saveLastPromptArtifacts({
      prompt: "Pick replacements",
      systemPrompt: "System override",
      currentCapsuleCollage: { buffer: Buffer.from("image") },
    });
    process.env.NODE_ENV = previousNodeEnv;

    expect(fsMock.mkdirSync).toHaveBeenCalledWith(LAST_PROMPT_DIR_URL, {
      recursive: true,
    });
    expect(fsMock.writeFileSync).toHaveBeenCalledWith(
      new URL("last_prompt.txt", LAST_PROMPT_DIR_URL),
      "System:\nSystem override\n\nUser:\nPick replacements",
      "utf8",
    );
    expect(fsMock.writeFileSync).toHaveBeenCalledWith(
      new URL("current-capsule.jpg", LAST_PROMPT_DIR_URL),
      Buffer.from("image"),
    );
  });
});

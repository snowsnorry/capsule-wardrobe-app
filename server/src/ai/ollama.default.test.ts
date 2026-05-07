import { expect, test, vi } from "vitest";

const ollamaMock = vi.hoisted(() => ({
  embeddingPayloads: [] as unknown[],
  generatePayloads: [] as unknown[]
}));

vi.mock("ollama", () => ({
  default: {
    embeddings: async (payload: unknown) => {
      ollamaMock.embeddingPayloads.push(payload);
      return { embedding: [0.2, 0.3] };
    },
    generate: async (payload: unknown) => {
      ollamaMock.generatePayloads.push(payload);
      return { response: "{\"ok\":true}" };
    }
  }
}));

test("default ollama exports use the package client adapters", async () => {
  const {
    DEFAULT_OLLAMA_CHAT_MODEL,
    DEFAULT_OLLAMA_EMBEDDING_MODEL,
    generateJsonWithLlm,
    getPromptEmbeddings
  } = await import("./ollama.js");

  await expect(getPromptEmbeddings("prompt")).resolves.toEqual([0.2, 0.3]);
  await expect(generateJsonWithLlm("Return JSON")).resolves.toMatchObject({ json: { ok: true } });
  expect(ollamaMock.embeddingPayloads).toEqual([{
    model: DEFAULT_OLLAMA_EMBEDDING_MODEL,
    prompt: "prompt"
  }]);
  expect(ollamaMock.generatePayloads).toEqual([{
    model: DEFAULT_OLLAMA_CHAT_MODEL,
    prompt: "Return JSON",
    format: "json"
  }]);
});

import { test, expect } from "vitest";
import {
  createOllamaClient,
  DEFAULT_OLLAMA_CHAT_MODEL,
  DEFAULT_OLLAMA_EMBEDDING_MODEL
} from "./ollama.js";

function createGenerateResponse(response: string) {
  return {
    response,
    abortController: new AbortController(),
    itr: (async function *() {})(),
    doneCallback: undefined,
    abort() {},
    async *[Symbol.asyncIterator]() {}
  };
}

test("ollama client shapes embedding and generation requests", async () => {
  let embeddingsPayload = null;
  let generatePayload = null;
  const client = createOllamaClient({
    embeddingsImpl: async (payload) => {
      embeddingsPayload = payload;
      return { embedding: [0.1, 0.2] };
    },
    generateImpl: async (payload) => {
      generatePayload = payload;
      return createGenerateResponse("{\"ok\":true}");
    }
  });

  const embedding = await client.getPromptEmbeddings("prompt");
  expect(embedding).toEqual([0.1, 0.2]);
  expect(embeddingsPayload).toEqual({
    model: DEFAULT_OLLAMA_EMBEDDING_MODEL,
    prompt: "prompt"
  });

  const generated = await client.generateJsonWithLlm("Return JSON");
  expect(generated.json).toEqual({ ok: true });
  expect(generatePayload).toEqual({
    model: DEFAULT_OLLAMA_CHAT_MODEL,
    prompt: "Return JSON",
    format: "json"
  });
});

test("ollama client throws for invalid embedding payload and invalid json output", async () => {
  const badEmbeddingClient = createOllamaClient({
    embeddingsImpl: async () => ({ embedding: [] }),
    generateImpl: async () => createGenerateResponse("{}")
  });
  await expect(() => badEmbeddingClient.getPromptEmbeddings("prompt")).rejects.toThrow(/Failed to compute prompt embeddings/);

  const badJsonClient = createOllamaClient({
    embeddingsImpl: async () => ({ embedding: [1] }),
    generateImpl: async () => createGenerateResponse("not-json")
  });
  await expect(() => badJsonClient.generateJsonWithLlm("prompt")).rejects.toThrow(new RegExp(`Failed to parse JSON response from ${DEFAULT_OLLAMA_CHAT_MODEL}`));
});

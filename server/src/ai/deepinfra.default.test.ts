import { expect, test, vi } from "vitest";

const openAiMock = vi.hoisted(() => ({
  constructorPayloads: [] as unknown[],
  embeddingPayloads: [] as unknown[],
  chatPayloads: [] as unknown[],
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    embeddings = {
      create: async (payload: unknown) => {
        openAiMock.embeddingPayloads.push(payload);
        return { data: [{ embedding: [0.7] }] };
      },
    };

    chat = {
      completions: {
        create: async (payload: unknown) => {
          openAiMock.chatPayloads.push(payload);
          return {
            async *[Symbol.asyncIterator]() {
              yield { choices: [{ delta: { content: '{"ok":true}' } }] };
            },
          };
        },
      },
    };

    constructor(payload: unknown) {
      openAiMock.constructorPayloads.push(payload);
    }
  },
}));

test("default deepinfra client uses OpenAI SDK adapter and env API key", async () => {
  process.env.DEEPINFRA_API_KEY = "deep-key";
  const { createDeepInfraClient } = await import("./deepinfra.js");
  const client = createDeepInfraClient({ cache: false });

  await expect(client.getPromptEmbeddings("prompt")).resolves.toEqual([0.7]);
  await expect(
    client.generateJsonWithLlm("Return JSON"),
  ).resolves.toMatchObject({ json: { ok: true } });

  expect(openAiMock.constructorPayloads).toEqual([
    {
      apiKey: "deep-key",
      baseURL: "https://api.deepinfra.com/v1/openai",
      maxRetries: 0,
    },
    {
      apiKey: "deep-key",
      baseURL: "https://api.deepinfra.com/v1/openai",
      maxRetries: 0,
    },
  ]);
  expect(openAiMock.embeddingPayloads).toEqual([
    { model: "google/embeddinggemma-300m", input: "prompt" },
  ]);
  expect(openAiMock.chatPayloads[0]).toMatchObject({
    model: "google/gemma-4-31B-it",
    stream: true,
  });
});

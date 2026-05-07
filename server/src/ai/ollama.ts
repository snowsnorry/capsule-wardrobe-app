import ollama from "ollama";

const DEFAULT_OLLAMA_EMBEDDING_MODEL = "embeddinggemma";
const DEFAULT_OLLAMA_CHAT_MODEL = "gemma3:27b";

type OllamaEmbeddingResponseLike = {
  embedding?: number[];
};

type OllamaGenerateResponseLike = {
  response?: string;
};

function createOllamaClient({
  embeddingsImpl = (payload: { model: string; prompt: string }) =>
    ollama.embeddings(payload),
  generateImpl = (payload: { model: string; prompt: string; format: "json" }) =>
    ollama.generate(payload) as Promise<OllamaGenerateResponseLike>,
}: {
  embeddingsImpl?: (payload: {
    model: string;
    prompt: string;
  }) => Promise<OllamaEmbeddingResponseLike>;
  generateImpl?: (payload: {
    model: string;
    prompt: string;
    format: "json";
  }) => Promise<OllamaGenerateResponseLike>;
} = {}) {
  async function getPromptEmbeddings(prompt: string) {
    const response = await embeddingsImpl({
      model: DEFAULT_OLLAMA_EMBEDDING_MODEL,
      prompt,
    });
    const embedding = response?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Failed to compute prompt embeddings");
    }
    return embedding;
  }

  async function generateJsonWithLlm(prompt: string) {
    const response = await generateImpl({
      model: DEFAULT_OLLAMA_CHAT_MODEL,
      prompt,
      format: "json",
    });

    let json;
    try {
      json = JSON.parse(response?.response || "{}");
    } catch {
      throw new Error(
        `Failed to parse JSON response from ${DEFAULT_OLLAMA_CHAT_MODEL}`,
      );
    }

    return { response, json };
  }

  return { generateJsonWithLlm, getPromptEmbeddings };
}

const ollamaClient = createOllamaClient();
const { getPromptEmbeddings, generateJsonWithLlm } = ollamaClient;

export {
  createOllamaClient,
  DEFAULT_OLLAMA_CHAT_MODEL,
  DEFAULT_OLLAMA_EMBEDDING_MODEL,
  getPromptEmbeddings,
  generateJsonWithLlm,
};

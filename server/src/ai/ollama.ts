import ollama from "ollama";

const DEFAULT_OLLAMA_EMBEDDING_MODEL = "embeddinggemma";
const DEFAULT_OLLAMA_CHAT_MODEL = "gemma3:27b";

function createOllamaClient({
  embeddingsImpl = (payload) => ollama.embeddings(payload),
  generateImpl = (payload) => ollama.generate(payload)
} = {}) {
  async function getPromptEmbeddings(prompt: string) {
    const response = await embeddingsImpl({
      model: DEFAULT_OLLAMA_EMBEDDING_MODEL,
      prompt
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
      format: "json"
    }) as { response?: string };

    let json;
    try {
      json = JSON.parse(response?.response || "{}");
    } catch {
      throw new Error(`Failed to parse JSON response from ${DEFAULT_OLLAMA_CHAT_MODEL}`);
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
  generateJsonWithLlm
};
